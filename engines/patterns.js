const patternsEngine = {
  // مكتبة أنماط التلاعب (قابلة للتوسع)
  LIB: [
    { id:"P01", title:"Pump & Dump", ar:"تضخيم ثم تصريف", keyAlerts:["A14","A05","A07"], weight: 3 },
    { id:"P02", title:"Fake Breakout", ar:"اختراق كاذب", keyAlerts:["A01"], weight: 2 },
    { id:"P03", title:"Trend Trap", ar:"فخ اتجاه", keyAlerts:["A02"], weight: 2 },
    { id:"P04", title:"Liquidity Trap", ar:"فخ سيولة", keyAlerts:["A07"], weight: 2 },
    { id:"P05", title:"Institutional Distribution", ar:"تصريف مؤسسي", keyAlerts:["A05"], weight: 3 },
    { id:"P06", title:"Iceberg", ar:"أوامر مخفية/امتصاص", keyAlerts:["A13"], weight: 3 }
  ],

  detect(result){
    const out = { status:"ok", patterns:[], top:null, reasons:[] };
    const alerts = Array.isArray(result?.alerts) ? result.alerts : [];
    const ids = new Set(alerts.map(a=>String(a.id||"").toUpperCase()));
    const scored = [];

    for(const p of this.LIB){
      const hits = p.keyAlerts.filter(a => ids.has(a));
      if(hits.length){
        const score = hits.length * (p.weight || 1);
        scored.push({ ...p, score, hits });
      }
    }

    // دعم إشارات SmartMoneyPro
    const smp = result?.smartMoneyPro;
    if(smp && smp.status==="ok" && smp.signal==="DISTRIBUTION"){
      scored.push({ id:"P07", title:"Late Session Distribution", ar:"تصريف لحظي (آخر الجلسة)", score: 2, hits:["SmartMoneyPro"] });
    }

    scored.sort((a,b)=>b.score-a.score);
    out.patterns = scored.slice(0,5);
    out.top = out.patterns[0] || null;

    if(out.top){
      out.reasons.push(`تم رصد نمط: ${out.top.ar}`);
      if(out.top.hits && out.top.hits.length){
        out.reasons.push(`السبب: إشارات (${out.top.hits.join("، ")})`);
      }
    } else {
      out.reasons.push("لم يتم رصد نمط تلاعب واضح وفق القواعد الحالية");
    }

    return out;
  }
};

window.patternsEngine = patternsEngine;window.marketSentinel.patternsEngine = patternsEngine;
window.safeEngine.wrap("patternsEngine");
