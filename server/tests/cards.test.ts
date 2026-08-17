import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { createCardService } from "../src/cards/service.js";
import type { CardService } from "../src/cards/service.js";

const mockService: CardService = {
  async requestPrint(profileId, input) {
    return { requestId: "req-123", controlAppId: "ctrl-456" };
  }
};

const mockResolve = async (token: string) => (token === "valid-token" ? "resolved-profile-id" : null);

function makeApp() {
  return buildApp({
    cards: {
      service: mockService,
      resolveProfileId: mockResolve,
    },
  });
}

const validPayload = {
  student_id: "550e8400-e29b-41d4-a716-446655440000",
  format: "badge" as const,
  front_image_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  back_image_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  metadata: { test: true }
};

describe("POST /cards/request-print", () => {
  it("returns 401 without authorization header", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/cards/request-print",
      payload: validPayload,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 when profile cannot be resolved", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/cards/request-print",
      headers: { authorization: "Bearer invalid-token" },
      payload: validPayload,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("AUTH_REQUIRED");
  });

  it("returns 400 with invalid body", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/cards/request-print",
      headers: { authorization: "Bearer valid-token" },
      payload: { student_id: "not-a-uuid", format: "badge" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_INVALID");
  });

  it("calls the card service and returns the result", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/cards/request-print",
      headers: { authorization: "Bearer valid-token" },
      payload: validPayload,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.requestId).toBe("req-123");
    expect(json.data.controlAppId).toBe("ctrl-456");
  });
});

describe("createCardService", () => {
  it("is exported", () => {
    expect(createCardService).toBeDefined();
  });
});
