const fetchLiveEngine = {
  normalizeSymbol(symbol){
    let s = String(symbol || "").trim().toUpperCase();
    if(!s) return s;
    if(/^\d{3,5}$/.test(s)) s = `${s}.SR`;
    return s;
  },

  getProxyBase(){
    try{
      const saved = (localStorage.getItem("MS_PROXY_URL") || "").trim();
      if(saved) return saved.replace(/\/+$/,'');
    }catch(e){}
    return "";
  },

  buildYahooUrl(symbol, range="6mo", interval="1d"){
    const s = encodeURIComponent(this.normalizeSymbol(symbol));
    const r = encodeURIComponent(range);
    const i = encodeURIComponent(interval);
    return `https://query1.finance.yahoo.com/v8/finance/chart/${s}?range=${r}&interval=${i}&includePrePost=false&events=div%%7Csplit`;
  },

  buildRequestUrl(symbol, range="6mo", interval="1d"){
    const yahooUrl = this.buildYahooUrl(symbol, range, interval);
    const proxy = this.getProxyBase();

    if(proxy){
      if(/workers\.dev/i.test(proxy) || /\/yahoo\b/i.test(proxy) || /\/api\/yahoo\b/i.test(proxy)){
        return `${proxy}/yahoo?symbol=${encodeURIComponent(this.normalizeSymbol(symbol))}&range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
      }
      return `${proxy}?url=${encodeURIComponent(yahooUrl)}`;
    }
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;
  },

  async fetchChart(symbol, range="6mo", interval="1d"){
    const url = this.buildRequestUrl(symbol, range, interval);
    const res = await fetch(url, { method:"GET" });
    if(!res.ok) throw new Error(`فشل جلب البيانات (${res.status})`);
    return await res.json();
  },

  yahooToRows(json){
    const r = json?.chart?.result?.[0];
    if(!r) throw new Error("الاستجابة لا تحتوي على بيانات سعرية");
    const timestamps = r.timestamp || [];
    const q = r.indicators?.quote?.[0] || {};
    const opens = q.open || [];
    const highs = q.high || [];
    const lows = q.low || [];
    const closes = q.close || [];
    const volumes = q.volume || [];

    const rows = [];
    for(let i=0;i<timestamps.length;i++){
      const o = Number(opens[i]);
      const h = Number(highs[i]);
      const l = Number(lows[i]);
      const c = Number(closes[i]);
      const v = Number(volumes[i] || 0);
      if(!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
      const dt = new Date(timestamps[i]*1000);
      const date = dt.toISOString().slice(0,10);
      rows.push({
        date,
        time: dt.toISOString(),
        فتح: o,
        high: h,
        low: l,
        close: c,
        volume: isFinite(v) ? v : 0
      });
    }
    if(!rows.length) throw new Error("لم يتم استخراج أي صفوف من بيانات Yahoo");
    return rows;
  }
};

window.fetchLiveEngine = fetchLiveEngine;window.marketSentinel.fetchLiveEngine = fetchLiveEngine;
window.safeEngine.wrap("fetchLiveEngine");
