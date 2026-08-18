import { describe, it, expect } from "vitest";
import { hmacSha256 } from "../../src/lib/crypto.js";

describe("hmacSha256", () => {
  it("produces a hex signature", async () => {
    const result = await hmacSha256("secret", "message");
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });
});
