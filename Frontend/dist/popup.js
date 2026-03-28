"use strict";
(() => {
  // src/popup/popup.ts
  var API = "http://localhost:8000";
  var holdings = [];
  var newsLoaded = false;
  var engineDot = document.getElementById("engineDot");
  var scanBtn = document.getElementById("scanBtn");
  var statusEl = document.getElementById("status");
  var resultsEl = document.getElementById("results");
  var summaryEl = document.getElementById("summaryText");
  var chipsWrap = document.getElementById("chipsWrap");
  var chipsEl = document.getElementById("chips");
  var footerTime = document.getElementById("footerTime");
  var newsList = document.getElementById("newsList");
  var newsRefreshBtn = document.getElementById("newsRefreshBtn");
  document.addEventListener("DOMContentLoaded", async () => {
    footerTime.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    await loadHoldings();
    checkEngine();
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const target = document.getElementById(`tab-${tab.dataset.tab}`);
        if (target)
          target.classList.add("active");
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
  async function checkEngine() {
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2e3) });
      if (r.ok) {
        engineDot.classList.add("live");
        engineDot.title = "Engine live";
      } else {
        engineDot.classList.add("dead");
      }
    } catch {
      engineDot.classList.add("dead");
      engineDot.title = "Engine offline \u2014 is uvicorn running on :8000?";
    }
  }
  async function loadHoldings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["holdings"], (result) => {
        if (result["holdings"] && Array.isArray(result["holdings"])) {
          holdings = result["holdings"];
        } else {
          holdings = [
            { ticker: "AAPL", name: "Apple Inc.", shares: 10, avgBuyPrice: 145 },
            { ticker: "NVDA", name: "NVIDIA Corp.", shares: 5, avgBuyPrice: 410 },
            { ticker: "MSFT", name: "Microsoft Corp.", shares: 8, avgBuyPrice: 290 },
            { ticker: "TSLA", name: "Tesla Inc.", shares: 3, avgBuyPrice: 220 }
          ];
          chrome.storage.local.set({ holdings });
        }
        resolve();
      });
    });
  }
  async function handleScan() {
    scanBtn.disabled = true;
    resultsEl.style.display = "none";
    setStatus("extracting article\u2026", true);
    let article = null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      article = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_ARTICLE" });
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
    setStatus("running analysis\u2026", true);
    let result = null;
    try {
      const r = await fetch(`${API}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "",
          title: article.title,
          body: article.body,
          holdings
        })
      });
      if (!r.ok)
        throw new Error(`HTTP ${r.status}`);
      result = await r.json();
    } catch (e) {
      setStatus(`API error: ${e.message}`);
      scanBtn.disabled = false;
      return;
    }
    if (result)
      renderResults(result);
    setStatus("");
    scanBtn.disabled = false;
  }
  function renderResults(result) {
    summaryEl.innerHTML = `${sentimentBadge(result.sentiment)}&nbsp; ${escHtml(result.summary)}`;
    if (result.impactDetails.length > 0) {
      chipsEl.innerHTML = result.impactDetails.map((d) => {
        const icon = d.sentiment === "positive" ? "\u25B2" : d.sentiment === "negative" ? "\u25BC" : "\u2014";
        const confPct = d.confidence !== void 0 ? Math.round(d.confidence * 100) : null;
        const confBadge = confPct !== null ? `<span class="conf">${confPct}%</span>` : "";
        return `<div class="chip ${d.sentiment}"><span class="chip-icon">${icon}</span>${escHtml(d.ticker)}${confBadge}</div>`;
      }).join("");
      chipsWrap.style.display = "block";
    } else {
      chipsWrap.style.display = "none";
    }
    resultsEl.style.display = "block";
  }
  async function loadNews() {
    newsLoaded = true;
    newsList.innerHTML = `<div class="news-list-inner"><div class="status"><span class="spinner"></span>fetching news\u2026</div></div>`;
    const tickers = holdings.map((h) => h.ticker).join(",");
    if (!tickers) {
      newsList.innerHTML = `<div class="news-list-inner"><div class="empty">No holdings configured.</div></div>`;
      return;
    }
    try {
      const r = await fetch(`${API}/news?tickers=${encodeURIComponent(tickers)}`, {
        signal: AbortSignal.timeout(15e3)
      });
      if (!r.ok)
        throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const articles = data.articles || [];
      if (articles.length === 0) {
        newsList.innerHTML = `<div class="news-list-inner"><div class="empty">No recent news found.</div></div>`;
        return;
      }
      const cards = articles.map(
        (a) => `
        <div class="news-card">
          <div class="news-card-top">
            <span class="news-ticker-badge">${escHtml(a.ticker)}</span>
            <span class="news-time">${timeAgo(a.publishedAt)}</span>
          </div>
          <div class="news-title">${escHtml(a.title)}</div>
          <div class="news-card-bottom">
            <span class="news-source">${escHtml(a.source)}</span>
            <button class="news-open-btn" data-url="${escAttr(a.url)}">\u2197 open</button>
          </div>
        </div>`
      ).join("");
      newsList.innerHTML = `<div class="news-list-inner">${cards}</div>`;
      newsList.querySelectorAll(".news-open-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const url = btn.dataset.url;
          if (url)
            chrome.tabs.create({ url });
        });
      });
    } catch {
      newsList.innerHTML = `<div class="news-list-inner"><div class="status">Failed to load news. Is the engine running?</div></div>`;
    }
  }
  function setStatus(msg, spinning = false) {
    if (!msg) {
      statusEl.innerHTML = "";
      return;
    }
    statusEl.innerHTML = spinning ? `<span class="spinner"></span>${escHtml(msg)}` : escHtml(msg);
  }
  function sentimentBadge(sentiment) {
    const map = {
      positive: `<span class="badge positive">\u25B2 POSITIVE</span>`,
      negative: `<span class="badge negative">\u25BC NEGATIVE</span>`,
      neutral: `<span class="badge neutral">\u2014 NEUTRAL</span>`
    };
    return map[sentiment] ?? map["neutral"];
  }
  function escHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }
  function timeAgo(dateStr) {
    if (!dateStr)
      return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime()))
      return "";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 6e4);
    if (mins < 1)
      return "just now";
    if (mins < 60)
      return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
      return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
})();
