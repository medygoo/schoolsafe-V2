import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { RequestCardPrintInput } from "./schema.js";
import type { ControlAppConfig } from "../control-app/client.js";
import { pushCardPrintRequest } from "../control-app/client.js";
import { createR2Client, uploadBuffer, getSignedDownloadUrl, type R2Config } from "../storage/r2.js";
import type { S3Client } from "@aws-sdk/client-s3";

export interface CardService {
  requestPrint(requesterProfileId: string, input: RequestCardPrintInput): Promise<{ requestId: string; controlAppId?: string }>;
}

type SchoolInfo = {
  id: string;
  slug: string;
};

type StudentInfo = {
  id: string;
  school_id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
};

type ClassInfo = {
  id: string;
  name: string;
};

type AcademicYearInfo = {
  id: string;
  name: string;
};

function createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

function base64ToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  return Buffer.from(base64, "base64");
}

export function createCardService(
  supabaseUrl: string,
  serviceRoleKey: string,
  r2Config?: R2Config,
  controlAppConfig?: ControlAppConfig
): CardService {
  const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey);
  const r2Client = r2Config ? createR2Client(r2Config) : undefined;
  const bucket = r2Config?.bucket ?? "cards";

  async function getSchoolSlug(schoolId: string): Promise<string> {
    const { data, error } = await serviceClient
      .from("school")
      .select("id")
      .eq("id", schoolId)
      .single();
    if (error || !data) throw new Error(`School not found: ${error?.message}`);
    // On utilise les 8 premiers caractères de l'UUID comme slug stable si aucun slug n'existe.
    // À remplacer par un vrai champ slug quand il sera ajouté au schéma school.
    return schoolId.slice(0, 8);
  }

  async function getStudent(studentId: string): Promise<StudentInfo & { class_name: string | null; academic_year_name: string | null }> {
    const { data: student, error: studentError } = await serviceClient
      .from("students")
      .select("id, school_id, matricule, first_name, last_name, class_id")
      .eq("id", studentId)
      .single();
    if (studentError || !student) throw new Error(`Student not found: ${studentError?.message}`);

    let className: string | null = null;
    if (student.class_id) {
      const { data: cls } = await serviceClient
        .from("classes")
        .select("name")
        .eq("id", student.class_id)
        .single();
      className = cls?.name ?? null;
    }

    return { ...student, class_name: className, academic_year_name: null };
  }

  async function getAcademicYearName(yearId: string | undefined): Promise<string | null> {
    if (!yearId) return null;
    const { data } = await serviceClient
      .from("academic_years")
      .select("name")
      .eq("id", yearId)
      .single();
    return data?.name ?? null;
  }

  async function uploadCardImages(
    schoolSlug: string,
    academicYear: string,
    matricule: string,
    frontBuffer: Buffer,
    backBuffer: Buffer
  ): Promise<{ frontKey: string; backKey: string }> {
    const folder = `cards/${schoolSlug}/${academicYear}/${matricule.replace(/\s+/g, "_")}`;
    const frontKey = `${folder}/front.png`;
    const backKey = `${folder}/back.png`;

    if (r2Client) {
      await uploadBuffer(r2Client, bucket, frontKey, frontBuffer);
      await uploadBuffer(r2Client, bucket, backKey, backBuffer);
    } else {
      // Mode sans R2 : on retourne les clés mais on ne stocke pas les fichiers.
      // Utile pour les tests ou en attendant la configuration R2.
      console.warn("[CardService] R2 not configured, skipping image upload");
    }

    return { frontKey, backKey };
  }

  async function generateSignedUrls(frontKey: string, backKey: string): Promise<{ frontUrl: string; backUrl: string; expiresAt: string }> {
    if (!r2Client) {
      return { frontUrl: "", backUrl: "", expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() };
    }
    const [frontUrl, backUrl] = await Promise.all([
      getSignedDownloadUrl(r2Client, bucket, frontKey),
      getSignedDownloadUrl(r2Client, bucket, backKey)
    ]);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    return { frontUrl, backUrl, expiresAt };
  }

  async function incrementCardPrintCount(studentId: string): Promise<void> {
    const { data: student } = await serviceClient
      .from("students")
      .select("card_print_count")
      .eq("id", studentId)
      .single();
    const count = (student?.card_print_count ?? 0) + 1;
    const now = new Date().toISOString();
    const { error } = await serviceClient
      .from("students")
      .update({ card_printed: true, card_print_date: now.split("T")[0], card_print_count: count })
      .eq("id", studentId);
    if (error) throw new Error(`Failed to update student: ${error.message}`);
  }

  return {
    async requestPrint(requesterProfileId: string, input: RequestCardPrintInput) {
      const student = await getStudent(input.student_id);
      const academicYearName = await getAcademicYearName(input.academic_year_id);
      const yearLabel = academicYearName ?? new Date().getFullYear().toString();
      const schoolSlug = await getSchoolSlug(student.school_id);

      const frontBuffer = base64ToBuffer(input.front_image_base64);
      const backBuffer = base64ToBuffer(input.back_image_base64);

      const { frontKey, backKey } = await uploadCardImages(schoolSlug, yearLabel, student.matricule, frontBuffer, backBuffer);
      const { frontUrl, backUrl, expiresAt } = await generateSignedUrls(frontKey, backKey);

      const fullName = `${student.first_name} ${student.last_name}`.trim();
      const requestId = randomUUID();
      const now = new Date().toISOString();

      const { error: insertError } = await serviceClient.from("card_print_requests").insert({
        id: requestId,
        school_id: student.school_id,
        student_id: student.id,
        academic_year_id: input.academic_year_id ?? null,
        requested_by: requesterProfileId,
        format: input.format,
        status: "pending",
        front_r2_key: frontKey,
        back_r2_key: backKey,
        front_image_url: frontUrl,
        back_image_url: backUrl,
        metadata: {
          ...input.metadata,
          student_name: fullName,
          matricule: student.matricule,
          class_name: student.class_name,
          requested_at: now
        }
      });

      if (insertError) throw new Error(`Failed to create print request: ${insertError.message}`);

      let controlAppId: string | undefined;
      if (controlAppConfig) {
        try {
          const result = await pushCardPrintRequest(controlAppConfig, {
            school_id: student.school_id,
            student_id: student.id,
            student_name: fullName,
            class_name: student.class_name ?? "—",
            academic_year: yearLabel,
            front_key: frontKey,
            back_key: backKey,
            front_signed_url: frontUrl,
            back_signed_url: backUrl,
            signed_url_expires_at: expiresAt,
            format: input.format,
            metadata: input.metadata
          });
          controlAppId = result.id;
          await serviceClient
            .from("card_print_requests")
            .update({ status: "submitted", submitted_at: now, control_app_reference: result.id })
            .eq("id", requestId);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await serviceClient
            .from("card_print_requests")
            .update({ status: "failed", error_message: message })
            .eq("id", requestId);
          throw new Error(`Failed to push to control app: ${message}`);
        }
      }

      await incrementCardPrintCount(student.id);

      return { requestId, controlAppId };
    }
  };
}
