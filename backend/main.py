from __future__ import annotations

import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List
from urllib.parse import quote as _url_quote

import requests as _http
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from engine import analyse_article, get_finbert, get_embedder, get_theme_bank, get_company_bank


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────

class Stock(BaseModel):
    ticker: str
    name: str = ""
    shares: float = 0.0
    avgBuyPrice: float = 0.0


class ArticleScanPayload(BaseModel):
    url: str = ""
    title: str = ""
    body: str = ""
    holdings: List[Stock] = Field(default_factory=list)


# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

app = FastAPI(title="Yield Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_STATIC = Path(__file__).parent / "static"
if _STATIC.exists():
    app.mount("/assets", StaticFiles(directory=_STATIC / "assets"), name="assets")

# In-memory store for the latest analysis
LATEST_ANALYSIS: Dict[str, Any] | None = None


# ─────────────────────────────────────────────
# Warm up models on startup so first request
# isn't slow
# ─────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    print("Loading models...")
    get_finbert()
    get_embedder()
    get_theme_bank()
    get_company_bank()
    print("Models ready.")


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def dashboard() -> FileResponse | HTMLResponse:
    react_index = _STATIC / "index.html"
    if react_index.exists():
        return FileResponse(react_index)
    return HTMLResponse(Path(__file__).parent.joinpath("dashboard.html").read_text(encoding="utf-8"))


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "version": "1.0.0"}


@app.post("/analyse")
def analyse(payload: ArticleScanPayload) -> Dict[str, Any]:
    global LATEST_ANALYSIS

    if not payload.title and not payload.body:
        raise HTTPException(status_code=400, detail="title or body must be provided")

    result = analyse_article(payload.model_dump())

    LATEST_ANALYSIS = {
        "request": payload.model_dump(),
        "result": result,
    }

    return result


@app.get("/latest")
def latest() -> Dict[str, Any]:
    if LATEST_ANALYSIS is None:
        return {"message": "No analysis yet."}
    return LATEST_ANALYSIS


# ─────────────────────────────────────────────
# News feed helpers
# ─────────────────────────────────────────────

_PAYWALLED = frozenset({
    "wsj.com", "ft.com", "bloomberg.com", "barrons.com",
    "economist.com", "seekingalpha.com", "thetimes.co.uk",
})


def _fetch_ticker_news(ticker: str, max_items: int = 5) -> List[Dict[str, Any]]:
    query = _url_quote(f"{ticker} stock news")
    url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    try:
        resp = _http.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
    except Exception:
        return []

    articles = []
    for item in root.findall(".//item")[:max_items]:
        title   = (item.findtext("title") or "").strip()
        link    = (item.findtext("link") or "").strip()
        pub     = (item.findtext("pubDate") or "").strip()
        src_el  = item.find("source")
        source  = (src_el.text or "").strip() if src_el is not None else ""
        src_url = (src_el.get("url", "") if src_el is not None else "")

        if not title:
            continue
        if any(d in src_url for d in _PAYWALLED):
            continue

        articles.append({
            "title": title,
            "url": link,
            "source": source,
            "publishedAt": pub,
            "ticker": ticker,
        })

    return articles


@app.get("/news")
def news(tickers: str = "") -> Dict[str, Any]:
    if not tickers:
        return {"articles": []}

    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:8]

    all_articles: List[Dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_fetch_ticker_news, t): t for t in ticker_list}
        for future in as_completed(futures):
            try:
                all_articles.extend(future.result())
            except Exception:
                pass

    all_articles.sort(key=lambda a: a.get("publishedAt", ""), reverse=True)
    return {"articles": all_articles}
