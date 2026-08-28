// SchoolSafe V2 — Phase I — Stock / Inventaire frontend de démonstration uniquement.
(function (root) {
  "use strict";

  var activeTab = "dashboard";
  var sessionOverride = null;
  var ITEM_DRAFTS_STORAGE_KEY = "schoolsafe-v2-inventory-item-drafts";
  var ITEMS = [
    { code: "ART-001", name: "Papier A4", category: "Fournitures administratives", unit: "rame", type: "CONSOMMABLE", status: "ACTIF", service: "Administration" },
    { code: "ART-002", name: "Craie blanche", category: "Fournitures pédagogiques", unit: "boîte", type: "CONSOMMABLE", status: "ACTIF", service: "Pédagogie" },
    { code: "ART-003", name: "Marqueurs effaçables", category: "Fournitures pédagogiques", unit: "lot", type: "CONSOMMABLE", status: "ACTIF", service: "Pédagogie" },
    { code: "ART-004", name: "Détergent multiusage", category: "Produits de nettoyage", unit: "litre", type: "CONSOMMABLE", status: "ACTIF", service: "Entretien" },
    { code: "ART-005", name: "Ordinateur portable démo", category: "Matériel informatique", unit: "pièce", type: "ÉQUIPEMENT", status: "À CONTRÔLER", service: "Administration" },
    { code: "ART-006", name: "Farine de maïs", category: "Ingrédients Cantine", unit: "sac", type: "CONSOMMABLE", status: "ACTIF", service: "Cantine" }
  ];
  var LEVELS = [
    { item: "ART-001", name: "Papier A4", location: "Magasin central", quantity: 28, unit: "rame", minimum: 10 },
    { item: "ART-001", name: "Papier A4", location: "Secrétariat", quantity: 4, unit: "rame", minimum: 6 },
    { item: "ART-002", name: "Craie blanche", location: "Dépôt pédagogique", quantity: 0, unit: "boîte", minimum: 8 },
    { item: "ART-003", name: "Marqueurs effaçables", location: "Salle des professeurs", quantity: 12, unit: "lot", minimum: 5 },
    { item: "ART-004", name: "Détergent multiusage", location: "Local entretien", quantity: 6, unit: "litre", minimum: 6 },
    { item: "ART-005", name: "Ordinateur portable démo", location: "Bureau informatique", quantity: 3, unit: "pièce", minimum: 1, control: true },
    { item: "ART-006", name: "Farine de maïs", location: "Réserve Cantine", quantity: 9, unit: "sac", minimum: 4 }
  ];
  var METRICS = [
    ["Articles", "12 références démo", "boxes"],
    ["Catégories", "5 familles", "tags"],
    ["Emplacements", "4 zones", "warehouse"],
    ["Alertes seuil", "3 à examiner", "triangle-alert"],
    ["Ruptures", "1 simulation", "package-x"],
    ["Mouvements récents", "8 opérations démo", "arrow-left-right"],
    ["Demandes d’achat", "3 brouillons", "clipboard-list"],
    ["Commandes", "2 simulations", "shopping-cart"],
    ["Réceptions", "2 contrôles", "package-check"],
    ["Anomalies", "1 à rapprocher", "badge-alert"]
  ];

  function escapeMarkup(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function user() {
    if (sessionOverride) return sessionOverride;
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.getCurrentUser === "function") return root.SchoolSafeAppContext.getCurrentUser();
    return { permissions: [], scopes: [] };
  }

  function isDemoMode(subject) { return !(subject && subject.token); }

  function canReadAggregates(subject) {
    var access = root.SchoolSafeAccess;
    return !!(access && typeof access.allowsScope === "function" && access.allowsScope(subject || user(), "reports.operational.read", "school"));
  }

  function readDraftList(key) {
    try {
      var parsed = JSON.parse(root.localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) { return []; }
  }

  function persistDraftList(key, drafts) {
    try { root.localStorage.setItem(key, JSON.stringify(drafts)); } catch (error) {}
  }

  var itemDrafts = readDraftList(ITEM_DRAFTS_STORAGE_KEY);

  function metric(item, live) {
    return '<article class="inventory-dashboard-metric"><span><i data-lucide="' + item[2] + '"></i></span><div><small>' + escapeMarkup(item[0]) + '</small><b>' + escapeMarkup(live ? "Agrégat disponible" : item[1]) + "</b></div></article>";
  }

  function renderDemoDashboard() {
    return '<section class="inventory-dashboard" data-inventory-dashboard><header><div><span>Stock / Inventaire / Achats internes</span><h3>Vue opérationnelle générique</h3><p>Données fictives destinées à valider les parcours frontend, sans écriture officielle.</p></div><span class="inventory-boundary-chip">DÉMONSTRATION · BACKEND_LATER</span></header><aside class="inventory-boundary"><i data-lucide="shield-check"></i><p>Moteur Stock unique · les besoins Cantine réutiliseront ce référentiel sans dupliquer le domaine.</p></aside><div class="inventory-dashboard-grid">' + METRICS.map(function (item) { return metric(item, false); }).join("") + "</div></section>";
  }

  function renderLiveAggregates() {
    return '<section class="inventory-dashboard inventory-live" data-inventory-live-aggregates><header><div><span>AGRÉGATS AUTORISÉS</span><h3>Lecture opérationnelle consolidée</h3><p>Aucun détail opérationnel, article, mouvement ou formulaire n’est exposé dans cette session.</p></div><span class="inventory-boundary-chip">LECTURE SEULE · school</span></header><div class="inventory-dashboard-grid">' + METRICS.map(function (item) { return metric(item, true); }).join("") + "</div></section>";
  }

  function renderDenied() {
    var state = typeof root.ssState === "function" ? root.ssState({ type: "error", title: "Stock non autorisé", message: "reports.operational.read avec portée school est obligatoire en session réelle.", details: "DENY explicite prioritaire · aucun détail Stock n’est révélé." }) : "<h3>Stock non autorisé</h3>";
    return '<section class="inventory-denied">' + state + "</section>";
  }

  function renderFuture(tab) {
    var labels = { catalog: "Catalogue articles", levels: "Niveaux et seuils", movements: "Mouvements", procurement: "Achats internes", receipts: "Réceptions et anomalies", reports: "Rapports Stock" };
    return '<section class="inventory-future"><span>FEATURE_LATER</span><h3>' + escapeMarkup(labels[tab] || "Stock") + '</h3><p>Ce parcours sera activé dans son lot Phase I dédié.</p><small>FRONTEND UNIQUEMENT · BACKEND_LATER</small></section>';
  }

  function renderItemRow(item, draft) {
    return '<tr data-inventory-item' + (draft ? '-draft' : '') + '><td><b>' + escapeMarkup(item.code) + '</b>' + (draft ? '<small>BROUILLON LOCAL · BACKEND_LATER</small>' : '<small>DONNÉE DÉMO</small>') + '</td><td>' + escapeMarkup(item.name) + '</td><td>' + escapeMarkup(item.category) + '</td><td>' + escapeMarkup(item.unit) + '</td><td>' + escapeMarkup(item.type) + '</td><td>' + escapeMarkup(item.status) + '</td><td>' + escapeMarkup(item.service || "Tous services") + '</td></tr>';
  }

  function renderCatalog() {
    var rows = ITEMS.map(function (item) { return renderItemRow(item, false); }).concat(itemDrafts.map(function (item) { return renderItemRow(item, true); })).join("");
    return '<section class="inventory-catalog" data-inventory-catalog><header><div><span>Catalogue générique</span><h3>Articles et catégories</h3><p>Les catégories et services restent libres : aucune enum métier fermée.</p></div><span class="inventory-boundary-chip">DÉMONSTRATION · BACKEND_LATER</span></header><div class="inventory-table-wrap"><table><thead><tr><th>Code article</th><th>Nom</th><th>Catégorie</th><th>Unité</th><th>Type</th><th>Statut</th><th>Service principal</th></tr></thead><tbody>' + rows + '</tbody></table></div><form class="inventory-form" data-inventory-item-form><header><div><span>Préparation locale</span><h4>Ajouter un article générique</h4></div><span class="inventory-boundary-chip">BROUILLON LOCAL</span></header><label>Code article<input name="code" required placeholder="ART-..."></label><label>Nom<input name="name" required></label><label>Catégorie libre<input name="category" required list="inventoryCategorySuggestions"></label><datalist id="inventoryCategorySuggestions"><option value="Fournitures administratives"><option value="Produits de nettoyage"><option value="Matériel informatique"><option value="Ingrédients Cantine"></datalist><label>Unité libre<input name="unit" required placeholder="pièce, kg, litre..."></label><label>Type<select name="type"><option>CONSOMMABLE</option><option>ÉQUIPEMENT</option></select></label><label>Statut<select name="status"><option>ACTIF</option><option>INACTIF</option><option>À CONTRÔLER</option></select></label><label>Service principal éventuel<input name="service" placeholder="Tous services"></label><button class="ss-button ss-button--primary" type="submit">Préparer l’article</button><p class="inventory-form-wide">Aucune création officielle · navigateur non source de vérité · BACKEND_LATER.</p></form></section>';
  }

  function levelState(level) {
    if (level.control) return "À CONTRÔLER";
    if (level.quantity === 0) return "RUPTURE";
    if (level.quantity <= level.minimum) return "BAS";
    return "NORMAL";
  }

  function renderLevels() {
    var rows = LEVELS.map(function (level) {
      var state = levelState(level);
      return '<tr data-level-item="' + escapeMarkup(level.item) + '"><td><b>' + escapeMarkup(level.item) + '</b><small>' + escapeMarkup(level.name) + '</small></td><td>' + escapeMarkup(level.location) + '</td><td data-level-quantity="' + Math.max(0, Number(level.quantity) || 0) + '">' + Math.max(0, Number(level.quantity) || 0) + '</td><td>' + escapeMarkup(level.unit) + '</td><td>' + Math.max(0, Number(level.minimum) || 0) + '</td><td><span class="inventory-level-state inventory-level-state--' + state.toLowerCase().replace(/[^a-z]+/g, "-") + '">' + state + '</span></td></tr>';
    }).join("");
    return '<section class="inventory-levels" data-inventory-levels><header><div><span>Inventaire théorique de démonstration</span><h3>Emplacements et seuils</h3><p>Un article peut exister dans plusieurs emplacements. Le navigateur n’est pas la source officielle du stock.</p></div><span class="inventory-boundary-chip">DÉMONSTRATION · BACKEND_LATER</span></header><aside class="inventory-boundary"><i data-lucide="shield-alert"></i><p>Quantités bornées à zéro · aucune correction silencieuse ni stock négatif automatique.</p></aside><div class="inventory-level-legend"><span>NORMAL</span><span>BAS</span><span>RUPTURE</span><span>À CONTRÔLER</span></div><div class="inventory-table-wrap"><table><thead><tr><th>Article</th><th>Emplacement</th><th>Quantité théorique</th><th>Unité</th><th>Seuil minimum</th><th>État</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function bindCatalogEvents() {
    var form = document.querySelector("[data-inventory-item-form]");
    if (!form || form.__inventoryBound) return;
    form.__inventoryBound = true;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = new FormData(form);
      itemDrafts = itemDrafts.concat([{
        code: String(data.get("code") || "").trim(), name: String(data.get("name") || "").trim(),
        category: String(data.get("category") || "").trim(), unit: String(data.get("unit") || "").trim(),
        type: String(data.get("type") || "CONSOMMABLE"), status: String(data.get("status") || "ACTIF"),
        service: String(data.get("service") || "").trim()
      }]);
      persistDraftList(ITEM_DRAFTS_STORAGE_KEY, itemDrafts);
      renderContent();
    });
  }

  function refreshTabs() {
    document.querySelectorAll("[data-inventory-tab]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-inventory-tab") === activeTab);
    });
  }

  function renderContent() {
    var content = document.getElementById("inventoryContent");
    if (!content) return;
    var subject = user();
    if (activeTab === "catalog") content.innerHTML = isDemoMode(subject) ? renderCatalog() : renderDenied();
    else if (activeTab === "levels") content.innerHTML = isDemoMode(subject) ? renderLevels() : renderDenied();
    else if (activeTab !== "dashboard") content.innerHTML = isDemoMode(subject) ? renderFuture(activeTab) : (canReadAggregates(subject) && activeTab === "reports" ? renderLiveAggregates() : renderDenied());
    else content.innerHTML = isDemoMode(subject) ? renderDemoDashboard() : (canReadAggregates(subject) ? renderLiveAggregates() : renderDenied());
    refreshTabs();
    if (activeTab === "catalog" && isDemoMode(subject)) bindCatalogEvents();
    if (root.lucide && typeof root.lucide.createIcons === "function") root.lucide.createIcons();
  }

  function bindEvents() {
    document.querySelectorAll("[data-inventory-tab]").forEach(function (button) {
      if (button.__inventoryBound) return;
      button.__inventoryBound = true;
      button.addEventListener("click", function () { open(button.getAttribute("data-inventory-tab")); });
    });
  }

  function render(containerId) {
    var module = document.getElementById(containerId || "inventoryModule");
    if (!module) return;
    module.hidden = false;
    activeTab = "dashboard";
    bindEvents();
    renderContent();
  }

  function open(tab) {
    activeTab = tab || "dashboard";
    renderContent();
  }

  function close() {
    var module = document.getElementById("inventoryModule");
    if (module) module.hidden = true;
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.showDashboard === "function") root.SchoolSafeAppContext.showDashboard();
  }

  function setSession(session) { sessionOverride = session || null; }

  root.SchoolSafeInventoryDemo = {
    render: render,
    open: open,
    close: close,
    setSession: setSession,
    isDemoMode: isDemoMode,
    canReadAggregates: canReadAggregates
  };
})(window);
