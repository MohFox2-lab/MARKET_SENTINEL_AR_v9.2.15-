const icebergEngine = {
  // كشف تقريبي للـ Iceberg من OHLCV اليومي/اللحظي:
  // "حجم كبير + نطاق ضيق + تكرار" => امتصاص/أوامر مخفية
  detect(rows){
    const out = { status:"ok", found:false, strength:0, reasons:[], evidence:{} };
    if(!Array.isArray(rows) || rows.length < 30) { out.status="insufficient"; return out; }

    const lastN = rows.slice(-30);
    const ranges = lastN.map(r => Math.max(0.000001, (r.high - r.low)));
    const avgRange = ranges.reduce((s,v)=>s+v,0)/ranges.length;

    // volume baseline
    const vols = lastN.map(r=>Number(r.volume||0));
    const avgVol = vols.reduce((s,v)=>s+v,0)/Math.max(1, vols.length);

    let hits = 0;
    const hitIdx = [];
    for(let i=0;i<lastN.length;i++){
      const r = lastN[i];
      const range = Math.max(0.000001, (r.high - r.low));
      const vol = Number(r.volume||0);
      const body = Math.abs(r.close - r.فتح);
      const bodyRatio = body / range;
      const narrow = range < avgRange * 0.6;
      const heavy = vol > avgVol * 1.8;
      const smallBody = bodyRatio < 0.35;
      if(narrow && heavy && smallBody){
        hits++;
        hitIdx.push(i);
      }
    }

    if(hits >= 2){
      out.found = true;
      out.strength = Math.min(100, 40 + hits*15);
      out.reasons.push("نمط Iceberg محتمل: حجم high مع نطاق ضيق متكرر");
      out.evidence = { hits, avgRange: Math.round(avgRange*10000)/10000, avgVol: Math.round(avgVol), hitIdx };
    } else {
      out.reasons.push("لا توجد إشارات Iceberg قوية حاليًا");
    }
    return out;
  },

  toAlert(det){
    if(!det || !det.found) return null;
    return {
      id:"A13",
      level: det.strength >= 70 ? "HIGH" : "MEDIUM",
      title: "Iceberg محتمل (أوامر مخفية)",
      why: "تكرار حجم high بنطاق ضيق قد يشير لأوامر مؤسسية مخفية",
      evidence: det.evidence || {},
      penalty: det.strength >= 70 ? 12 : 8
    };
  }
};

window.icebergEngine = icebergEngine;window.marketSentinel.icebergEngine = icebergEngine;
window.safeEngine.wrap("icebergEngine");
