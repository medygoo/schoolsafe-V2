import { describe, it, expect, vi } from "vitest";
import { createDocumentNumberingService } from "../../app/modules/document-engine/document-numbering-service.js";

describe("DocumentNumberingService", () => {
  it("calls next_document_number RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: "REC-2026-00001", error: null }),
    };
    const svc = createDocumentNumberingService(client, "s1");
    const num = await svc.nextNumber("receipt", "REC-");
    expect(num).toBe("REC-2026-00001");
    expect(client.rpc).toHaveBeenCalledWith("next_document_number", {
      p_school_id: "s1",
      p_document_type: "receipt",
      p_prefix: "REC-",
    });
  });
});
