const portfolioRadarEngine = {
  // يعتمد على قائمة المراقبة الموجودة في localStorage (watchlist)
  getWatchlist(){
    try{
      const raw = localStorage.getItem("MS_WATCHLIST");
      const arr = raw ? JSON.parse(raw) : [];
      if(Array.isArray(arr)) return arr;
    } catch(e){}
    return [];
  },

  setWatchlist(arr){
    try{ localStorage.setItem("MS_WATCHLIST", JSON.stringify(arr||[])); } catch(e){}
  },

  summarize(items){
    const out = { status:"ok", score:50, light:"YELLOW", counts:{green:0,yellow:0,red:0}, topRisks:[] };
    if(!Array.isArray(items) || items.length===0){
      out.status="empty";
      return out;
    }
    // score average of trust, penalize reds
    const avg = items.reduce((s,x)=>s+(Number(x.trustScore||50)),0)/items.length;
    const reds = items.filter(x=>x.traffic==="RED").length;
    const yell = items.filter(x=>x.traffic==="YELLOW").length;
    const grn = items.filter(x=>x.traffic==="GREEN").length;
    out.counts = { green: grn, yellow: yell, red: reds };
    out.score = Math.round(avg - reds*3);

    if(out.score >= 75) out.light="GREEN";
    else if(out.score >= 55) out.light="YELLOW";
    else out.light="RED";

    out.topRisks = items
      .slice()
      .sort((a,b)=> (a.trustScore||0)-(b.trustScore||0))
      .slice(0,5)
      .map(x=>({ symbol:x.symbol, trustScore:x.trustScore, traffic:x.traffic }));

    return out;
  }
};

window.portfolioRadarEngine = portfolioRadarEngine;window.marketSentinel.portfolioRadarEngine = portfolioRadarEngine;
window.safeEngine.wrap("portfolioRadarEngine");
