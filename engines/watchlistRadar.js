const watchlistRadarEngine = {
  // استخراج آخر التحليلات المخزنة محلياً (حسب تطبيقك)
  // نحاول عدة مفاتيح محتملة حتى لا نكسر الهيكل
  loadAnalyses(){
    try{
      if(Array.isArray(window.analysisResults) && window.analysisResults.length){
        return window.analysisResults.slice();
      }
    }catch(e){}

    const keys = [
      "MS_LAST_ANALYSES", "MS_ANALYSES", "MARKET_SENTINEL_ANALYSES",
      "analysisHistory", "ms_history", "ms_snapshots"
    ];
    for(const k of keys){
      try{
        const raw = localStorage.getItem(k);
        if(!raw) continue;
        const data = JSON.parse(raw);
        if(Array.isArray(data)) return data;
        if(data && Array.isArray(data.items)) return data.items;
        if(data && typeof data === "object"){
          // ربما object keyed by symbol
          const arr = Object.values(data);
          if(Array.isArray(arr) && arr.length) return arr;
        }
      }catch(e){}
    }

    // fallback: إذا كان التطبيق لا يخزن تاريخ، نأخذ lastAnalysis فقط
    try{
      if(window.lastAnalysis) return [window.lastAnalysis];
    }catch(e){}

    return [];
  },

  // normalize analysis item
  norm(item){
    if(!item) return null;
    const a = item.analysis ? item.analysis : item;
    const symbol = a.symbol || a?.meta?.symbol || a?.meta?.ticker || a?.input?.symbol;
    if(!symbol) return null;
    const trust = Number(a?.trust?.score ?? a?.trustScore ?? 0);
    const traffic = a?.trust?.light || a?.traffic || (trust>=80?"GREEN":trust>=50?"YELLOW":"RED");
    const decision = a.decision || (window.decisionEngine && decisionEngine.getDecision ? decisionEngine.getDecision(a) : null);
    const reasons = Array.isArray(decision?.reasons) ? decision.reasons.slice(0,3) : [];
    const ts = a?.meta?.timestamp || a?.meta?.ts || a?.timestamp || null;
    return { symbol, trust, traffic, decision, reasons, ts, raw:a };
  },

  build(){
    const out = { status:"ok", opportunities:[], highRisk:[], note:"" };
    const items = this.loadAnalyses().map(x=>this.norm(x)).filter(Boolean);

    // إزالة التكرار بأحدث عنصر لكل سهم
    const map = new Map();
    for(const it of items){
      const cur = map.get(it.symbol);
      if(!cur) { map.set(it.symbol, it); continue; }
      // اختر الأحدث إن توفر ts
      const t1 = cur.ts ? new Date(cur.ts).getTime() : 0;
      const t2 = it.ts ? new Date(it.ts).getTime() : 0;
      if(t2 >= t1) map.set(it.symbol, it);
    }
    const uniq = Array.from(map.values());

    // فرص: Trust عالي + قرار فرصة
    const opp = uniq
      .filter(x=> (x.trust>=70) && ["OPPORTUNITY_HIGH","OPPORTUNITY_CAUTION"].includes(String(x.decision?.tag||"")))
      .sort((a,b)=> (b.trust-a.trust));

    // مخاطر: Trust low أو قرار خطر/تجنب
    const risk = uniq
      .filter(x=> (x.trust<55) || ["HIGH_RISK","AVOID"].includes(String(x.decision?.tag||"")))
      .sort((a,b)=> (a.trust-b.trust));

    out.opportunities = opp.slice(0,10);
    out.highRisk = risk.slice(0,10);

    out.note = "القوائم مبنية على آخر التحليلات المحفوظة محليًا (Static). حلّل أسهم قائمة المراقبة أولاً لتعبئة القوائم.";

    return out;
  }
};

window.watchlistRadarEngine = watchlistRadarEngine;window.marketSentinel.watchlistRadarEngine = watchlistRadarEngine;
window.safeEngine.wrap("watchlistRadarEngine");
