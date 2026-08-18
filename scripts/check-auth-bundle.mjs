import fs from "node:fs/promises";

const bundlePath = new URL("../app/vendor/supabase-sdk.js", import.meta.url);
const source = await fs.readFile(bundlePath, "utf8");

if (!source.includes("SchoolSafeSupabaseSDK")) {
  throw new Error("Auth bundle does not expose SchoolSafeSupabaseSDK");
}

const forbiddenMarkers = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_SECRET_ACCESS_KEY",
  "VAPID_PRIVATE_KEY",
];

for (const marker of forbiddenMarkers) {
  if (source.includes(marker)) {
    throw new Error(`Forbidden secret marker in auth bundle: ${marker}`);
  }
}

const credentialPatterns = [
  /sb_secret_[A-Za-z0-9_-]{16,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /https:\/\/[a-z0-9]{15,}\.supabase\.co/i,
];

for (const pattern of credentialPatterns) {
  if (pattern.test(source)) {
    throw new Error(`Forbidden concrete credential/config pattern in auth bundle: ${pattern}`);
  }
}

console.log("PASS auth bundle is self-contained and contains no SchoolSafe privileged config");
