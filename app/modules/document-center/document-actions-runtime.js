/* Connecte les adaptateurs métier au Document Engine sans persistance sensible. */
(function (root) {
  "use strict";

  function allConnectors() {
    return [
      root.SchoolSafeFinanceAccountingDocuments,
      root.SchoolSafeSchoolPedagogyDocuments,
      root.SchoolSafeOperationalDocuments,
    ].filter(Boolean);
  }

  function findConnector(descriptorId) {
    return allConnectors().find(function (connector) {
      return connector.list().some(function (item) { return item.id === descriptorId; });
    }) || null;
  }

  function permissionCatalogue() {
    var byCode = {};
    allConnectors().forEach(function (connector) {
      connector.list().forEach(function (item) {
        if (!byCode[item.permission]) byCode[item.permission] = { code: item.permission, scope: item.scope };
        Object.keys(item.actionPermissions || {}).forEach(function (action) {
          var permission = item.actionPermissions[action];
          if (!byCode[permission]) byCode[permission] = { code: permission, scope: item.scope };
        });
      });
    });
    return Object.keys(byCode).map(function (code) { return byCode[code]; });
  }

  function schoolIdentityProvider() {
    return {
      load: async function () {
        var schoolName = root.document && root.document.getElementById("workspaceSchoolName");
        return {
          name: schoolName && schoolName.textContent ? schoolName.textContent.trim() : "École de démonstration SchoolSafe",
          legalName: "École de démonstration SchoolSafe",
          address: "Kinshasa", city: "Kinshasa", country: "RDC",
          phone: "+243 000 000 000", email: "contact@ecole.demo", website: "https://schoolsafe.app",
          primaryColor: "#071a3d", accentColor: "#e9a515", logoUrl: null,
          documentFooter: "APERÇU FRONTEND · BACKEND_LATER · SchoolSafe",
          currency: "CDF", activeAcademicYear: { id: "demo-year-2026", label: "2026-2027" }, activeCycles: [],
        };
      },
    };
  }

  async function initialize() {
    if (!root.SchoolSafeDocumentCenter) throw new Error("Document Center unavailable");
    var engine = await import("../document-engine/index.js");
    var actionsModule = await import("../document-engine/document-actions.js");
    var actions = actionsModule.createUniversalDocumentActions({
      documentCenter: root.SchoolSafeDocumentCenter,
      access: root.SchoolSafeAccess,
      permissionsLoader: async function () { return permissionCatalogue(); },
      templateResolver: async function (descriptorId) {
        var connector = findConnector(descriptorId);
        if (!connector) throw new Error("Document connector unavailable: " + descriptorId);
        return connector.getTemplate(descriptorId);
      },
      specialHandler: async function (payload) {
        return root.SchoolSafeSchoolPedagogyDocuments.openCardPreparation(payload.user);
      },
      schoolIdentityProvider: schoolIdentityProvider(),
      schoolSafeIdentityProvider: engine.createSchoolSafeIdentityProvider({ noCache: false }),
    });

    root.SchoolSafeDocumentActions = actions;
    root.SchoolSafeDocumentCenter.setActionHandler(function (event) {
      actions.executeById({
        descriptorId: event.descriptor.id,
        action: event.action,
        user: event.user,
      }).then(function (result) {
        if (!result.ok && root.console && typeof root.console.warn === "function") {
          root.console.warn("[SchoolSafe][Documents] Action refusée:", result.error);
        }
      });
    });
    return actions;
  }

  root.SchoolSafeDocumentActionsReady = initialize();
}(window));
