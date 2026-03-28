"use strict";
(() => {
  // src/popup/data.ts
  var HOLDINGS = [
    { ticker: "AAPL", name: "Apple Inc.", shares: 10, avgBuyPrice: 145 },
    { ticker: "NVDA", name: "NVIDIA Corp.", shares: 5, avgBuyPrice: 410 },
    { ticker: "MSFT", name: "Microsoft Corp.", shares: 8, avgBuyPrice: 290 },
    { ticker: "TSLA", name: "Tesla Inc.", shares: 3, avgBuyPrice: 220 }
  ];

  // src/popup/popup.ts
  var DESKTOP_URL = "http://localhost:8080";
  var holdingsList = document.getElementById("holdings-list");
  HOLDINGS.forEach((stock) => {
    const li = document.createElement("li");
    li.className = "holding-item";
    li.innerHTML = `
    <span class="ticker">${stock.ticker}</span>
    <span class="holding-details">${stock.shares} shares @ $${stock.avgBuyPrice.toFixed(2)}</span>
  `;
    holdingsList.appendChild(li);
  });
  var scanBtn = document.getElementById("scan-btn");
  var scanStatus = document.getElementById("scan-status");
  var resultSection = document.getElementById("result-section");
  var resultContent = document.getElementById("result-content");
  var healthIndicator = document.getElementById("health-indicator");
  async function checkHealth() {
    try {
      const res = await fetch(`${DESKTOP_URL}/health`, { signal: AbortSignal.timeout(2e3) });
      return res.ok;
    } catch {
      return false;
    }
  }
  async function init() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab.id)
      return;
    const [pageResponse, isHealthy] = await Promise.all([
      browser.tabs.sendMessage(tab.id, { type: "IS_FINANCIAL_PAGE" }).catch(() => null),
      checkHealth()
    ]);
    if (isHealthy) {
      healthIndicator.textContent = "Desktop app connected";
      healthIndicator.className = "health-ok";
    } else {
      healthIndicator.textContent = "Desktop app offline";
      healthIndicator.className = "health-offline";
    }
    if (pageResponse?.isFinancial) {
      scanBtn.disabled = false;
      setStatus("Financial article detected \u2014 ready to scan.", "info");
    } else {
      setStatus("No financial article detected on this page.", "muted");
    }
  }
  init();
  scanBtn.addEventListener("click", async () => {
    scanBtn.disabled = true;
    setStatus("Extracting article text...", "info");
    resultSection.hidden = true;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      setStatus("Could not access current tab.", "error");
      scanBtn.disabled = false;
      return;
    }
    let extractResponse = null;
    try {
      extractResponse = await browser.tabs.sendMessage(tab.id, { type: "EXTRACT_ARTICLE" });
    } catch {
      setStatus("Could not extract page text. Try reloading the page.", "error");
      scanBtn.disabled = false;
      return;
    }
    if (!extractResponse?.text) {
      setStatus("No article text found on this page.", "error");
      scanBtn.disabled = false;
      return;
    }
    const payload = {
      url: tab.url ?? "",
      title: tab.title ?? "",
      body: extractResponse.text,
      holdings: HOLDINGS
    };
    setStatus("Sending to desktop app for analysis...", "info");
    try {
      const res = await fetch(`${DESKTOP_URL}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok)
        throw new Error(`Server responded with ${res.status}`);
      const result = await res.json();
      renderResult(result);
      setStatus("Analysis complete.", "success");
    } catch (err) {
      setStatus("Could not reach desktop app. Is it running on port 8080?", "error");
      scanBtn.disabled = false;
    }
  });
  function setStatus(msg, type) {
    scanStatus.textContent = msg;
    scanStatus.className = `status-${type}`;
  }
  function renderResult(result) {
    resultSection.hidden = false;
    const sentimentLabel = {
      positive: "Positive",
      negative: "Negative",
      neutral: "Neutral"
    }[result.sentiment];
    const sentimentClass = `sentiment-${result.sentiment}`;
    const impactRows = result.impactDetails.length > 0 ? result.impactDetails.map(
      (d) => `
          <li class="impact-item">
            <span class="ticker">${d.ticker}</span>
            <span class="impact-sentiment impact-${d.sentiment}">${d.sentiment}</span>
            <p class="impact-reasoning">${d.reasoning}</p>
          </li>`
    ).join("") : "<li class='muted'>No specific holdings mentioned.</li>";
    resultContent.innerHTML = `
    <div class="result-header">
      <span class="overall-sentiment ${sentimentClass}">${sentimentLabel}</span>
    </div>
    <p class="result-summary">${result.summary}</p>
    <h3>Impact on Your Holdings</h3>
    <ul class="impact-list">${impactRows}</ul>
  `;
  }
})();
//# sourceMappingURL=popup.js.map
