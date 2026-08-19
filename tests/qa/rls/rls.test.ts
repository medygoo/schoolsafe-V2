import { describe, expect, it } from "vitest";
import { runRlsTestFile } from "./runner.js";

const RLS_TEST_FILES = [
  "auth.setup.test.sql",
  "school.setup.test.sql",
  "finance.setup.test.sql",
  "security.setup.test.sql",
  "pedagogy.setup.test.sql",
  "pilotage.setup.test.sql",
  "platform.setup.test.sql",
];

describe("RLS module tests", () => {
  for (const file of RLS_TEST_FILES) {
    it(`runs ${file}`, async () => {
      const result = await runRlsTestFile(file);
      expect(result.failed).toBe(0);
    }, 60000);
  }
});
