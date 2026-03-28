import { Holding, AnalyseResponse, ImpactDetail, NewsArticle } from "../types";

const API = "http://localhost:8000";

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

let holdings: Holding[] = [];
let newsLoaded = false;

// ─────────────────────────────────────────────
// DOM refs
// ─────────────────────────────────────────────

const engineDot      = document.getElementById("engineDot")!;
const scanBtn        = document.getElementById("scanBtn") as HTMLButtonElement;
const statusEl       = document.getElementById("status")!;
const resultsEl      = document.getElementById("results")!;
const summaryEl      = document.getElementById("summaryText")!;
const chipsWrap      = document.getElementById("chipsWrap")!;
const chipsEl        = document.getElementById("chips")!;
const footerTime     = document.getElementById("footerTime")!;
const newsList       = document.getElementById("newsList")!;
const newsRefreshBtn = document.getElementById("newsRefreshBtn") as HTMLButtonElement;

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  footerTime.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  await loadHoldings();
  checkEngine();

  document.querySelectorAll<HTMLElement>(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      if (target) target.classList.add("active");

      if (tab.dataset.tab === "news" && !newsLoaded) {
        loadNews();
      }
    });
  });

  scanBtn.addEventListener("click", handleScan);
  newsRefreshBtn.addEventListener("click", () => {
    newsLoaded = false;
    loadNews();
  });
});

// ─────────────────────────────────────────────
// Engine health
// ─────────────────────────────────────────────

async function checkEngine(): Promise<void> {
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      engineDot.classList.add("live");
      engineDot.title = "Engine live";
    } else {
      engineDot.classList.add("dead");
    }
  } catch {
    engineDot.classList.add("dead");
    engineDot.title = "Engine offline — is uvicorn running on :8000?";
  }
}

// ─────────────────────────────────────────────
// Holdings (read-only from storage)
// ─────────────────────────────────────────────

async function loadHoldings(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["holdings"], (result) => {
      if (result["holdings"] && Array.isArray(result["holdings"])) {
        holdings = result["holdings"];
      } else {
        holdings = [
          { ticker: "AAPL", name: "Apple Inc.",      shares: 10, avgBuyPrice: 145.0 },
          { ticker: "NVDA", name: "NVIDIA Corp.",    shares: 5,  avgBuyPrice: 410.0 },
          { ticker: "MSFT", name: "Microsoft Corp.", shares: 8,  avgBuyPrice: 290.0 },
          { ticker: "TSLA", name: "Tesla Inc.",      shares: 3,  avgBuyPrice: 220.0 },
        ];
        chrome.storage.local.set({ holdings });
      }
      resolve();
    });
  });
}

// ─────────────────────────────────────────────
// Scan
// ─────────────────────────────────────────────

async function handleScan(): Promise<void> {
  scanBtn.disabled = true;
  resultsEl.style.display = "none";
  setStatus("extracting article…", true);

  let article: { title: string; body: string } | null = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    article = await chrome.tabs.sendMessage(tab.id!, { type: "EXTRACT_ARTICLE" });
  } catch {
    setStatus("Could not read page. Try refreshing.");
    scanBtn.disabled = false;
    return;
  }

  if (!article?.title && !article?.body) {
    setStatus("No readable content found on this page.");
    scanBtn.disabled = false;
    return;
  }

  setStatus("running analysis…", true);

  let result: AnalyseResponse | null = null;
  try {
    const r = await fetch(`${API}/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "",
        title: article.title,
        body: article.body,
        holdings: holdings,
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    result = await r.json();
  } catch (e: any) {
    setStatus(`API error: ${e.message}`);
    scanBtn.disabled = false;
    return;
  }

  if (result) renderResults(result);
  setStatus("");
  scanBtn.disabled = false;
}

// ─────────────────────────────────────────────
// Render results
// ─────────────────────────────────────────────

function renderResults(result: AnalyseResponse): void {
  summaryEl.innerHTML = `${sentimentBadge(result.sentiment)}&nbsp; ${escHtml(result.summary)}`;

  if (result.impactDetails.length > 0) {
    chipsEl.innerHTML = result.impactDetails
      .map((d: ImpactDetail) => {
        const icon = d.sentiment === "positive" ? "▲" : d.sentiment === "negative" ? "▼" : "—";
        const confPct = d.confidence !== undefined ? Math.round(d.confidence * 100) : null;
        const confBadge = confPct !== null ? `<span class="conf">${confPct}%</span>` : "";
        return `<div class="chip ${d.sentiment}"><span class="chip-icon">${icon}</span>${escHtml(d.ticker)}${confBadge}</div>`;
      })
      .join("");
    chipsWrap.style.display = "block";
  } else {
    chipsWrap.style.display = "none";
  }

  resultsEl.style.display = "block";
}

// ─────────────────────────────────────────────
// News tab
// ─────────────────────────────────────────────

async function loadNews(): Promise<void> {
  newsLoaded = true;
  newsList.innerHTML = `<div class="news-list-inner"><div class="status"><span class="spinner"></span>fetching news…</div></div>`;

  const tickers = holdings.map((h) => h.ticker).join(",");
  if (!tickers) {
    newsList.innerHTML = `<div class="news-list-inner"><div class="empty">No holdings configured.</div></div>`;
    return;
  }

  try {
    const r = await fetch(`${API}/news?tickers=${encodeURIComponent(tickers)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const articles: NewsArticle[] = data.articles || [];

    if (articles.length === 0) {
      newsList.innerHTML = `<div class="news-list-inner"><div class="empty">No recent news found.</div></div>`;
      return;
    }

    const cards = articles
      .map(
        (a) => `
        <div class="news-card">
          <div class="news-card-top">
            <span class="news-ticker-badge">${escHtml(a.ticker)}</span>
            <span class="news-time">${timeAgo(a.publishedAt)}</span>
          </div>
          <div class="news-title">${escHtml(a.title)}</div>
          <div class="news-card-bottom">
            <span class="news-source">${escHtml(a.source)}</span>
            <button class="news-open-btn" data-url="${escAttr(a.url)}">↗ open</button>
          </div>
        </div>`
      )
      .join("");

    newsList.innerHTML = `<div class="news-list-inner">${cards}</div>`;

    newsList.querySelectorAll<HTMLButtonElement>(".news-open-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });
  } catch {
    newsList.innerHTML = `<div class="news-list-inner"><div class="status">Failed to load news. Is the engine running?</div></div>`;
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function setStatus(msg: string, spinning = false): void {
  if (!msg) { statusEl.innerHTML = ""; return; }
  statusEl.innerHTML = spinning
    ? `<span class="spinner"></span>${escHtml(msg)}`
    : escHtml(msg);
}

function sentimentBadge(sentiment: string): string {
  const map: Record<string, string> = {
    positive: `<span class="badge positive">▲ POSITIVE</span>`,
    negative: `<span class="badge negative">▼ NEGATIVE</span>`,
    neutral:  `<span class="badge neutral">— NEUTRAL</span>`,
  };
  return map[sentiment] ?? map["neutral"];
}

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str: string): string {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
