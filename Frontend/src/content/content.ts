import { ArticleData } from "../types";

function extractArticle(): ArticleData {
  const title = document.title || "";

  const candidates = [
    document.querySelector("article"),
    document.querySelector('[role="main"]'),
    document.querySelector("main"),
    document.querySelector(".article-body"),
    document.querySelector(".post-content"),
    document.querySelector(".entry-content"),
    document.body,
  ];

  const bodyEl = candidates.find(Boolean) as Element;
  const clone = bodyEl.cloneNode(true) as Element;

  const junk = [
    "nav", "header", "footer", "aside", "script", "style",
    "noscript", "iframe", "form", ".ad", ".ads", ".advertisement",
    ".cookie-banner", ".popup", ".modal", ".sidebar", ".related",
    ".comments", ".social-share", ".newsletter", ".promo",
  ];
  junk.forEach((sel) => {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  });

  const body = (clone as HTMLElement).innerText || clone.textContent || "";
  return { title: title.trim(), body: body.trim() };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "EXTRACT_ARTICLE") {
    sendResponse(extractArticle());
  }
  return true;
});
