
async function retryOnce(fn) {
  try { return await fn(); }
  catch (e1) {
    // محاولة ثانية واحدة فقط
    return await fn();
  }
}


// === Proxy Worker (Allowlisted) Support ===
// إذا استخدمت Cloudflare Worker مخصص (Allowlisted) نرسل طلبًا داخليًا للـ Worker
// مثال رابط الـ Worker: https://YOUR_SUBDOMAIN.workers.dev
function isAllowlistedWorkerProxy(proxyBase = "") {
  const p = String(proxyBase || "").trim();
  // أي رابط Workers أو مسار /yahoo نعتبره Worker
  return /workers\.dev/i.test(p) || /\/yahoo\b/i.test(p) || /\/api\/yahoo\b/i.test(p);
}

function normalizeBase(url = "") {
  const u = String(url || "").trim();
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function buildYahooChartUrl(symbol, range, interval) {
  const s = encodeURIComponent(symbol);
  const r = encodeURIComponent(range);
  const i = encodeURIComponent(interval);
  return `https://query1.finance.yahoo.com/v8/finance/chart/${s}?range=${r}&interval=${i}&includePrePost=false&events=div%7Csplit`;
}

function buildWorkerYahooUrl(proxyBase, symbol, range, interval) {
  const base = normalizeBase(proxyBase);
  const s = encodeURIComponent(symbol);
  const r = encodeURIComponent(range);
  const i = encodeURIComponent(interval);
  // مسار Worker المقترح: /yahoo?symbol=...&range=...&interval=...
  return `${base}/yahoo?symbol=${s}&range=${r}&interval=${i}`;
}

async function fetchYahooChart(symbol, range, interval, proxyBase) {
  const yahooUrl = buildYahooChartUrl(symbol, range, interval);
  const proxy = String(proxyBase || "").trim();

  // 1) Worker allowlisted proxy
  if (proxy && isAllowlistedWorkerProxy(proxy)) {
    const workerUrl = buildWorkerYahooUrl(proxy, symbol, range, interval);
    const res = await fetch(workerUrl, { method: "GET" });
    if (!res.ok) throw new Error(`فشل جلب البيانات عبر Worker: ${res.status}`);
    return await res.json();
  }

  // 2) Generic proxy (encode target url)
  if (proxy) {
    const base = normalizeBase(proxy);
    const u = `${base}?url=${encodeURIComponent(yahooUrl)}`;
    const res = await fetch(u, { method: "GET" });
    if (!res.ok) throw new Error(`فشل جلب البيانات عبر البروكسي: ${res.status}`);
    return await res.json();
  }

  // 3) Direct (قد يفشل بسبب CORS في المتصفح)
  const res = await fetch(yahooUrl, { method: "GET" });
  if (!res.ok) throw new Error(`فشل جلب البيانات من Yahoo: ${res.status}`);
  return await res.json();
}


// js/fetchEngine.js
// Static جلب Engine (via Cloudflare عامل (Worker) بروكسي) — no server, no DB
// Uses ياهو Finance chart endpoint through an allowlisted proxy to avoid CORS issues.
//
// To configure proxy URL:
// localStorage.setItem('MS_PROXY_URL', 'https://YOUR_WORKER_SUBDOMAIN.workers.dev');
//
// NOTE: This is a data fetch utility only. Analysis remains local/static.

window.fetchEngine = {
  getProxyUrl() {
    return (localStorage.getItem('MS_PROXY_URL') || "").trim().replace(/\/+$/,'');
  },

  setProxyUrl(url) {
    localStorage.setItem('MS_PROXY_URL', String(url || "").trim());
  },

  async fetchYahooChart({ symbol, range = "6mo", interval = "1d" }) {
    const proxy = this.getProxyUrl();
    if (!proxy) throw new Error("لم يتم ضبط رابط الـ بروكسي. ضع رابط Cloudflare عامل (Worker) في الإعدادات أولاً.");
    if (!symbol) throw new Error("أدخل symbol أولاً.");

    const url = `${proxy}/yahoo?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const txt = await safeText(res);
      throw new Error(`فشل جلب البيانات (${res.status}). ${txt || ""}`.trim());
    }
    const data = await res.json();
    return data;
  },

  yahooToRows(chartJson) {
    // ياهو: chart.result[0].timestamp + indicators.quote[0].فتح/high/low/close/volume
    const result = chartJson?.chart?.result?.[0];
    if (!result) throw new Error("بيانات ياهو غير صالحة (result فارغ).");

    const ts = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens = quote.فتح || [];
    const highs = quote.high || [];
    const lows  = quote.low || [];
    const closes= quote.close || [];
    const vols  = quote.volume || [];

    const rows = [];
    for (let i = 0; i < ts.length; i++) {
      const c = num(closes[i]);
      const v = num(vols[i]);
      // some entries may be null; skip incomplete days
      if (!(c > 0) || !(v >= 0)) continue;

      rows.push({
        date: unixToISO(ts[i]),
        فتح: num(opens[i]),
        high: num(highs[i]),
        low:  num(lows[i]),
        close: c,
        volume: v
      });
    }
    if (rows.length < 10) throw new Error("البيانات قليلة أو غير مكتملة بعد التحويل. جرّب مدى زمني أطول.");
    return rows;
  }
};

function unixToISO(sec) {
  const d = new Date(sec * 1000);
  // YYYY-MM-DD
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
async function safeText(res) {
  try { return (await res.text()).slice(0, 200); } catch { return ""; }
}


window.marketSentinel.fetchEngine = window.fetchEngine;
