"use strict";
(() => {
  // src/background/background.ts
  browser.runtime.onInstalled.addListener(() => {
    console.log("[Yield] Extension installed.");
  });
})();
//# sourceMappingURL=background.js.map
