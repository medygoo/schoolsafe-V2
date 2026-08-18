// tests/document-engine/receipt-template.test.js
import { describe, it, expect } from "vitest";

// Receipt template is browser-only because of jsPDF/image APIs.
// This test validates the public export exists.
describe("receipt template", () => {
  it("exports renderReceipt", async () => {
    const { renderReceipt } = await import("../../app/modules/document-engine/templates/receipt-template.js");
    expect(typeof renderReceipt).toBe("function");
  });
});
