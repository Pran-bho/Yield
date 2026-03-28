from __future__ import annotations

from typing import Any, Dict, List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine import analyse_article


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


@app.post("/analyse")
def analyse(payload: ArticleScanPayload) -> Dict[str, Any]:
    global LATEST_ANALYSIS

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
    return LATEST_ANALYSISc