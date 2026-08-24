// app/modules/document-engine/access-gate.js
// Single entry point for document authorization.
// Permission comes from TemplateInfo, never from DocumentRequest.

const PERMISSIONS_PATH = "../shared/permissions.json";

let permissionsCache = null;

export function createAccessGate(options = {}) {
  const permissionsUrl = options.permissionsUrl || PERMISSIONS_PATH;
  const adminRole = options.adminRole || "admin";
  const isAdmin = options.isAdmin || ((user) => user.role === adminRole);

  return {
    /**
     * Check whether the user in the request may perform the action on the document type.
     * @param {import("./contracts.js").DocumentRequest} request
     * @param {import("./template-registry.js").TemplateInfo} templateInfo
     * @returns {Promise<AccessResult>}
     */
    async check(request, templateInfo) {
      const permissions = await loadPermissions(permissionsUrl);

      const user = request.requestedBy;
      if (!user) {
        return deny("No user context");
      }

      // Admin principal = full access
      if (isAdmin(user)) {
        return allow(templateInfo.permissions[0] || "admin", "school");
      }

      // Default deny
      if (!templateInfo || !Array.isArray(templateInfo.permissions) || templateInfo.permissions.length === 0) {
        return deny("No permission defined for document type");
      }

      // Determine required permission based on action
      const requiredPermission = pickRequiredPermission(request.action, templateInfo.permissions);
      const permissionDef = permissions.find((p) => p.code === requiredPermission);

      if (!permissionDef) {
        return deny(`Permission ${requiredPermission} not found in catalogue`);
      }

      // In frontend phase we trust the user context carries the resolved permissions.
      // Backend will re-verify against JWT/RLS.
      const userPermissions = Array.isArray(user.permissions) ? user.permissions : [];
      const hasPermission = userPermissions.includes(requiredPermission);

      if (!hasPermission) {
        return deny(`Missing permission ${requiredPermission}`);
      }

      return allow(requiredPermission, permissionDef.scope || "none");
    },

    reset() {
      permissionsCache = null;
    },
  };
}

function allow(permission, scope) {
  return { allowed: true, permission, scope };
}

function deny(reason) {
  // Log important refusals locally for QA/security awareness.
  if (typeof console !== "undefined" && console.warn) {
    console.warn("[DocumentEngine][AccessGate] Denied:", reason);
  }
  return { allowed: false, permission: "", scope: "none", reason };
}

async function loadPermissions(url) {
  if (permissionsCache) return permissionsCache;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    permissionsCache = await res.json();
    return permissionsCache;
  } catch (err) {
    // Fallback for Node tests or missing file
    if (typeof require !== "undefined") {
      try {
        permissionsCache = require("../../shared/permissions.json");
        return permissionsCache;
      } catch {
        // ignore
      }
    }
    throw new Error(`Unable to load permissions: ${err.message}`);
  }
}

/**
 * Pick the most appropriate permission for the requested action.
 * @param {string} action
 * @param {string[]} permissions
 * @returns {string}
 */
function pickRequiredPermission(action, permissions) {
  // For view/preview use the first read permission.
  if (action === "view" || action === "preview") {
    return (
      permissions.find((p) => p.endsWith(".read")) ||
      permissions[0]
    );
  }
  // For generate/download/print/export_pdf use the first permission.
  return permissions[0];
}

/**
 * @typedef {Object} AccessResult
 * @property {boolean} allowed
 * @property {string} permission
 * @property {string} scope
 * @property {string} [reason]
 */
