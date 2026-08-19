export type ApiClient = {
  get(path: string): Promise<{ status: number; body: unknown }>;
  post(path: string, body: unknown): Promise<{ status: number; body: unknown }>;
  patch(path: string, body: unknown): Promise<{ status: number; body: unknown }>;
};

export function createApiClient(baseUrl: string, accessToken: string): ApiClient {
  async function request(method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
    const url = new URL(path, baseUrl).toString();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let responseBody: unknown;
    const text = await response.text();
    try {
      responseBody = text ? JSON.parse(text) : null;
    } catch {
      responseBody = text;
    }
    return { status: response.status, body: responseBody };
  }

  return {
    async get(path: string) {
      return request("GET", path);
    },
    async post(path: string, body: unknown) {
      return request("POST", path, body);
    },
    async patch(path: string, body: unknown) {
      return request("PATCH", path, body);
    },
  };
}
