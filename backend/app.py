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

    if st.button("Refresh latest", disabled=not backend_ok):
        st.rerun()

    if backend_ok:
        try:
            res = requests.get(f"{API_BASE}/latest", timeout=5)
            res.raise_for_status()
            latest = res.json()

            if "result" not in latest:
                st.info("No analysis has been run yet.")
            else:
                st.write("**Last request**")
                st.json(latest["request"])

                st.write("**Last result**")
                st.json(latest["result"])

        except requests.RequestException as exc:
            st.error(f"Could not fetch latest result: {exc}")