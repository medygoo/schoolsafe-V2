import { readFileSync } from "node:fs";

const catalogUrl = new URL("../../../shared/permissions.json", import.meta.url);

export function loadPermissionCatalog(): ReadonlySet<string> {
  const parsed: unknown = JSON.parse(readFileSync(catalogUrl, "utf8"));
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
    throw new Error("Invalid permission catalog");
  }
  return new Set(parsed);
}
