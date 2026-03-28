import { HOLDINGS, StockWithPrice } from "./data";
import { AnalysisResult, ArticleScanPayload } from "../types";

const DESKTOP_URL = "http://localhost:8080";

// --- Sparkline renderer (SVG, no deps) ---
function renderSparkline(prices: number[], positive: boolean): SVGSVGElement {
  const W = 72, H = 28;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const pts = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * W;
      const y = H - ((p - min) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const color = positive ? "#4ade80" : "#f87171";
  const fillColor = positive ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)";

  // Build fill path: line down to baseline and back
  const firstX = "0";
  const lastX = W.toFixed(1);
  const baseline = H.toFixed(1);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  // Area fill
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

  // Line
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", pts);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "1.5");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  svg.appendChild(line);

  // Endpoint dot
  const [ex, ey] = lastPt.split(",");
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", ex);
  dot.setAttribute("cy", ey);
  dot.setAttribute("r", "2");
  dot.setAttribute("fill", color);
  svg.appendChild(dot);

  return svg;
}

// --- Render holdings ---
const holdingsList = document.getElementById("holdings-list")!;

HOLDINGS.forEach((stock) => {
  const pnl = (stock.currentPrice - stock.avgBuyPrice) * stock.shares;
  const pnlPct = ((stock.currentPrice - stock.avgBuyPrice) / stock.avgBuyPrice) * 100;
  const positive = pnl >= 0;
  const pnlSign = positive ? "+" : "";
  const pnlClass = positive ? "pos" : "neg";

  const li = document.createElement("li");
  li.className = `holding-item ${positive ? "holding-pos" : "holding-neg"}`;

  // Left: ticker + meta
  const left = document.createElement("div");
  left.className = "holding-left";
  left.innerHTML = `
    <span class="ticker">${stock.ticker}</span>
    <span class="holding-meta">${stock.shares} sh · $${stock.avgBuyPrice.toFixed(2)}</span>
  `;

  // Middle: sparkline
  const mid = document.createElement("div");
  mid.className = "holding-spark";
  mid.appendChild(renderSparkline(stock.priceHistory, positive));

  // Right: price + pnl
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

// --- Portfolio summary ---
const totalCost = HOLDINGS.reduce((s, h) => s + h.avgBuyPrice * h.shares, 0);
const totalValue = HOLDINGS.reduce((s, h) => s + h.currentPrice * h.shares, 0);
const totalPnl = totalValue - totalCost;
const totalPct = (totalPnl / totalCost) * 100;
const portfolioPositive = totalPnl >= 0;

const summaryEl = document.getElementById("portfolio-summary")!;
summaryEl.innerHTML = `
  <span class="summary-value">$${totalValue.toFixed(2)}</span>
  <span class="summary-pnl ${portfolioPositive ? "pos" : "neg"}">
    ${portfolioPositive ? "+" : ""}$${Math.abs(totalPnl).toFixed(2)} (${portfolioPositive ? "+" : ""}${totalPct.toFixed(1)}%)
  </span>
`;

// --- View toggle (graph / compact) ---
const viewToggle = document.getElementById("view-toggle") as HTMLButtonElement;
const iconGraph = document.getElementById("icon-graph") as SVGElement;
const iconCompact = document.getElementById("icon-compact") as SVGElement;

let graphMode = true;

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
  graphMode = r.graphMode !== false; // default true
  applyViewMode();
});

viewToggle.addEventListener("click", () => {
  graphMode = !graphMode;
  browser.storage.local.set({ graphMode });
  applyViewMode();
});

// --- DOM refs ---
const scanBtn = document.getElementById("scan-btn") as HTMLButtonElement;
const scanStatus = document.getElementById("scan-status")!;
const resultSection = document.getElementById("result-section")!;
const resultContent = document.getElementById("result-content")!;
const healthIndicator = document.getElementById("health-indicator")!;

// --- Check if desktop app is reachable ---
async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${DESKTOP_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Init ---
async function init() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;

  const [pageResponse, isHealthy] = await Promise.all([
    browser.tabs.sendMessage(tab.id, { type: "IS_FINANCIAL_PAGE" }).catch(() => null),
    checkHealth(),
  ]);

  healthIndicator.textContent = isHealthy ? "Connected" : "Offline";
  healthIndicator.className = isHealthy ? "health-ok" : "health-offline";

  if (pageResponse?.isFinancial) {
    scanBtn.disabled = false;
    setStatus("Financial article detected — ready to scan.", "info");
  } else {
    setStatus("No financial article detected on this page.", "muted");
  }
}

init();

// --- Scan ---
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

  let extractResponse: { text: string } | null = null;
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

  const payload: ArticleScanPayload = {
    url: tab.url ?? "",
    title: tab.title ?? "",
    body: extractResponse.text,
    holdings: HOLDINGS,
  };

  setStatus("Sending to desktop app for analysis...", "info");

  try {
    const res = await fetch(`${DESKTOP_URL}/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Server responded with ${res.status}`);

    const result: AnalysisResult = await res.json();
    renderResult(result);
    setStatus("Analysis complete.", "success");
  } catch {
    setStatus("Could not reach desktop app. Is it running on port 8080?", "error");
    scanBtn.disabled = false;
  }
});

function setStatus(msg: string, type: "info" | "muted" | "error" | "success") {
  scanStatus.textContent = msg;
  scanStatus.className = `status-${type}`;
}

function renderResult(result: AnalysisResult) {
  resultSection.hidden = false;
  const sentimentClass = `sentiment-${result.sentiment}`;
  const sentimentLabel = result.sentiment.charAt(0).toUpperCase() + result.sentiment.slice(1);

  const impactRows =
    result.impactDetails.length > 0
      ? result.impactDetails
          .map(
            (d) => `
          <li class="impact-item">
            <span class="ticker">${d.ticker}</span>
            <span class="impact-sentiment impact-${d.sentiment}">${d.sentiment}</span>
            <p class="impact-reasoning">${d.reasoning}</p>
          </li>`
          )
          .join("")
      : "<li class='muted'>No specific holdings mentioned.</li>";

  resultContent.innerHTML = `
    <div class="result-header">
      <span class="overall-sentiment ${sentimentClass}">${sentimentLabel}</span>
    </div>
    <p class="result-summary">${result.summary}</p>
    <h3>Impact on Your Holdings</h3>
    <ul class="impact-list">${impactRows}</ul>
  `;
}
