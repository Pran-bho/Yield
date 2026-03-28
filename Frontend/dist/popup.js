"use strict";
(() => {
  // src/popup/data.ts
  function makeRng(seed) {
    let s = seed;
    return () => {
      s |= 0;
      s = s + 1831565813 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function normalPair(rand) {
    const u1 = Math.max(rand(), 1e-10);
    const u2 = rand();
    const mag = Math.sqrt(-2 * Math.log(u1));
    return [mag * Math.cos(2 * Math.PI * u2), mag * Math.sin(2 * Math.PI * u2)];
  }
  function gbm(start, days, drift, vol, seed) {
    const rand = makeRng(seed);
    const prices = [start];
    for (let i = 1; i < days; i++) {
      const [z] = normalPair(rand);
      const prev = prices[i - 1];
      prices.push(prev * Math.exp(drift - 0.5 * vol * vol + vol * z));
    }
    return prices.map((p) => Math.round(p * 100) / 100);
  }
  var DAYS = 30;
  var HOLDINGS = [
    {
      ticker: "AAPL",
      name: "Apple Inc.",
      shares: 10,
      avgBuyPrice: 145,
      // mild upward drift, moderate vol (~1.4%/day)
      priceHistory: gbm(163.5, DAYS, 6e-4, 0.014, 1001),
      get currentPrice() {
        return this.priceHistory[this.priceHistory.length - 1];
      }
    },
    {
      ticker: "NVDA",
      name: "NVIDIA Corp.",
      shares: 5,
      avgBuyPrice: 410,
      // strong upward drift, high vol (~2.5%/day)
      priceHistory: gbm(740, DAYS, 18e-4, 0.025, 2002),
      get currentPrice() {
        return this.priceHistory[this.priceHistory.length - 1];
      }
    },
    {
      ticker: "MSFT",
      name: "Microsoft Corp.",
      shares: 8,
      avgBuyPrice: 290,
      // mild upward drift, low vol (~1.1%/day)
      priceHistory: gbm(382, DAYS, 7e-4, 0.011, 3003),
      get currentPrice() {
        return this.priceHistory[this.priceHistory.length - 1];
      }
    },
    {
      ticker: "TSLA",
      name: "Tesla Inc.",
      shares: 3,
      avgBuyPrice: 220,
      // slight downward drift, very high vol (~3.0%/day) — ends underwater
      priceHistory: gbm(210, DAYS, -12e-4, 0.03, 4004),
      get currentPrice() {
        return this.priceHistory[this.priceHistory.length - 1];
      }
    }
  ];

  // src/popup/popup.ts
  var DESKTOP_URL = "http://localhost:8080";
  function renderSparkline(prices, positive) {
    const W = 72, H = 28;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const pts = prices.map((p, i) => {
      const x = i / (prices.length - 1) * W;
      const y = H - (p - min) / range * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const color = positive ? "#4ade80" : "#f87171";
    const fillColor = positive ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)";
    const firstX = "0";
    const lastX = W.toFixed(1);
    const baseline = H.toFixed(1);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const area = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    const firstPt = pts.split(" ")[0];
    const lastPt = pts.split(" ").slice(-1)[0];
    area.setAttribute(
      "points",
      `${firstX},${baseline} ${pts} ${lastX},${baseline}`
    );
    area.setAttribute("fill", fillColor);
    area.setAttribute("stroke", "none");
    svg.appendChild(area);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    line.setAttribute("points", pts);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");
    svg.appendChild(line);
    const [ex, ey] = lastPt.split(",");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", ex);
    dot.setAttribute("cy", ey);
    dot.setAttribute("r", "2");
    dot.setAttribute("fill", color);
    svg.appendChild(dot);
    return svg;
  }
  var holdingsList = document.getElementById("holdings-list");
  HOLDINGS.forEach((stock) => {
    const pnl = (stock.currentPrice - stock.avgBuyPrice) * stock.shares;
    const pnlPct = (stock.currentPrice - stock.avgBuyPrice) / stock.avgBuyPrice * 100;
    const positive = pnl >= 0;
    const pnlSign = positive ? "+" : "";
    const pnlClass = positive ? "pos" : "neg";
    const li = document.createElement("li");
    li.className = `holding-item ${positive ? "holding-pos" : "holding-neg"}`;
    const left = document.createElement("div");
    left.className = "holding-left";
    left.innerHTML = `
    <span class="ticker">${stock.ticker}</span>
    <span class="holding-meta">${stock.shares} sh \xB7 $${stock.avgBuyPrice.toFixed(2)}</span>
  `;
    const mid = document.createElement("div");
    mid.className = "holding-spark";
    mid.appendChild(renderSparkline(stock.priceHistory, positive));
    const right = document.createElement("div");
    right.className = "holding-right";
    right.innerHTML = `
    <span class="current-price">$${stock.currentPrice.toFixed(2)}</span>
    <span class="pnl ${pnlClass}">${pnlSign}$${Math.abs(pnl).toFixed(0)} (${pnlSign}${pnlPct.toFixed(1)}%)</span>
  `;
    li.appendChild(left);
    li.appendChild(mid);
    li.appendChild(right);
    holdingsList.appendChild(li);
  });
  var totalCost = HOLDINGS.reduce((s, h) => s + h.avgBuyPrice * h.shares, 0);
  var totalValue = HOLDINGS.reduce((s, h) => s + h.currentPrice * h.shares, 0);
  var totalPnl = totalValue - totalCost;
  var totalPct = totalPnl / totalCost * 100;
  var portfolioPositive = totalPnl >= 0;
  var summaryEl = document.getElementById("portfolio-summary");
  summaryEl.innerHTML = `
  <span class="summary-value">$${totalValue.toFixed(2)}</span>
  <span class="summary-pnl ${portfolioPositive ? "pos" : "neg"}">
    ${portfolioPositive ? "+" : ""}$${Math.abs(totalPnl).toFixed(2)} (${portfolioPositive ? "+" : ""}${totalPct.toFixed(1)}%)
  </span>
`;
  var viewToggle = document.getElementById("view-toggle");
  var iconGraph = document.getElementById("icon-graph");
  var iconCompact = document.getElementById("icon-compact");
  var graphMode = true;
  function applyViewMode() {
    if (graphMode) {
      holdingsList.classList.remove("compact-mode");
      iconGraph.hidden = false;
      iconCompact.hidden = true;
      viewToggle.title = "Switch to compact";
    } else {
      holdingsList.classList.add("compact-mode");
      iconGraph.hidden = true;
      iconCompact.hidden = false;
      viewToggle.title = "Switch to graph";
    }
  }
  browser.storage.local.get("graphMode").then((r) => {
    graphMode = r.graphMode !== false;
    applyViewMode();
  });
  viewToggle.addEventListener("click", () => {
    graphMode = !graphMode;
    browser.storage.local.set({ graphMode });
    applyViewMode();
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
    const isHealthy = await checkHealth();
    healthIndicator.textContent = isHealthy ? "Connected" : "Offline";
    healthIndicator.className = isHealthy ? "health-ok" : "health-offline";
    scanBtn.disabled = false;
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
    } catch {
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
    const sentimentClass = `sentiment-${result.sentiment}`;
    const sentimentLabel = result.sentiment.charAt(0).toUpperCase() + result.sentiment.slice(1);
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
