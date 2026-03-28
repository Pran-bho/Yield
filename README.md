# ◈ YIELD

> **Hackathon theme: Creative manipulation of data**
>
> Yield takes raw financial news and transforms it through NLP and quantitative finance into
> personalised, actionable portfolio signals — turning unstructured text into position-sizing
> guidance backed by the Kelly Criterion.

---

## What it does

1. **Browser extension** — Browse to any financial news article. The extension scrapes the
   title and body, sends it to the local engine, and the dashboard updates in real-time.

2. **NLP engine (FinBERT + sentence embeddings)** — The article text is analysed for
   sentiment (positive / negative / neutral) and matched against a semantic theme bank and
   company bank to detect which of your holdings are materially affected.

3. **Kelly Criterion position sizing** — For each impacted holding the engine computes a
   Half-Kelly fraction based on the detected sentiment and confidence score, then translates
   that fraction into a concrete buy / sell / hold recommendation expressed as an allocation
   percentage and an implied dollar trade size.

4. **React dashboard** — A SPA served by the FastAPI backend with three views:
   - **Analysis** — per-holding signal cards with justification, confidence, Kelly guidance,
     implied trade size, and evidence quotes. Stores and displays the last 3 scanned articles.
   - **Portfolio** — donut allocation chart, position manager, and AI suggestions scoped to
     your current book.
   - **News** — non-paywalled RSS headlines grouped by recency for each holding.

---

## Architecture

```
Yield/
├── Frontend/          # Chrome extension (TypeScript + esbuild)
│   ├── src/
│   └── manifest.json
│
├── app/               # React dashboard (Vite + TypeScript)
│   └── src/
│       ├── pages/      # Analysis · Portfolio · News
│       ├── components/ # SuggestionCard · Sidebar
│       └── utils/      # api · kelly · format
│
└── backend/           # FastAPI engine
    ├── main.py         # REST API + static file serving
    └── engine.py       # FinBERT · embeddings · theme/company detection
```

---

## Running locally

### 1 — Backend

```bash
cd Yield/backend
pip install -r ../requirements.txt
uvicorn main:app --reload --port 8000
```

The engine warms up FinBERT and the sentence-transformer on first start (~10 s).

### 2 — React dashboard (dev)

```bash
cd Yield/app
npm install
npm run dev          # → http://localhost:3000
```

Build and serve from FastAPI instead:

```bash
npm run build        # outputs to backend/static/
# then visit http://localhost:8000
```

### 3 — Chrome extension

1. `cd Yield/Frontend && npm install && npm run build`
2. Open `chrome://extensions` → Enable **Developer mode** → **Load unpacked** → select `Yield/Frontend`

---

## Signal card breakdown

Each card shown for an impacted holding contains four key pieces of information:

| Field | What it means |
|---|---|
| **Confidence** | FinBERT's probability that the detected sentiment is correct (0–100 %). Colour-coded: green ≥ 65 %, amber ≥ 40 %, grey below. |
| **Justification** | The NLP engine's plain-English explanation of *why* this ticker was flagged, plus the strongest supporting quote extracted verbatim from the article. |
| **Kelly sizing** | Current vs suggested allocation %, the raw Half-Kelly fraction (f\* × 0.5, b = 1.5), and a direction pill: ↑ increase / ↓ reduce / · maintain. |
| **Implied trade** | Dollar value you would need to buy or sell to reach the suggested allocation — e.g. "↑ buy $2,340" or "↓ sell $890". |

> Half-Kelly (f\* × 0.5) is used to account for model uncertainty. b = 1.5 reflects a typical
> equity reward-to-risk ratio. **For informational purposes only — not financial advice.**

---

## Analysis history

The dashboard keeps the last **3 scanned articles** in `localStorage`. The selector at the top
of the Analysis page lets you flip between them to compare how different news events affect
your holdings over time.

---

## Tech stack

| Layer | Tech |
|---|---|
| NLP | FinBERT (`ProsusAI/finbert`), `sentence-transformers` |
| Backend | Python 3.14, FastAPI, Uvicorn |
| Dashboard | React 18, Vite, TypeScript, Chart.js |
| Extension | TypeScript, esbuild, Chrome MV3 |
