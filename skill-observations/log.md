# Skill Observation Log

Observations captured during task-oriented work.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = skill
updated/created | DECLINED (YYYY-MM-DD) = user decided not to pursue —
resolved statuses always carry their resolution date

---

### Observation 1: Hono strict typing requires ContextVariableMap and ContentfulStatusCode handling

**Status:** OPEN
**Date:** 2026-08-18
**Session context:** Task 2.3 — Cloudflare Workers finance and pilotage routes
**Skill:** New skill candidate: Hono + TypeScript strict typing for Workers
**Type:** open-source
**Phase/Area:** Type declarations and response status typing

**Issue:** In a strict TypeScript Hono project, `c.get("schoolId")` / `c.set("token", ...)` fail with `key: never` unless Hono's `ContextVariableMap` is extended. Also, passing a dynamic `error.statusCode` (type `number`) to `c.json(..., status)` fails because Hono expects `ContentfulStatusCode`, not a plain `number`.

**Suggested improvement:** Add a reusable Hono/Workers setup checklist or skill covering: (1) create `src/types/hono.d.ts` with `declare module "hono" { interface ContextVariableMap { token: string; schoolId: string; profileId: string; } }`; (2) import `ContentfulStatusCode` from `hono/utils/http-status` and cast dynamic status codes (`error.statusCode as ContentfulStatusCode`) or use literal status codes directly.

**Principle:** Framework-specific type extension points (like Hono's `ContextVariableMap`) and branded status-code types must be configured explicitly in strict TypeScript; avoid `as any` casts in route code by centralizing type declarations.

### Observation 2: Generated plan code often needs strict-TypeScript adaptation

**Status:** OPEN
**Date:** 2026-08-18
**Session context:** Task 2.4 — Pedagogy routes; also applies to Tasks 2.2 and 2.3
**Skill:** executing-plans / subagent-driven-development
**Type:** open-source
**Phase/Area:** Plan execution and TypeScript strictness

**Issue:** The implementation plan's route snippets contained unused helper variables (`const schoolId = ...`) and passed `c.req.param("id")` (type `string | undefined`) directly to service methods expecting `string`. Following them verbatim caused strict TypeScript errors that had to be fixed during execution.

**Suggested improvement:** When executing a generated plan in strict TypeScript, treat the plan as pseudocode: explicitly add non-null assertions (`c.req.param("id")!`) for path parameters, remove unused helpers, and run `typecheck` immediately after each module. The executing-plans/subagent-driven-development skills could include a "strict TypeScript sanity pass" checklist before running tests.

**Principle:** A plan is a specification, not a compile-ready artifact; the executor must bridge the gap between plan-level intent and project-level type/strictness constraints.

### Observation 3: Direct intervention preferred when subagent latency frustrates user

**Status:** OPEN
**Date:** 2026-08-19
**Session context:** Partie D — Pédagogie Phase 2 (D1/D2/D3)
**Skill:** superpowers:subagent-driven-development
**Type:** open-source
**Phase/Area:** Execution cadence and user control

**Issue:** During a multi-step implementation phase, the user explicitly asked to stop relying on background subagents and to intervene directly because the process felt too slow. Work accelerated once I read the relevant files myself, ran the tests, and committed each task immediately.

**Suggested improvement:** When a user signals impatience with subagent delegation, offer a "direct mode" for the remainder of the phase: one task at a time, immediate commit/push, no background agents. Document this as an explicit fallback in the subagent-driven-development skill.

**Principle:** User pacing overrides agent orchestration defaults. Detect frustration signals early and switch to hands-on execution with tight feedback loops.

---

### Observation 4: Missing foundational API blocks feature work and must be added first

**Status:** OPEN
**Date:** 2026-08-19
**Session context:** Partie D1 — panneau de saisie des cotes
**Skill:** using-superpowers / planner
**Type:** open-source
**Phase/Area:** Dependency discovery before implementation

**Issue:** To build the grading UI, I needed a list of students by class. No backend route existed for this. The plan/summary did not flag this dependency, so I had to pause feature work to add `/school/classes/:id/students` before completing the grading panel.

**Suggested improvement:** During planning or early execution, explicitly scan for prerequisite CRUD endpoints that the feature assumes. Add a "dependency precondition" checklist before writing UI code.

**Principle:** Feature work should not assume foundational read endpoints exist. Verify read dependencies before building dependent UI or business logic.

### Observation 5: Prefer native BarcodeDetector over new CDN dependency for QR scanning

**Status:** OPEN
**Date:** 2026-08-19
**Session context:** Task E2 — frontend scan QR
**Skill:** frontend-design / implementation
**Type:** open-source
**Phase/Area:** Dependency choice and camera integration

**Issue:** The security module needed camera-based QR scanning. Adding jsQR via CDN was an option, but the project has no local package manager for the `app/` folder, and external CDN dependencies add reliability and security surface.

**Suggested improvement:** Use the native `BarcodeDetector` API first (supported in Chromium-based browsers), with a clear manual-entry fallback when unavailable. This keeps the frontend dependency-free and avoids loading third-party scripts for security-sensitive scanning.

**Principle:** For security-critical frontend features, prefer native browser APIs over external libraries when coverage is acceptable; always provide a graceful manual fallback.

### Observation 6: Database contract tests need an explicit unavailable-runtime outcome

**Status:** OPEN
**Date:** 2026-08-26
**Session context:** Test-first implementation of a Supabase schema and RLS feature
**Skill:** supabase / test-driven-development
**Type:** open-source
**Phase/Area:** RED verification and local database prerequisites

**Issue:** The SQL contract was authored before implementation as required, but the local Supabase runtime could not execute it because neither Docker nor Podman was available. Treating that as a test failure would conflate missing infrastructure with a behavioral RED result; skipping it silently would overstate coverage.

**Suggested improvement:** Add a preflight to Supabase TDD workflows that records one of three exact outcomes for database tests: behavioral RED, behavioral GREEN, or NOT EXECUTED with the missing runtime named. Continue with static and application-layer checks, then carry the database contract explicitly into the final unexecuted-tests report.

**Principle:** Test evidence should distinguish product behavior from infrastructure availability; an unavailable runtime is a precise non-execution result, never a pass or a behavioral failure.

### Observation 7: Scope E2E assertions when legacy screens remain mounted but hidden

**Status:** OPEN
**Date:** 2026-08-26
**Session context:** B1 student workspace tests inside a multi-screen static application
**Skill:** systematic-debugging / test-driven-development
**Type:** open-source
**Phase/Area:** Playwright selector design

**Issue:** Global text, role, password-input, and overflow assertions matched controls from hidden login or legacy dashboard sections. The product behavior was correct, but strict locators either became ambiguous or reported hidden-screen content as a failure.

**Suggested improvement:** Anchor assertions to the active feature root or dialog, use exact text for short status labels, and exclude deliberate accessibility helpers such as `.sr-only` from visual overflow detectors. Navigation helpers should follow the rendered branch-to-tab path instead of searching hidden legacy action markup.

**Principle:** In applications that keep inactive screens in the DOM, E2E selectors must encode the active UI boundary; DOM presence is not equivalent to user-visible behavior.

### Observation 8: Frontend-only future-backend flows need three explicit boundaries

**Status:** OPEN
**Date:** 2026-08-27
**Session context:** Building a family dossier UI while its backend contracts were intentionally frozen for a later phase
**Skill:** impeccable / test-driven-development
**Type:** open-source
**Phase/Area:** Demo state, honest UX, and integration boundaries

**Issue:** A rich editable demonstration can accidentally look authoritative or drift into backend scope unless state, copy, and network behavior all communicate the same boundary. A badge alone is insufficient if controls imply persistence, and a local store alone is insufficient if the interface omits the future contract.

**Suggested improvement:** Add a frontend-only workflow checklist with three simultaneous controls: namespace all demonstration state separately from production state, label every unavailable persistence/verification action as `BACKEND_LATER`, and add an E2E assertion that user interactions do not expose activation or validation actions. Keep the integration point in a dedicated module so the future backend can replace the adapter without rewriting the surface.

**Principle:** Honest prototypes align state isolation, user-facing language, and network boundaries; all three must agree that local interaction is not server success.

### Observation 9: Visual navigation proofs must wait for the real scroll container to settle

**Status:** OPEN
**Date:** 2026-08-27
**Session context:** Responsive light/dark screenshot verification of a long modal dossier
**Skill:** systematic-debugging / impeccable
**Type:** open-source
**Phase/Area:** Playwright visual evidence and smooth scrolling

**Issue:** A navigation click correctly reached its section, but the next screenshot could start while `scrollIntoView({ behavior: "smooth" })` was still compositing. Resetting `scrollTop` on a nested body did not help because the actual overflow container was the modal shell, and waiting for a few apparently stable frames could resolve before the deferred animation began.

**Suggested improvement:** Identify the element that owns `overflow: auto`, attach a one-shot `scrollend` listener before triggering smooth navigation, and await that event before visual assertions or screenshots. For deterministic return-to-top captures, set both scroll axes on that same container and wait for several stable animation frames.

**Principle:** Visual tests should synchronize with the browser state that produces the pixels; element visibility alone does not prove that scrolling and compositing are finished.
