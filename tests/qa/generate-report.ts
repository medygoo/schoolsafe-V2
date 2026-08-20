import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface TestResult {
  passed: number;
  total: number;
}

export interface QaGap {
  priority: "P0" | "P1" | "P2";
  module: string;
  function: string;
  gap: string;
  action: string;
}

export interface QaReportInput {
  date: string;
  profileCount: number;
  permissionCount: number;
  permissionCoveredCount: number;
  unit: TestResult;
  rls: TestResult;
  integration: TestResult;
  e2e: TestResult;
  gaps: QaGap[];
  recommendation: string;
}

function renderGapRows(gaps: QaGap[]): string {
  if (gaps.length === 0) {
    return "| Aucun écart recensé | — | — | — |\n";
  }
  return gaps
    .map(
      (gap) =>
        `| ${gap.module} | ${gap.function} | ${gap.gap} | ${gap.action} |`,
    )
    .join("\n");
}

export function generateReport(input: QaReportInput): string {
  const templatePath = resolve("tests/qa/qa-report-template.md");
  const template = readFileSync(templatePath, "utf8");

  const p0 = input.gaps.filter((g) => g.priority === "P0");
  const p1 = input.gaps.filter((g) => g.priority === "P1");
  const p2 = input.gaps.filter((g) => g.priority === "P2");

  return template
    .replaceAll("{{date}}", input.date)
    .replaceAll("{{profile_count}}", String(input.profileCount))
    .replaceAll("{{permission_count}}", String(input.permissionCount))
    .replaceAll("{{permission_covered_count}}", String(input.permissionCoveredCount))
    .replaceAll("{{unit_passed}}", String(input.unit.passed))
    .replaceAll("{{unit_total}}", String(input.unit.total))
    .replaceAll("{{rls_passed}}", String(input.rls.passed))
    .replaceAll("{{rls_total}}", String(input.rls.total))
    .replaceAll("{{integration_passed}}", String(input.integration.passed))
    .replaceAll("{{integration_total}}", String(input.integration.total))
    .replaceAll("{{e2e_passed}}", String(input.e2e.passed))
    .replaceAll("{{e2e_total}}", String(input.e2e.total))
    .replaceAll("{{p0_rows}}", renderGapRows(p0))
    .replaceAll("{{p1_rows}}", renderGapRows(p1))
    .replaceAll("{{p2_rows}}", renderGapRows(p2))
    .replaceAll("{{recommendation}}", input.recommendation);
}

function main(): void {
  const args = process.argv.slice(2);
  const inputPath = args[0];

  if (!inputPath) {
    console.error("Usage: npx tsx tests/qa/generate-report.ts <path-to-results.json>");
    process.exit(1);
  }

  const input: QaReportInput = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
  const report = generateReport(input);
  const outputPath = resolve(`tests/qa/qa-report-${input.date}.md`);
  writeFileSync(outputPath, report);
  console.log(`Report written to ${outputPath}`);
}

main();
