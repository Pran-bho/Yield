from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, List, Tuple
import re

import numpy as np
from sentence_transformers import SentenceTransformer
from transformers import pipeline


# =========================================================
# Theme definitions
# =========================================================

THEMES = [
    {
        "name": "AI infrastructure demand",
        "prototypes": [
            "Demand for AI chips and data center hardware is rising.",
            "Cloud providers are increasing AI infrastructure spending.",
            "Hyperscalers are expanding capex for AI workloads.",
            "Enterprises are investing more in AI compute infrastructure.",
        ],
        "exposures": {
            "NVDA": 1.00,
            "AMD": 0.85,
            "TSM": 0.70,
            "AVGO": 0.65,
            "MSFT": 0.45,
            "AMZN": 0.40,
            "META": 0.30,
            "GOOGL": 0.30,
        },
    },
    {
        "name": "chip export restrictions",
        "prototypes": [
            "Governments are tightening semiconductor export restrictions.",
            "New export controls are affecting advanced chip sales.",
            "Restrictions on chip exports are creating pressure on semiconductor companies.",
            "Geopolitical regulation is limiting access to chip markets.",
        ],
        "exposures": {
            "NVDA": -1.00,
            "AMD": -0.85,
            "TSM": -0.60,
            "ASML": -0.50,
            "AVGO": -0.40,
        },
    },
    {
        "name": "cloud growth",
        "prototypes": [
            "Enterprise cloud demand is accelerating.",
            "Cloud infrastructure growth remains strong.",
            "Companies are expanding cloud spending.",
            "Demand for cloud services continues to rise.",
        ],
        "exposures": {
            "MSFT": 1.00,
            "AMZN": 0.95,
            "GOOGL": 0.70,
            "NVDA": 0.25,
            "AMD": 0.20,
        },
    },
    {
        "name": "digital advertising weakness",
        "prototypes": [
            "Digital advertising demand is weakening.",
            "Marketers are reducing ad budgets.",
            "Online ad spending is slowing down.",
            "Advertising growth is under pressure.",
        ],
        "exposures": {
            "META": -1.00,
            "GOOGL": -0.95,
            "AMZN": -0.25,
        },
    },
    {
        "name": "consumer hardware weakness",
        "prototypes": [
            "Consumer demand for devices is weakening.",
            "Smartphone and hardware sales are slowing.",
            "Consumers are delaying electronics upgrades.",
            "Device demand remains soft.",
        ],
        "exposures": {
            "AAPL": -1.00,
            "TSLA": -0.15,
            "GOOGL": -0.10,
        },
    },
    {
        "name": "antitrust and regulation",
        "prototypes": [
            "Technology companies face antitrust scrutiny.",
            "Regulators are investigating dominant tech platforms.",
            "Big tech is under legal and regulatory pressure.",
            "Competition authorities are targeting large technology firms.",
        ],
        "exposures": {
            "GOOGL": -1.00,
            "META": -0.90,
            "AAPL": -0.75,
            "AMZN": -0.70,
            "MSFT": -0.35,
        },
    },
    {
        "name": "EV demand and autonomy",
        "prototypes": [
            "Electric vehicle demand is growing.",
            "Autonomous driving technology is improving.",
            "The EV market is expanding rapidly.",
            "Vehicle software and autonomy are driving growth.",
        ],
        "exposures": {
            "TSLA": 1.00,
            "NVDA": 0.20,
            "GOOGL": 0.15,
        },
    },
    {
        "name": "cybersecurity demand",
        "prototypes": [
            "Cybersecurity spending is increasing.",
            "Organizations are investing more in digital security.",
            "Security software demand remains strong.",
            "Cyber threats are driving enterprise security budgets higher.",
        ],
        "exposures": {
            "MSFT": 0.40,
            "GOOGL": 0.20,
            "AMZN": 0.20,
        },
    },
    {
        "name": "earnings revisions and analyst outlook",
        "prototypes": [
            "Analysts are revising earnings estimates for a company.",
            "Earnings expectations and EPS revisions are driving investor outlook.",
            "A stock's near term direction is influenced by analyst revisions and guidance.",
            "Investors are reacting to updates in earnings forecasts and analyst ratings.",
        ],
        "exposures": {
            "AAPL": 0.55,
            "NVDA": 0.55,
            "MSFT": 0.50,
            "TSLA": 0.45,
            "GOOGL": 0.45,
            "AMZN": 0.45,
            "META": 0.45,
        },
    },
    {
        "name": "enterprise platform expansion",
        "prototypes": [
            "A company is launching a new business platform for enterprise customers.",
            "Technology firms are expanding their business offerings and enterprise products.",
            "New business tools and services may improve enterprise adoption and monetization.",
            "A platform launch aimed at businesses could support future growth.",
        ],
        "exposures": {
            "AAPL": 0.80,
            "MSFT": 0.45,
            "AMZN": 0.20,
            "GOOGL": 0.20,
        },
    },
]


# =========================================================
# Company profiles for direct relevance matching
# =========================================================

COMPANY_PROFILES = {
    "AAPL": [
        "Apple designs and sells smartphones, computers, tablets, wearables, accessories, and digital services.",
        "Apple is affected by iPhone demand, hardware sales, services growth, product launches, and earnings revisions.",
        "Apple benefits from ecosystem strength, business platform expansion, and consumer technology adoption.",
    ],
    "NVDA": [
        "NVIDIA is affected by AI chip demand, GPU sales, data center growth, and semiconductor investment.",
        "NVIDIA benefits from AI infrastructure spending and hyperscaler demand.",
        "NVIDIA is exposed to semiconductor exports, accelerated compute, and data center capex.",
    ],
    "MSFT": [
        "Microsoft is affected by enterprise software demand, Azure cloud growth, AI monetization, and productivity software.",
        "Microsoft benefits from cloud spending and enterprise technology demand.",
        "Microsoft is exposed to business software, corporate IT budgets, and AI platform adoption.",
    ],
    "TSLA": [
        "Tesla is affected by electric vehicle demand, autonomous driving progress, deliveries, and automotive margins.",
        "Tesla benefits from EV adoption and autonomy improvements.",
        "Tesla is exposed to vehicle demand, manufacturing scale, and automotive software.",
    ],
    "GOOGL": [
        "Alphabet is affected by digital advertising demand, cloud growth, AI competition, and regulation.",
        "Google benefits from search, YouTube, cloud services, and AI product adoption.",
    ],
    "AMZN": [
        "Amazon is affected by e-commerce demand, AWS cloud growth, consumer spending, and logistics efficiency.",
        "Amazon benefits from cloud spending and online retail demand.",
    ],
    "META": [
        "Meta is affected by digital advertising demand, social platform engagement, AI spending, and regulation.",
        "Meta benefits from ad market strength and user growth across its platforms.",
    ],
    "AMD": [
        "AMD is affected by chip demand, data center spending, PC demand, and semiconductor competition.",
        "AMD benefits from compute demand and enterprise hardware spending.",
    ],
    "TSM": [
        "TSMC is affected by semiconductor manufacturing demand, foundry utilization, and advanced chip production.",
        "TSMC benefits from AI chip demand and broad semiconductor capex.",
    ],
    "AVGO": [
        "Broadcom is affected by semiconductor demand, networking infrastructure, and enterprise software spending.",
        "Broadcom benefits from data center growth and connectivity demand.",
    ],
    "ASML": [
        "ASML is affected by semiconductor capital expenditure, lithography demand, and foundry investment cycles.",
        "ASML benefits from chip manufacturing expansion and advanced node investment.",
    ],
}


# =========================================================
# Data classes
# =========================================================

@dataclass
class SentenceSentiment:
    sentence: str
    label: str
    confidence: float
    signed_score: float


@dataclass
class ThemeMatch:
    sentence: str
    theme: str
    similarity: float
    exposure_map: Dict[str, float]


@dataclass
class CompanyMatch:
    sentence: str
    ticker: str
    similarity: float


# =========================================================
# Model loaders
# =========================================================

@lru_cache(maxsize=1)
def get_finbert():
    return pipeline(
        "text-classification",
        model="ProsusAI/finbert",
        tokenizer="ProsusAI/finbert",
        truncation=True,
        top_k=None,
    )


@lru_cache(maxsize=1)
def get_embedder():
    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


@lru_cache(maxsize=1)
def get_theme_bank() -> Tuple[List[str], np.ndarray, List[Dict[str, Any]]]:
    embedder = get_embedder()

    theme_vectors: List[np.ndarray] = []
    theme_meta: List[Dict[str, Any]] = []
    theme_names: List[str] = []

    for theme in THEMES:
        emb = embedder.encode(theme["prototypes"], normalize_embeddings=True)
        centroid = np.mean(emb, axis=0)
        centroid = centroid / np.linalg.norm(centroid)

        theme_vectors.append(centroid)
        theme_meta.append(theme)
        theme_names.append(theme["name"])

    return theme_names, np.vstack(theme_vectors), theme_meta


@lru_cache(maxsize=1)
def get_company_bank() -> Tuple[List[str], np.ndarray]:
    embedder = get_embedder()

    tickers: List[str] = []
    vectors: List[np.ndarray] = []

    for ticker, profiles in COMPANY_PROFILES.items():
        emb = embedder.encode(profiles, normalize_embeddings=True)
        centroid = np.mean(emb, axis=0)
        centroid = centroid / np.linalg.norm(centroid)

        tickers.append(ticker)
        vectors.append(centroid)

    return tickers, np.vstack(vectors)


# =========================================================
# Helpers
# =========================================================

def clean_article_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text)

    junk_patterns = [
        r"Skip to main content",
        r"Accept All",
        r"Deny Optional",
        r"Privacy Policy",
        r"Terms of Service",
        r"Back to top",
        r"Click Here, It'?s Really Free",
        r"Due to inactivity.*",
        r"Home Stocks Stocks Stocks",
        r"You are being directed to ZacksTrade.*?Cancel",
        r"Zacks Investment Research Overview",
        r"Image Source: Zacks Investment Research",
        r"Image: Bigstock",
        r"Published in .*",
    ]

    for pattern in junk_patterns:
        text = re.sub(pattern, " ", text, flags=re.IGNORECASE)

    return re.sub(r"\s{2,}", " ", text).strip()


def split_sentences(text: str) -> List[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    parts = re.split(r"(?<=[.!?])\s+", text)
    sentences = [p.strip() for p in parts if p.strip()]

    # Filter out very short junky fragments
    return [s for s in sentences if len(s.split()) >= 5]


def signed_from_finbert(label: str, confidence: float) -> float:
    label = label.lower()
    if label == "positive":
        return confidence
    if label == "negative":
        return -confidence
    return 0.0


def aggregate_label(score: float, pos_thresh: float = 0.12, neg_thresh: float = -0.12) -> str:
    if score >= pos_thresh:
        return "positive"
    if score <= neg_thresh:
        return "negative"
    return "neutral"


def safe_mean(values: List[float]) -> float:
    return float(sum(values) / len(values)) if values else 0.0


def unique_preserve_order(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def compute_confidence(
    contributions: List[float],
    reasons: List[Tuple[float, str, str, float]],
    sentiment_by_sentence: Dict[str, SentenceSentiment],
) -> float:
    """
    Returns a 0-1 confidence score based on:
      - signal richness (how many sentences fired)
      - directional consistency (signals agree on direction)
      - average FinBERT confidence across relevant sentences
      - average semantic similarity of matched signals
    """
    if not contributions:
        return 0.0

    n = len(contributions)
    richness = min(1.0, n / 6.0)

    pos = sum(1 for c in contributions if c > 0)
    neg = sum(1 for c in contributions if c < 0)
    consistency = max(pos, neg) / n

    sents = [r[1] for r in reasons]
    finbert_vals = [
        sentiment_by_sentence[s].confidence
        for s in sents
        if s in sentiment_by_sentence
    ]
    avg_finbert = safe_mean(finbert_vals) if finbert_vals else 0.5

    avg_sim = safe_mean([r[3] for r in reasons]) if reasons else 0.4

    conf = (
        richness    * 0.25 +
        consistency * 0.35 +
        avg_finbert * 0.25 +
        avg_sim     * 0.15
    )
    return round(min(1.0, max(0.0, conf)), 2)


# =========================================================
# Core scoring
# =========================================================

def score_sentiments(sentences: List[str]) -> List[SentenceSentiment]:
    if not sentences:
        return []

    clf = get_finbert()
    raw = clf(sentences)

    scored: List[SentenceSentiment] = []
    for sentence, result_list in zip(sentences, raw):
        best = max(result_list, key=lambda x: float(x["score"]))
        label = str(best["label"]).lower()
        confidence = float(best["score"])
        signed = signed_from_finbert(label, confidence)

        scored.append(
            SentenceSentiment(
                sentence=sentence,
                label=label,
                confidence=confidence,
                signed_score=signed,
            )
        )

    return scored


def match_themes(sentences: List[str], similarity_threshold: float = 0.34) -> List[ThemeMatch]:
    if not sentences:
        return []

    embedder = get_embedder()
    _, theme_matrix, theme_meta = get_theme_bank()

    sentence_embeddings = embedder.encode(sentences, normalize_embeddings=True)
    similarities = sentence_embeddings @ theme_matrix.T

    matches: List[ThemeMatch] = []

    for sentence_idx, sentence in enumerate(sentences):
        row = similarities[sentence_idx]

        # Keep top 2 themes if they are meaningfully similar
        ranked_indices = np.argsort(row)[::-1][:2]

        for idx in ranked_indices:
            sim = float(row[idx])
            if sim < similarity_threshold:
                continue

            theme = theme_meta[int(idx)]
            matches.append(
                ThemeMatch(
                    sentence=sentence,
                    theme=theme["name"],
                    similarity=sim,
                    exposure_map=theme["exposures"],
                )
            )

    return matches


def match_companies(sentences: List[str], similarity_threshold: float = 0.30) -> List[CompanyMatch]:
    if not sentences:
        return []

    embedder = get_embedder()
    tickers, company_matrix = get_company_bank()

    sentence_embeddings = embedder.encode(sentences, normalize_embeddings=True)
    similarities = sentence_embeddings @ company_matrix.T

    matches: List[CompanyMatch] = []

    for sentence_idx, sentence in enumerate(sentences):
        row = similarities[sentence_idx]

        # Keep top 2 company matches
        ranked_indices = np.argsort(row)[::-1][:2]

        for idx in ranked_indices:
            sim = float(row[idx])
            if sim < similarity_threshold:
                continue

            matches.append(
                CompanyMatch(
                    sentence=sentence,
                    ticker=tickers[int(idx)],
                    similarity=sim,
                )
            )

    return matches


# =========================================================
# Main analysis entry point
# =========================================================

def analyse_article(payload: Dict[str, Any]) -> Dict[str, Any]:
    title = payload.get("title", "") or ""
    body = payload.get("body", "") or ""
    holdings = payload.get("holdings", []) or []

    holding_tickers = [holding["ticker"].upper() for holding in holdings if "ticker" in holding]
    holding_tickers = unique_preserve_order(holding_tickers)

    full_text = clean_article_text(f"{title}. {body}")
    sentences = split_sentences(full_text)

    if not sentences:
        return {
            "summary": "No article text was provided.",
            "affectedTickers": [],
            "sentiment": "neutral",
            "impactDetails": [],
        }

    sentiments = score_sentiments(sentences)
    theme_matches = match_themes(sentences)
    company_matches = match_companies(sentences)

    sentiment_by_sentence = {s.sentence: s for s in sentiments}

    stock_scores: Dict[str, List[float]] = {ticker: [] for ticker in holding_tickers}
    stock_reasons: Dict[str, List[Tuple[float, str, str, float]]] = {ticker: [] for ticker in holding_tickers}

    # -----------------------------------------------------
    # Direct company relevance signal
    # -----------------------------------------------------
    for match in company_matches:
        if match.ticker not in holding_tickers:
            continue

        sent = sentiment_by_sentence.get(match.sentence)
        if sent is None:
            continue

        # Direct company relevance should matter a bit more
        contribution = sent.signed_score * match.similarity * 1.25
        stock_scores[match.ticker].append(contribution)
        stock_reasons[match.ticker].append(
            (
                abs(contribution),
                match.sentence,
                "direct company relevance",
                match.similarity,
            )
        )

    # -----------------------------------------------------
    # Theme-based indirect / sector spillover signal
    # -----------------------------------------------------
    for match in theme_matches:
        sent = sentiment_by_sentence.get(match.sentence)
        if sent is None:
            continue

        for ticker in holding_tickers:
            exposure = match.exposure_map.get(ticker)
            if exposure is None:
                continue

            contribution = sent.signed_score * match.similarity * float(exposure)
            stock_scores[ticker].append(contribution)
            stock_reasons[ticker].append(
                (
                    abs(contribution),
                    match.sentence,
                    match.theme,
                    match.similarity,
                )
            )

    # -----------------------------------------------------
    # Build output
    # -----------------------------------------------------
    impacted: List[Tuple[str, float]] = []
    impact_details: List[Dict[str, Any]] = []

    for ticker in holding_tickers:
        contributions = stock_scores[ticker]
        if not contributions:
            continue

        avg_score = safe_mean(contributions)
        sentiment_label = aggregate_label(avg_score)

        # Skip pure near-zero noise
        if abs(avg_score) < 0.08:
            continue

        impacted.append((ticker, avg_score))

        best_reason = max(stock_reasons[ticker], key=lambda x: x[0], default=None)
        if best_reason:
            evidence_sentence = best_reason[1]
            signal_name = best_reason[2]
            reasoning = (
                f"Detected {signal_name} in the article. "
                f"Strongest evidence: \"{evidence_sentence}\""
            )
        else:
            reasoning = "The article contains semantically relevant signals for this holding."

        confidence = compute_confidence(contributions, stock_reasons[ticker], sentiment_by_sentence)

        impact_details.append(
            {
                "ticker": ticker,
                "reasoning": reasoning,
                "sentiment": sentiment_label,
                "confidence": confidence,
            }
        )

    impacted.sort(key=lambda x: abs(x[1]), reverse=True)

    if impacted:
        affected_tickers = [ticker for ticker, _ in impacted]
        overall_score = safe_mean([score for _, score in impacted])
        overall_sentiment = aggregate_label(overall_score)

        summary = (
            f"This article appears {overall_sentiment} for your holdings overall. "
            f"The main affected holdings are {', '.join(affected_tickers[:4])}."
        )
    else:
        article_level_score = safe_mean([s.signed_score for s in sentiments])
        overall_sentiment = aggregate_label(article_level_score)
        affected_tickers = []

        summary = (
            f"No strong stock-specific impact was inferred for your current holdings. "
            f"Overall article sentiment was {overall_sentiment}."
        )

    return {
        "summary": summary,
        "affectedTickers": affected_tickers,
        "sentiment": overall_sentiment,
        "impactDetails": impact_details,
    }


# =========================================================
# Optional local warm-up
# Uncomment if you want to preload models when running file.
# =========================================================

if __name__ == "__main__":
    print("Loading FinBERT...")
    get_finbert()
    print("Loading embedder...")
    get_embedder()
    print("Building theme bank...")
    get_theme_bank()
    print("Building company bank...")
    get_company_bank()
    print("Ready.")