import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { enterDemoWorkspace, openDocumentsCenter } from "./helpers";

type Surface = {
  phase: string;
  label: string;
  role: string;
  selector: string;
  branch?: string;
  documents?: boolean;
};

const SURFACES: Surface[] = [
  { phase: "B", label: "Élèves", role: "admin", branch: "school", selector: "#schoolModule" },
  { phase: "C", label: "Parent", role: "parent", selector: "#parentPortal" },
  { phase: "D", label: "Enseignant", role: "teacher", selector: "#teacherPedagogyPortal" },
  { phase: "E", label: "Gardien", role: "guard", selector: "#guardSecurityPortal" },
  { phase: "F", label: "Finance", role: "finance", branch: "finance", selector: "#financeModule" },
  { phase: "G", label: "Comptabilité", role: "accountant", branch: "accounting", selector: "#accountingModule" },
  { phase: "H", label: "RH", role: "hr", branch: "people", selector: "#hrModule" },
  { phase: "I", label: "Stock", role: "admin", branch: "inventory", selector: "#inventoryModule" },
  { phase: "J", label: "Documents", role: "admin", documents: true, selector: "#documentCenterModule" },
  { phase: "K", label: "Communication", role: "communication", branch: "communication", selector: "#communicationModule" },
  { phase: "L", label: "Administration", role: "admin", branch: "administration", selector: "#administrationModule" },
];

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 834, height: 1112 },
  { width: 1440, height: 900 },
];

async function openSurface(page: Page, surface: Surface) {
  await enterDemoWorkspace(page, surface.role);
  if (surface.documents) {
    await openDocumentsCenter(page);
  } else if (surface.branch) {
    const button = page.locator(`button[data-branch="${surface.branch}"]:visible`).first();
    await expect(button).toBeVisible();
    await button.evaluate((element: HTMLElement) => element.click());
  }
  await expect(page.locator(surface.selector)).toBeVisible();
}

async function inspectSurface(page: Page, selector: string) {
  return page.locator(selector).evaluate((root) => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const insideHorizontalScroller = (element: Element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if ((style.overflowX === "auto" || style.overflowX === "scroll") && parent.scrollWidth > parent.clientWidth + 1) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    const overflow = Array.from(root.querySelectorAll("*"))
      .filter(visible)
      .filter((element) => !insideHorizontalScroller(element))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
      })
      .map((element) => ({
        tag: element.tagName,
        className: String((element as HTMLElement).className || ""),
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
        parentClassName: String((element.parentElement as HTMLElement | null)?.className || ""),
      }));
    const shortTargets = Array.from(root.querySelectorAll("button, [role='button'], a[href]"))
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 43.5 || rect.height < 43.5;
      })
      .map((element) => ({ tag: element.tagName, text: (element.textContent || "").trim().slice(0, 60), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    const unlabeledFields = Array.from(root.querySelectorAll("input:not([type='hidden']), select, textarea"))
      .filter(visible)
      .filter((element) => {
        const id = element.getAttribute("id");
        return !element.closest("label") && !(id && root.querySelector(`label[for="${CSS.escape(id)}"]`)) && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby");
      })
      .map((element) => ({ tag: element.tagName, name: element.getAttribute("name"), id: element.getAttribute("id") }));
    const unsafeTables = Array.from(root.querySelectorAll("table"))
      .filter(visible)
      .filter((table) => {
        const parent = table.parentElement;
        if (!parent || table.scrollWidth <= parent.clientWidth + 1) return false;
        const style = getComputedStyle(parent);
        return style.overflowX !== "auto" && style.overflowX !== "scroll";
      })
      .map((table) => ({ className: String(table.className || ""), width: table.scrollWidth }));
    const dialogsOutsideViewport = Array.from(document.querySelectorAll("[role='dialog'], .ss-modal"))
      .filter(visible)
      .filter((dialog) => {
        const rect = dialog.getBoundingClientRect();
        return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1;
      })
      .map((dialog) => ({ className: String((dialog as HTMLElement).className || ""), rect: dialog.getBoundingClientRect().toJSON() }));
    const focusable = Array.from(root.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")).find(visible) as HTMLElement | undefined;
    let focusVisible = true;
    if (focusable) {
      focusable.focus();
      const style = getComputedStyle(focusable);
      focusVisible = (parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== "none") || style.boxShadow !== "none";
    }
    const rootStyle = getComputedStyle(root);
    return {
      overflow,
      shortTargets,
      unlabeledFields,
      unsafeTables,
      dialogsOutsideViewport,
      focusVisible,
      bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      foreground: rootStyle.color,
      background: rootStyle.backgroundColor,
    };
  });
}

test.describe("M4 — responsive, thèmes et accessibilité frontend finale", () => {
  for (const surface of SURFACES) {
    test(`${surface.phase} — ${surface.label} respecte la matrice finale`, async ({ page }, testInfo: TestInfo) => {
      test.skip(testInfo.project.name === "chromium-mobile", "La matrice exacte est redimensionnée dans le projet desktop.");
      test.setTimeout(120_000);
      await openSurface(page, surface);
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport);
          const state = await inspectSurface(page, surface.selector);
          expect(state.bodyOverflow, `${surface.phase} ${theme} ${viewport.width}px body`).toBe(false);
          expect(state.overflow, `${surface.phase} ${theme} ${viewport.width}px overflow`).toEqual([]);
          expect(state.shortTargets, `${surface.phase} ${theme} ${viewport.width}px tactile`).toEqual([]);
          expect(state.unlabeledFields, `${surface.phase} ${theme} ${viewport.width}px labels`).toEqual([]);
          expect(state.unsafeTables, `${surface.phase} ${theme} ${viewport.width}px tables`).toEqual([]);
          expect(state.dialogsOutsideViewport, `${surface.phase} ${theme} ${viewport.width}px dialogs`).toEqual([]);
          expect(state.focusVisible, `${surface.phase} ${theme} ${viewport.width}px focus`).toBe(true);
          expect(state.foreground).not.toBe(state.background);
        }
      }
    });
  }

  test("les états communs et les dialogues exposent leurs rôles accessibles", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "Contrat DOM exécuté une fois dans le projet desktop.");
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const host = document.createElement("section");
      host.id = "m4StateHost";
      host.innerHTML = [
        (window as any).ssState({ type: "error", title: "Erreur contrôlée", message: "Réessayer" }),
        (window as any).ssState({ type: "empty", title: "État vide", message: "Aucune donnée" }),
        (window as any).ssState({ type: "loading", title: "Chargement", message: "Veuillez patienter" }),
      ].join("");
      document.body.appendChild(host);
      (window as any).ssModal({ title: "Dialogue accessible", content: "<p>Contenu du dialogue</p>", actions: [{ label: "Fermer", variant: "secondary" }] });
    });

    await expect(page.locator("#m4StateHost")).toContainText("Erreur contrôlée");
    await expect(page.locator("#m4StateHost")).toContainText("État vide");
    await expect(page.locator("#m4StateHost")).toContainText("Chargement");
    const dialog = page.getByRole("dialog", { name: "Dialogue accessible" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.getByRole("button", { name: "Fermer" }).last()).toBeVisible();
  });
});
