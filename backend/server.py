from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List

import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine import analyse_article


def fetch_article_text(url: str) -> str:
    """Fetch a URL and return cleaned article text (up to 8000 chars)."""
    try:
        resp = requests.get(url, headers=NEWS_HEADERS, timeout=6, allow_redirects=True)
        resp.raise_for_status()
        content = resp.text
        # Strip scripts, styles and tags
        content = re.sub(r"<(script|style|nav|header|footer|aside)[^>]*>.*?</\1>", " ", content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r"<[^>]+>", " ", content)
        content = html.unescape(content)
        content = re.sub(r"\s+", " ", content).strip()
        return content[:8000]
    except Exception:
        return ""

NEWS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


class Stock(BaseModel):
    ticker: str
    name: str
    shares: float
    avgBuyPrice: float


class ArticleScanPayload(BaseModel):
    url: str
    title: str
    body: str
    holdings: List[Stock] = Field(default_factory=list)


app = FastAPI(title="Yield Desktop Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

LATEST_ANALYSIS: Dict[str, Any] | None = None


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "version": "1.0.0"}


@app.get("/holdings")
def holdings() -> Dict[str, List[Dict[str, Any]]]:
    demo_holdings = [
        {"ticker": "AAPL", "name": "Apple Inc.", "shares": 10, "avgBuyPrice": 145.0},
        {"ticker": "NVDA", "name": "NVIDIA Corp.", "shares": 5, "avgBuyPrice": 410.0},
        {"ticker": "MSFT", "name": "Microsoft Corp.", "shares": 8, "avgBuyPrice": 290.0},
        {"ticker": "TSLA", "name": "Tesla Inc.", "shares": 3, "avgBuyPrice": 220.0},
    ]
    return {"holdings": demo_holdings}


@app.get("/news")
def news(tickers: str = "AAPL,NVDA,MSFT,TSLA") -> Dict[str, Any]:
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    items: List[Dict[str, str]] = []

    for ticker in ticker_list:
        try:
            resp = requests.get(
                f"https://news.google.com/rss/search?q={ticker}+stock&hl=en-US&gl=US&ceid=US:en",
                headers=NEWS_HEADERS,
                timeout=5,
            )
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
            for entry in root.findall(".//item")[:6]:
                title = entry.findtext("title", "").strip()
                link = entry.findtext("link", "").strip()
                pub_date = entry.findtext("pubDate", "").strip()
                if title:
                    items.append({"ticker": ticker, "title": title, "link": link, "pubDate": pub_date})
        except Exception:
            continue

    items.sort(key=lambda x: x.get("pubDate", ""), reverse=True)
    return {"items": items[:5]}


@app.post("/analyse")
def analyse(payload: ArticleScanPayload) -> Dict[str, Any]:
    global LATEST_ANALYSIS

    body = payload.body
    if len(body) < 200 and payload.url:
        fetched = fetch_article_text(payload.url)
        if fetched:
            body = fetched

    data = payload.model_dump()
    data["body"] = body
    result = analyse_article(data)
    LATEST_ANALYSIS = {"request": data, "result": result}
    return result


@app.get("/latest")
def latest() -> Dict[str, Any]:
    if LATEST_ANALYSIS is None:
        return {"message": "No analysis yet."}
    return LATEST_ANALYSIS
