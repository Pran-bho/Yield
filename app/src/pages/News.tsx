import { useState, useEffect } from 'react';
import type { Holding, NewsArticle } from '../types';
import { colorFor, timeAgo } from '../utils/format';
import { fetchNews } from '../utils/api';

interface Props {
  holdings: Holding[];
}

type ArticleGroup = Record<string, [NewsArticle, Date | null][]>;

function groupArticles(articles: NewsArticle[]): ArticleGroup {
  const now = new Date();
  const td  = now.toDateString();
  const yd  = new Date(now.getTime() - 86400000).toDateString();
  const wk  = new Date(now.getTime() - 7 * 86400000);

  const groups: ArticleGroup = { Today: [], Yesterday: [], 'This Week': [], Older: [] };

  for (const a of articles) {
    const d  = a.publishedAt ? new Date(a.publishedAt) : null;
    const ds = d?.toDateString();
    if (ds === td)          groups['Today'].push([a, d]);
    else if (ds === yd)     groups['Yesterday'].push([a, d]);
    else if (d && d >= wk)  groups['This Week'].push([a, d]);
    else                    groups['Older'].push([a, d]);
  }
  return groups;
}

export default function News({ holdings }: Props) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  async function load() {
    if (!holdings.length) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      setArticles(await fetchNews(holdings.map(h => h.ticker)));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [holdings.map(h => h.ticker).join(',')]);

  const groups = groupArticles(articles);

  return (
    <>
      <div className="ph" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="ph-title">◈ NEWS<span>.</span></div>
          <div className="ph-sub">recent · non-paywalled · your holdings</div>
        </div>
        <button className="btn-ghost" onClick={load} style={{ marginTop: 4 }}>↻ Refresh</button>
      </div>

      {loading ? (
        <div className="no-data"><span className="spinner" />Fetching news…</div>
      ) : error ? (
        <div className="no-data" style={{ color: 'var(--neg)' }}>
          Failed to load news — is the engine running?
        </div>
      ) : !holdings.length ? (
        <div className="no-data">Add holdings to see news.</div>
      ) : !articles.length ? (
        <div className="no-data" style={{ padding: 40 }}>No recent non-paywalled articles found.</div>
      ) : (
        Object.entries(groups).map(([g, items]) => {
          if (!items.length) return null;
          return (
            <div key={g}>
              <div className="news-grp">
                {g} · {items.length} article{items.length !== 1 ? 's' : ''}
              </div>
              {items.map(([a]) => (
                <div key={a.url + a.title} className="news-card">
                  <div className="news-top">
                    <span className="news-tk" style={{ color: colorFor(a.ticker) }}>{a.ticker}</span>
                    <span className="news-time">{timeAgo(a.publishedAt)}</span>
                  </div>
                  <div className="news-title">{a.title}</div>
                  <div className="news-bot">
                    <span className="news-src">{a.source}</span>
                    <a className="news-open" href={a.url} target="_blank" rel="noopener noreferrer">↗ open</a>
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </>
  );
}
