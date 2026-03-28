"use strict";
(() => {
  // src/content/content.ts
  var FINANCIAL_KEYWORDS = [
    "stock",
    "shares",
    "earnings",
    "revenue",
    "nasdaq",
    "nyse",
    "market cap",
    "dividend",
    "investor",
    "portfolio",
    "quarter",
    "sec filing",
    "ipo",
    "valuation",
    "equity",
    "bull market",
    "bear market",
    "hedge fund",
    "short selling",
    "options",
    "futures",
    "trading volume",
    "price target",
    "analyst",
    "guidance",
    "fiscal",
    "ebitda",
    "diesel"
  ];
  function isFinancialPage() {
    const text = document.body.innerText.toLowerCase();
    const matchCount = FINANCIAL_KEYWORDS.filter((kw) => text.includes(kw)).length;
    return matchCount >= 3;
  }
  function extractArticleText() {
    const container = document.querySelector("article") ?? document.querySelector('[role="article"]') ?? document.querySelector("main") ?? document.querySelector('[role="main"]') ?? document.body;
    const clone = container.cloneNode(true);
    clone.querySelectorAll("script, style, nav, footer, header, aside, [role='navigation'], [role='banner'], [role='complementary'], .ad, .advertisement, .sidebar").forEach((el) => el.remove());
    const text = clone.innerText.replace(/\n{3,}/g, "\n\n").trim().slice(0, 8e3);
    return text;
  }
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "IS_FINANCIAL_PAGE") {
      return Promise.resolve({ isFinancial: isFinancialPage() });
    }
    if (message.type === "EXTRACT_ARTICLE") {
      return Promise.resolve({ text: extractArticleText() });
    }
    return false;
  });
})();
//# sourceMappingURL=content.js.map
