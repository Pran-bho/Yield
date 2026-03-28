from __future__ import annotations

from typing import Any, Dict, List


TECH_UNIVERSE = {
    "AAPL": {
        "name": "Apple Inc.",
        "keywords": ["apple", "iphone", "ipad", "mac", "app store"],
    },
    "NVDA": {
        "name": "NVIDIA Corp.",
        "keywords": ["nvidia", "gpu", "ai chip", "cuda", "h100", "blackwell"],
    },
    "MSFT": {
        "name": "Microsoft Corp.",
        "keywords": ["microsoft", "azure", "windows", "openai", "copilot"],
    },
    "TSLA": {
        "name": "Tesla Inc.",
        "keywords": ["tesla", "ev", "electric vehicle", "autonomous driving", "elon musk"],
    },
    "GOOGL": {
        "name": "Alphabet Inc.",
        "keywords": ["google", "alphabet", "search ads", "youtube", "gemini"],
    },
    "AMZN": {
        "name": "Amazon.com Inc.",
        "keywords": ["amazon", "aws", "prime", "e-commerce"],
    },
    "META": {
        "name": "Meta Platforms Inc.",
        "keywords": ["meta", "facebook", "instagram", "whatsapp", "ad spend"],
    },
}

POSITIVE_WORDS = [
    "beat", "beats", "surge", "surges", "growth", "strong", "bullish", "upside",
    "benefit", "benefits", "record", "expand", "expands", "demand", "rally",
    "outperform", "positive", "gain", "gains",
]

NEGATIVE_WORDS = [
    "miss", "misses", "weak", "decline", "declines", "bearish", "downside",
    "risk", "risks", "drop", "drops", "cuts", "cut", "slowdown", "lawsuit",
    "probe", "ban", "tariff", "negative", "fall", "falls",
]


def _count_hits(text: str, words: List[str]) -> int:
    text_lower = text.lower()
    return sum(text_lower.count(word) for word in words)


def _infer_overall_sentiment(text: str) -> str:
    pos = _count_hits(text, POSITIVE_WORDS)
    neg = _count_hits(text, NEGATIVE_WORDS)

    if pos > neg + 1:
        return "positive"
    if neg > pos + 1:
        return "negative"
    return "neutral"


def _extract_relevant_tickers(text: str, holdings: List[Dict[str, Any]]) -> List[str]:
    text_lower = text.lower()
    found: List[str] = []

    for holding in holdings:
        ticker = holding["ticker"].upper()
        meta = TECH_UNIVERSE.get(ticker)
        if not meta:
            continue

        keywords = [ticker.lower(), meta["name"].lower(), *meta["keywords"]]
        if any(keyword in text_lower for keyword in keywords):
            found.append(ticker)

    return found


def _reason_for_ticker(ticker: str, text: str, overall_sentiment: str) -> str:
    text_lower = text.lower()

    if ticker == "NVDA":
        if "ai" in text_lower or "chip" in text_lower:
            return "The article discusses AI or semiconductor demand, which is directly relevant to NVIDIA."
    elif ticker == "MSFT":
        if "azure" in text_lower or "enterprise" in text_lower or "cloud" in text_lower:
            return "The article points to cloud or enterprise trends that may affect Microsoft."
    elif ticker == "AAPL":
        if "iphone" in text_lower or "consumer" in text_lower or "hardware" in text_lower:
            return "The article references consumer hardware trends that may affect Apple."
    elif ticker == "TSLA":
        if "ev" in text_lower or "electric vehicle" in text_lower or "autonomous" in text_lower:
            return "The article references EV or autonomy themes that may affect Tesla."

    if overall_sentiment == "positive":
        return f"The article appears broadly supportive for {ticker} based on the language and topics mentioned."
    if overall_sentiment == "negative":
        return f"The article appears broadly adverse for {ticker} based on the language and topics mentioned."
    return f"The article mentions themes relevant to {ticker}, but the overall signal is mixed."


def analyse_article(payload: Dict[str, Any]) -> Dict[str, Any]:
    title = payload.get("title", "")
    body = payload.get("body", "")
    holdings = payload.get("holdings", [])

    full_text = f"{title}\n{body}".strip()
    overall_sentiment = _infer_overall_sentiment(full_text)
    affected_tickers = _extract_relevant_tickers(full_text, holdings)

    impact_details = []
    for ticker in affected_tickers:
        reasoning = _reason_for_ticker(ticker, full_text, overall_sentiment)
        impact_details.append(
            {
                "ticker": ticker,
                "reasoning": reasoning,
                "sentiment": overall_sentiment,
            }
        )

    if affected_tickers:
        summary = (
            f"This article appears {overall_sentiment} for your portfolio. "
            f"The main affected holdings are {', '.join(affected_tickers)}."
        )
    else:
        summary = (
            "No strong direct link was found between the article and your current holdings, "
            "though broader market sentiment may still matter."
        )

    return {
        "summary": summary,
        "affectedTickers": affected_tickers,
        "sentiment": overall_sentiment,
        "impactDetails": impact_details,
    }