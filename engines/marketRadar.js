/**
 * Market Radar Page (Static)
 * يعرض ملخص السوق من آخر التحليلات المخزنة محلياً (Watchlist Analyses).
 * لا يجلب بيانات جديدة — فقط يعرض "أفضل/أخطر" + ملخص القطاعات + ملخص Smart Money + ملخص التنبيهات.
 */
const marketRadarEngine = {
  loadLatest(){
    // Prefer watchlistRadarEngine storage
    try{
      if(window.watchlistRadarEngine && typeof watchlistRadarEngine.loadAnalyses === "function"){
        const arr = watchlistRadarEngine.loadAnalyses() || [];
        const map = new Map();
        for(const item of arr){
          const a = item.analysis ? item.analysis : item;
          const symbol = a.symbol || a?.meta?.symbol || a?.meta?.ticker || a?.input?.symbol;
          if(!symbol) continue;
          const ts = a?.meta?.timestamp || a?.meta?.ts || a?.timestamp || 0;
          const t = ts ? new Date(ts).getTime() : 0;
          const cur = map.get(symbol);
          if(!cur || (t >= (cur._t||0))){
            a._t = t;
            map.set(String(symbol).toUpperCase(), a);
          }
        }
        return Array.from(map.values());
      }
    }catch(e){}
    return [];
  },

  normalize(a){
    const symbol = String(a.symbol || a?.meta?.symbol || "").toUpperCase();
    const trust = Number(a?.trust?.score ?? 0);
    const light = a?.trust?.light || (trust>=80?"GREEN":trust>=50?"YELLOW":"RED");
    const decisionTag = String(a?.decision?.tag || "");
    const opp = Number(a?.opportunity?.score ?? a?.decisionRadar?.opportunity ?? a?.decision?.opportunityScore ?? 0);
    const exit = Number(a?.exitRisk?.score ?? a?.decisionRadar?.exit ?? a?.decision?.exitRiskScore ?? 0);
    const compTag = String(a?.compositeSignals?.tag || "");
    const smf = String((a?.smartMoney?.signal || a?.smartMoney?.tag || a?.smf?.signal || a?.smf?.tag || "")).toUpperCase();
    const lt = (window.liquidityTrapEngine && typeof liquidityTrapEngine.analyze==="function") ? liquidityTrapEngine.analyze(a) : null;
    const ltScore = lt && lt.status==="ok" ? Number(lt.score||0) : 0;

    // market (US/SA) heuristic
    const market = symbol.endsWith(".SR") || /^\d{3,5}(\.SR)?$/.test(symbol) ? "SA" : "US";

    const alerts = Array.isArray(a.alerts) ? a.alerts : [];
    const highs = alerts.filter(x=>String(x.level||"").toUpperCase()==="HIGH").length;
    const meds = alerts.filter(x=>String(x.level||"").toUpperCase()==="MEDIUM").length;

    // Simple radar score (higher = safer / stronger)
    // We prefer Trust + Opportunity - Exit - LiquidityTrap - HighAlerts penalty
    let radarScore = trust*0.5 + opp*0.35 - exit*0.35 - ltScore*0.25 - highs*8 - meds*3;
    radarScore = Math.max(0, Math.min(100, Math.round(radarScore)));

    return { symbol, market, trust, light, decisionTag, opp, exit, compTag, smf, ltScore, highs, meds, radarScore, _t: a._t || 0, raw:a };
  },

  build(){
    const list = this.loadLatest().map(a=>this.normalize(a)).filter(x=>x.symbol);
    // Sort by recency
    list.sort((a,b)=> (b._t||0) - (a._t||0));

    const byScoreDesc = [...list].sort((a,b)=> b.radarScore - a.radarScore);
    const byScoreAsc  = [...list].sort((a,b)=> a.radarScore - b.radarScore);

    const topSafe = byScoreDesc.slice(0,8);
    const topDanger = byScoreAsc.slice(0,8);

    // Market split counts
    const counts = { US:0, SA:0 };
    for(const x of list){ counts[x.market] = (counts[x.market]||0) + 1; }

    // Smart money summary
    let acc=0, dist=0, neutral=0;
    for(const x of list){
      if(x.smf.includes("ACCUM")) acc++;
      else if(x.smf.includes("DISTRIB") || x.smf.includes("SELL") || x.smf.includes("EXIT")) dist++;
      else neutral++;
    }

    // Risk buckets
    let green=0, yellow=0, red=0;
    for(const x of list){
      if(x.light==="GREEN") green++;
      else if(x.light==="YELLOW") yellow++;
      else red++;
    }

    // Sector summary (very simple: from stored portfolio items if present)
    // We only show sectors based on Portfolio Guard to not depend on missing metadata.
    let sectorAgg = {};
    try{
      if(window.portfolioGuardEngine){
        const pf = portfolioGuardEngine.load();
        const evald = portfolioGuardEngine.evaluate(pf);
        sectorAgg = evald?.sector || {};
      }
    }catch(e){ sectorAgg = {}; }

    // Recent time
    const newest = list[0]?._t ? new Date(list[0]._t) : null;

    return {
      status:"ok",
      total:list.length,
      counts,
      topSafe,
      topDanger,
      smartMoney:{ acc, dist, neutral },
      buckets:{ green, yellow, red },
      sectors: sectorAgg,
      newest
    };
  }
};

window.marketRadarEngine = marketRadarEngine;window.marketSentinel.marketRadarEngine = marketRadarEngine;
window.safeEngine.wrap("marketRadarEngine");
