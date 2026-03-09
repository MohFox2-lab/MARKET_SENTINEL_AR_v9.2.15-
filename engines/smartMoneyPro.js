const smartMoneyProEngine = {
  // يعمل إذا كانت البيانات لحظية (وجود time/توقيت)
  isIntraday(rows){
    const t = rows && rows[0] ? (rows[0].time || rows[0].date || "") : "";
    return typeof t === "string" && t.includes(":");
  },

  // Detect if data is daily (from Yahoo Finance or similar)
  isDaily(rows){
    if (!Array.isArray(rows) || rows.length === 0) return false;
    const first = rows[0];
    // Daily data has date but no time with colons
    const hasDate = first.date || first.Date;
    const hasTime = (first.time || first.Time || first.t || "").includes(":");
    return hasDate && !hasTime;
  },

  analyze(rows){
    const out = {
      status: "not_intraday",
      score: 0,
      signal: "NEUTRAL",
      reasons: [],
      evidence: {},
      dataType: "unknown"
    };
    
    if (!Array.isArray(rows) || rows.length < 20) {
      out.status = "insufficient";
      return out;
    }

    // Check if intraday data exists
    if (this.isIntraday(rows)) {
      out.dataType = "intraday";
      // Continue with normal Smart Money Pro analysis
    } 
    // Check if daily data exists (Yahoo Finance, etc.)
    else if (this.isDaily(rows)) {
      out.status = "daily_data_fallback";
      out.dataType = "daily";
      out.reasons.push("🔍 تم كشف بيانات يومية فقط");
      out.reasons.push("Smart Money Pro يتطلب بيانات لحظية (Intraday)");
      out.reasons.push("✓ تم التبديل تلقائياً إلى Smart Money Lite للتحليل");
      out.signal = "LITE_MODE";
      return out;
    }
    else {
      out.status = "not_intraday";
      out.reasons.push("بيانات لحظية غير متاحة — تم استخدام Smart Money Lite");
      return out;
    }

    // تقسيم الجلسة: أول 30% وآخر 30%
    const n = rows.length;
    const earlyN = Math.max(5, Math.floor(n * 0.3));
    const lateN = Math.max(5, Math.floor(n * 0.3));

    const early = rows.slice(0, earlyN);
    const late = rows.slice(n - lateN);

    const sumVol = (arr) => arr.reduce((s,r)=>s+(Number(r.volume||0)),0);
    const volEarly = sumVol(early);
    const volLate = sumVol(late);
    const volTotal = sumVol(rows);

    const first = rows[0];
    const mid = rows[Math.floor(n/2)];
    const last = rows[n-1];

    const pct = (a,b)=> b? ((a-b)/b) : 0;
    const moveEarly = pct(early[early.length-1].close, first.close);
    const moveLate  = pct(last.close, late[0].close);

    // Effort vs Result: حجم كبير مقابل حركة ضعيفة
    const effort = volTotal / Math.max(1, n);
    const result = Math.abs(pct(last.close, first.close));
    const evr = effort > 0 ? result / effort : 0;

    // Scoring
    let score = 0;

    // Accumulation pattern: heavy volume late + positive late move
    if (volLate > volEarly * 1.15 && moveLate > 0.002) {
      score += 8;
      out.reasons.push("سيولة آخر الجلسة أعلى من البداية مع تحسّن سعري (تجميع محتمل)");
    }

    // Distribution pattern: heavy volume late + negative late move
    if (volLate > volEarly * 1.15 && moveLate < -0.002) {
      score -= 10;
      out.reasons.push("سيولة آخر الجلسة أعلى من البداية مع ضغط سعري (تصريف محتمل)");
    }

    // VWAP-ish proxy: mid close vs last close
    if (last.close > mid.close * 1.003) { score += 3; out.reasons.push("السعر يغلق أعلى من متوسط الجلسة (طلب أعلى)"); }
    if (last.close < mid.close * 0.997) { score -= 3; out.reasons.push("السعر يغلق أدنى من متوسط الجلسة (ضغط بيع)"); }

    // effort vs result low => absorption / hidden sell
    if (evr < 0.00002 && volTotal > 0) {
      score -= 4;
      out.reasons.push("جهد (حجم) بلا نتيجة واضحة (امتصاص/تصريف خفي محتمل)");
    }

    score = Math.max(-15, Math.min(15, score));
    out.status = "ok";
    out.score = score;

    if (score >= 6) out.signal = "ACCUMULATION";
    else if (score <= -6) out.signal = "DISTRIBUTION";
    else out.signal = "NEUTRAL";

    out.evidence = {
      volEarly, volLate, volTotal,
      moveEarly: Math.round(moveEarly*10000)/100,
      moveLate: Math.round(moveLate*10000)/100,
      evr
    };

    if (out.reasons.length === 0) out.reasons.push("إشارة لحظية محايدة");
    return out;
  }
};

window.smartMoneyProEngine = smartMoneyProEngine;window.marketSentinel.smartMoneyProEngine = smartMoneyProEngine;
window.safeEngine.wrap("smartMoneyProEngine");
