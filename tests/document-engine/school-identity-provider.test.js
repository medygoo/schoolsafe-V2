import { describe, it, expect, vi } from "vitest";
import { createSchoolIdentityProvider } from "../../app/modules/document-engine/school-identity-provider.js";

describe("SchoolIdentityProvider", () => {
  it("normalizes identity from API settings", async () => {
    const api = {
      getSettings: vi.fn().mockResolvedValue({
        identity: { name: "École Pilote", name_en: "Pilot School", legal_name: "SPRL Pilote", approval_code: "A-123" },
        brand: { primary_color: "#071a3d", accent_color: "#e9a515", document_footer: "Pied de page perso", logo_path: "/logo.png" },
        contact: { address: "Av. Test", city: "Kinshasa", province: "Kinshasa", country: "RDC", phone: "+243", email: "a@b.c", website_url: "https://ecole.cd" },
        academic_years: [{ id: "y1", label: "2025-2026", is_active: true }],
        cycles: [{ cycle_key: "primary", cycle_name: "Primaire" }],
      }),
    };
    const provider = createSchoolIdentityProvider(api);
    const identity = await provider.load();
    expect(identity.name).toBe("École Pilote");
    expect(identity.primaryColor).toBe("#071a3d");
    expect(identity.activeAcademicYear.label).toBe("2025-2026");
  });
});
