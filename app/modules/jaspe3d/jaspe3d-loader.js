(function (global) {
  "use strict";

  var EXPECTED_ACTIONS = ["Idle", "Wave", "TalkHandsOpen", "TalkPassionately", "Shrug", "Listening", "FormalBow", "Agree"];
  var diagnostics = {
    version: "2.0.0-schoolsafe",
    threeVersion: null,
    modelUrl: "./assets/jaspe3d/jaspe-web-v2.glb",
    expectedClipNames: EXPECTED_ACTIONS.slice(),
    clipNames: [],
    loaded: false,
    currentAction: null,
    instanceCount: 0,
    loadMs: null,
    fps: null,
    rendererInfo: null,
    framing: null,
    reducedMotion: false,
    errors: [],
  };
  var controller = null;
  var modulePromise = null;
  var latestHost = null;
  var pendingAction = "Idle";
  var pendingOptions = {};

  global.__SCHOOLSAFE_JASPE3D__ = diagnostics;

  function recordError(error) {
    var message = error && error.message ? error.message : String(error || "Erreur JASPE 3D inconnue");
    diagnostics.errors.push(message);
    diagnostics.loaded = false;
    diagnostics.instanceCount = 0;
    if (latestHost) {
      latestHost.classList.remove("is-loading", "is-ready");
      latestHost.classList.add("is-fallback");
    }
    return null;
  }

  function loadModule() {
    if (!modulePromise) {
      var moduleUrl = new URL("./modules/jaspe3d/jaspe3d-runtime.js", global.document.baseURI).href;
      modulePromise = import(moduleUrl).then(function (runtime) {
        controller = runtime.createJaspe3DController({
          diagnostics: diagnostics,
          expectedActions: EXPECTED_ACTIONS,
          modelUrl: diagnostics.modelUrl,
        });
        return controller;
      }).catch(recordError);
    }
    return modulePromise;
  }

  function mount(host) {
    if (!host) return Promise.resolve(null);
    latestHost = host;
    host.classList.add("is-loading");
    return loadModule().then(function (runtime) {
      if (!runtime || latestHost !== host) return runtime;
      return runtime.mount(host).then(function () {
        return runtime.play(pendingAction, pendingOptions);
      });
    }).catch(recordError);
  }

  function play(actionName, options) {
    if (EXPECTED_ACTIONS.indexOf(actionName) < 0) actionName = "Idle";
    pendingAction = actionName;
    pendingOptions = options || {};
    if (!controller) return Promise.resolve(false);
    return Promise.resolve(controller.play(actionName, pendingOptions));
  }

  function destroy() {
    latestHost = null;
    if (controller) controller.destroy();
    controller = null;
    modulePromise = null;
  }

  global.SchoolSafeJaspe3D = {
    EXPECTED_ACTIONS: EXPECTED_ACTIONS.slice(),
    mount: mount,
    play: play,
    destroy: destroy,
    getDiagnostics: function () { return diagnostics; },
  };
})(window);
