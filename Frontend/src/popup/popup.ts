import { HOLDINGS } from "./data";
import { AnalysisResult, ArticleScanPayload } from "../types";

const DESKTOP_URL = "http://localhost:8080";

// --- Render holdings list ---
const holdingsList = document.getElementById("holdings-list")!;
HOLDINGS.forEach((stock) => {
  const li = document.createElement("li");
  li.className = "holding-item";
  li.innerHTML = `
    <span class="ticker">${stock.ticker}</span>
    <span class="holding-details">${stock.shares} shares @ $${stock.avgBuyPrice.toFixed(2)}</span>
  `;
  holdingsList.appendChild(li);
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

// --- Check page type and desktop health in parallel ---
async function init() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;

  const [pageResponse, isHealthy] = await Promise.all([
    browser.tabs.sendMessage(tab.id, { type: "IS_FINANCIAL_PAGE" }).catch(() => null),
    checkHealth(),
  ]);

  // Health status
  if (isHealthy) {
    healthIndicator.textContent = "Desktop app connected";
    healthIndicator.className = "health-ok";
  } else {
    healthIndicator.textContent = "Desktop app offline";
    healthIndicator.className = "health-offline";
  }

  // Page detection
  if (pageResponse?.isFinancial) {
    scanBtn.disabled = false;
    setStatus("Financial article detected — ready to scan.", "info");
  } else {
    setStatus("No financial article detected on this page.", "muted");
  }
}

init();

// --- Scan button ---
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
  } catch (err) {
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

  const sentimentLabel = {
    positive: "Positive",
    negative: "Negative",
    neutral: "Neutral",
  }[result.sentiment];

  const sentimentClass = `sentiment-${result.sentiment}`;

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
