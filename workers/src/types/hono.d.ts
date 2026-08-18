import "hono";

declare module "hono" {
  interface ContextVariableMap {
    token: string;
    schoolId: string;
    profileId: string;
  }
}
