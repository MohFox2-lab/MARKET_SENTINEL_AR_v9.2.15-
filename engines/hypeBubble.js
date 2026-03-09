const hypeBubbleEngine = {
  // "ميزة خطيرة": كشف تضخيم/تطبيل قبل الانفجار (قواعد قابلة للتفسير)
  detect({ rows, indicatorsSnap, manual }){
    const out = { status:"ok", found:false, strength:0, reasons:[], evidence:{} };
    if(!Array.isArray(rows) || rows.length < 60) { out.status="insufficient"; return out; }
    const last = rows[rows.length-1];
    const prev = rows[rows.length-2];

    // Price acceleration: آخر 10 أيام
    const win = rows.slice(-11);
    const first = win[0];
    const pct = (a,b)=> b? ((a-b)/b) : 0;
    const change10 = pct(last.close, first.close);

    // Volume anomaly: آخر يوم مقارنة بمتوسط 20 يوم
    const vols = rows.slice(-21, -1).map(r=>Number(r.volume||0));
    const avgVol = vols.reduce((s,v)=>s+v,0)/Math.max(1, vols.length);
    const volRatio = avgVol>0 ? (Number(last.volume||0)/avgVol) : 1;

    // RSI overheat
    const rsi = indicatorsSnap && typeof indicatorsSnap.rsi==="number" ? indicatorsSnap.rsi : null;

    // Manual hype score (0..100) if user set it
    const hypeManual = manual?.hypeScore != null ? Number(manual.hypeScore) : null;
    const hypeLevel = (hypeManual==null ? 30 : hypeManual); // default mild

    let strength = 0;

    if(change10 >= 0.25) { strength += 25; out.reasons.push("تسارع سعري قوي خلال 10 أيام"); }
    if(volRatio >= 2.0)  { strength += 25; out.reasons.push("شذوذ سيولة/حجم تداول high مقارنة بالمتوسط"); }
    if(typeof rsi==="number" && rsi >= 78) { strength += 20; out.reasons.push("RSI في منطقة حرارة عالية"); }
    if(hypeLevel >= 70) { strength += 20; out.reasons.push("مؤشر ضجيج/تطبيل high (يدوي)"); }

    // Stronger if candle closes near high (pump-ish)
    const range = Math.max(0.000001, (last.high-last.low));
    const closeNearHigh = ((last.high-last.close)/range) < 0.2;
    if(closeNearHigh && change10>0.15 && volRatio>1.6) { strength += 10; out.reasons.push("close قريب من القمة مع تسارع وسيولة"); }

    strength = Math.max(0, Math.min(100, strength));
    out.strength = strength;
    out.evidence = { change10: Math.round(change10*10000)/100, volRatio: Math.round(volRatio*100)/100, rsi: rsi==null?null:Math.round(rsi), hypeManual: hypeManual };

    if(strength >= 60){
      out.found = true;
      out.reasons.unshift("إنذار مبكر: نمط تضخيم/فقاعة قصيرة محتمل");
    } else {
      out.reasons.push("لا توجد إشارة تضخيم قوية وفق القواعد الحالية");
    }
    return out;
  },

  toAlert(det){
    if(!det || !det.found) return null;
    return {
      id:"A14",
      level: det.strength >= 80 ? "HIGH" : "MEDIUM",
      title:"إنذار تضخيم/تطبيل مبكر",
      why:"اجتماع تسارع سعري + شذوذ سيولة + حرارة زخم/ضجيج قد يسبق انعكاسًا",
      evidence: det.evidence || {},
      penalty: det.strength >= 80 ? 14 : 10
    };
  }
};

window.hypeBubbleEngine = hypeBubbleEngine;window.marketSentinel.hypeBubbleEngine = hypeBubbleEngine;
window.safeEngine.wrap("hypeBubbleEngine");
