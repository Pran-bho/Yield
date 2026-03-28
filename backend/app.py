from __future__ import annotations

import json
from typing import Any, Dict, List

import requests
import streamlit as st

API_BASE = "http://localhost:8080"


DEFAULT_HOLDINGS: List[Dict[str, Any]] = [
    {"ticker": "AAPL", "name": "Apple Inc.", "shares": 10, "avgBuyPrice": 145.0},
    {"ticker": "NVDA", "name": "NVIDIA Corp.", "shares": 5, "avgBuyPrice": 410.0},
    {"ticker": "MSFT", "name": "Microsoft Corp.", "shares": 8, "avgBuyPrice": 290.0},
    {"ticker": "TSLA", "name": "Tesla Inc.", "shares": 3, "avgBuyPrice": 220.0},
]


st.set_page_config(page_title="Yield Desktop", layout="wide")
st.title("🌿 Yield")
st.caption("Local news impact analysis for your portfolio")


def check_backend() -> bool:
    try:
        res = requests.get(f"{API_BASE}/health", timeout=2)
        return res.ok
    except Exception:
        return False


backend_ok = check_backend()
if backend_ok:
    st.success("Backend is running on localhost:8080")
else:
    st.error("Backend is not running. Start server.py first.")


tab1, tab2 = st.tabs(["Manual Analysis", "Latest Result"])

with tab1:
    st.subheader("Manual Article Analysis")

    title = st.text_input("Article title", value="NVIDIA beats earnings expectations on AI demand")
    url = st.text_input("Article URL", value="https://example.com/article")
    body = st.text_area(
        "Article text",
        height=250,
        value=(
            "NVIDIA reported record quarterly earnings, beating analyst expectations as demand for "
            "AI chips and data center hardware remained strong. Microsoft and other cloud providers "
            "continue expanding AI infrastructure spending."
        ),
    )

    holdings_json = st.text_area(
        "Holdings JSON",
        height=220,
        value=json.dumps(DEFAULT_HOLDINGS, indent=2),
    )

    if st.button("Analyse article", type="primary", disabled=not backend_ok):
        try:
            holdings = json.loads(holdings_json)
            payload = {
                "url": url,
                "title": title,
                "body": body,
                "holdings": holdings,
            }

            res = requests.post(f"{API_BASE}/analyse", json=payload, timeout=10)
            res.raise_for_status()
            result = res.json()

            st.success("Analysis complete")

            col1, col2 = st.columns([1, 2])

            with col1:
                st.metric("Overall sentiment", result["sentiment"].upper())
                st.write("**Affected tickers**")
                if result["affectedTickers"]:
                    for ticker in result["affectedTickers"]:
                        st.write(f"- {ticker}")
                else:
                    st.write("None detected")

            with col2:
                st.write("**Summary**")
                st.write(result["summary"])

                st.write("**Impact details**")
                if result["impactDetails"]:
                    for item in result["impactDetails"]:
                        with st.container():
                            st.markdown(f"**{item['ticker']}**")
                            st.write(item["reasoning"])
                            st.caption(f"Sentiment: {item['sentiment']}")
                else:
                    st.write("No detailed impacts found.")

        except json.JSONDecodeError:
            st.error("Holdings JSON is invalid.")
        except requests.RequestException as exc:
            st.error(f"Request failed: {exc}")

with tab2:
    st.subheader("Latest Result from Extension / API")

    if st.button("Refresh latest", disabled=not backend_ok, key="refresh_latest"):
        st.rerun()

    if backend_ok:
        try:
            res = requests.get(f"{API_BASE}/latest", timeout=5)
            res.raise_for_status()
            latest = res.json()

            # Debug helper so you can see exactly what backend returned
            with st.expander("Raw /latest response"):
                st.json(latest)

            # Case 1: wrapped response
            if isinstance(latest, dict) and "result" in latest:
                request_data = latest.get("request", {})
                result = latest["result"]

            # Case 2: direct analysis result
            elif isinstance(latest, dict) and "summary" in latest and "sentiment" in latest:
                request_data = {}
                result = latest

            # Case 3: no data yet / unknown shape
            else:
                st.info(latest.get("message", "No analysis has been run yet."))
                st.stop()

            col1, col2 = st.columns([1, 2])

            with col1:
                st.write("**Article info**")
                if request_data:
                    st.write(f"**Title:** {request_data.get('title', 'N/A')}")
                    st.write(f"**URL:** {request_data.get('url', 'N/A')}")
                else:
                    st.write("No request metadata available.")

                sentiment = result.get("sentiment", "unknown")
                st.metric("Overall sentiment", sentiment.upper())

                st.write("**Affected tickers**")
                tickers = result.get("affectedTickers", [])
                if tickers:
                    for ticker in tickers:
                        st.write(f"- {ticker}")
                else:
                    st.write("None detected")

            with col2:
                st.write("**Summary**")
                st.write(result.get("summary", "No summary available."))

                st.write("**Impact details**")
                details = result.get("impactDetails", [])
                if details:
                    for item in details:
                        with st.container():
                            st.markdown(f"**{item.get('ticker', 'Unknown')}**")
                            st.write(item.get("reasoning", "No reasoning available."))
                            st.caption(f"Sentiment: {item.get('sentiment', 'unknown')}")
                else:
                    st.write("No detailed impacts found.")

        except requests.RequestException as exc:
            st.error(f"Could not fetch latest result: {exc}")
        except Exception as exc:
            st.error(f"Unexpected error while rendering latest result: {exc}")