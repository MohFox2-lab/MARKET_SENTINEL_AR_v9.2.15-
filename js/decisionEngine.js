const decisionEngine = {
  /**
   * القرار Support Layer (Static)
   * Outputs: administrative risk posture (Opportunity vs Risk) with confidence + reasons.
   * NOTE: This is risk classification/support, not a trading recommendation.
   */
  getDecision: function (result) {
    const score = Number(result?.trust?.score ?? 0);

    const alerts = Array.isArray(result?.alerts) ? result.alerts : [];
    const high = alerts.filter(a => (a.level || "").toUpperCase() === "HIGH").length;
    const med  = alerts.filter(a => {
      const lv = (a.level || '').toUpperCase();
      return lv === 'MED' || lv === 'MEDIUM';
    }).length;

    const hasDataQualityHigh = alerts.some(a => a.id === "A12" && (a.level || "").toUpperCase() === "HIGH");

    // Administrative posture (avoid imperative buy/sell language)
    let tag = "AVOID";
    let label = "بيع";
    let colorClass = "text-danger border-danger";

    // ✅ Opportunity high
    if (score >= 80 && high === 0) {
      tag = "OPPORTUNITY_HIGH";
      label = "شراء / زيادة الكمية";
      colorClass = "text-success border-success";
    }
    // ✅ Opportunity (Cautious)
    else if (score >= 70 && high <= 1) {
      tag = "OPPORTUNITY_CAUTION";
      label = "شراء";
      colorClass = "text-success border-success";
    }
    // 🟡 Monitor
    else if (score >= 55) {
      tag = "MONITOR";
      label = "احتفاظ / تحت المتابعة";
      colorClass = "text-warning border-warning";
    }
    // 🔴 high Risk (reduce exposure)
    else if (score >= 40) {
      tag = "HIGH_RISK";
      label = "تصريف جزء منها";
      colorClass = "text-danger border-danger";
    }
    // 🔴 Avoid
    else {
      tag = "AVOID";
      label = "بيع";
      colorClass = "text-danger border-danger";
    }

    // Confidence (simple + explainable)
    let confidence = "متوسط";
    if (hasDataQualityHigh) confidence = "منخفض";
    else if (high === 0 && score >= 75) confidence = "عالي";
    else if (high >= 2 || score < 45) confidence = "عالي"; // high confidence that risk is high

    // الأسباب (Top 5)
    const reasons = [];

    // التنبيهات first (explainable)
    if (high > 0) reasons.push(`تنبيهات عالية: ${high}`);
    if (med > 0) reasons.push(`تنبيهات متوسطة: ${med}`);

    // Context
    const regime = (result?.context?.regime || "").toUpperCase();
    if (regime === "UPTREND") reasons.push("السياق الفني: اتجاه صاعد");
    if (regime === "DOWNTREND") reasons.push("السياق الفني: اتجاه هابط");
    if (regime === "RANGE") reasons.push("السياق الفني: نطاق/تذبذب");
    if (regime === "VOLATILE") reasons.push("السياق الفني: تقلب عالي");

    // RSI hints
    const rsi = result?.context?.lastRsi;
    if (typeof rsi === "number" && rsi >= 75) reasons.push("RSI عالي (احتمال تمدد/تشبع شرائي)");
    if (typeof rsi === "number" && rsi <= 25) reasons.push("RSI منخفض (تشبع بيعي/تذبذب)");

    // Liquidity
    const lg = (result?.liquidity?.grade || "").toUpperCase();
    if (lg === "A") reasons.push("السيولة: قوية");
    if (lg === "D") reasons.push("السيولة: ضعيفة (حساسية أعلى للتلاعب)");

    // Smart Money
    const sm = (result?.smartMoney?.state || "").toUpperCase();
    if (sm === "ACCUMULATION") reasons.push("الأموال الذكية: تجميع محتمل");
    if (sm === "DISTRIBUTION") reasons.push("الأموال الذكية: تصريف محتمل");

    // غير متصل advanced layers (manual/static)
    const et = result?.earningsTrend;
    if (et && et.reason) reasons.push(et.reason);
    const sc = result?.sectorCompare;
    if (sc && sc.reason) reasons.push(sc.reason);
    const hd = result?.hypeDetector;
    if (hd && hd.reason) reasons.push(hd.reason);

    // Sector Heatmap
    const sh = result?.sectorHeatmap;
    if (sh && sh.reason) reasons.push(sh.reason);

    // Cross Market
    const cm = result?.crossMarket;
    if (cm && cm.reasons && cm.reasons[0]) reasons.push(cm.reasons[0]);

    // Smart Money Pro
    const comp = result?.compositeSignals;
    if(comp && comp.tag && comp.tag !== 'NEUTRAL' && comp.tag !== 'NONE'){
      reasons.push(`إشارة مركبة: ${comp.tag}`);
      if(Array.isArray(comp.reasons) && comp.reasons[0]) reasons.push(comp.reasons[0]);
    }

    const cs = result?.candlestickSignals;
    if (cs && cs.top) {
      const conf = Number(cs.confidence||0);
      // نذكره كسبب ثانوي فقط
      reasons.push(`إشارة شموع: ${cs.top.ar} (ثقة ${conf}%)`);
    }

    const smp = result?.smartMoneyPro;
    if (smp && smp.status === 'ok') {
      if (smp.signal === 'ACCUMULATION') reasons.push('Smart Money Pro: تجميع لحظي');
      else if (smp.signal === 'DISTRIBUTION') reasons.push('Smart Money Pro: تصريف لحظي');
      else reasons.push('Smart Money Pro: إشارة محايدة');
    }

    // Ensure at least 3 reasons
    while (reasons.length < 3) reasons.push("القرار مبني بالكامل على المؤشرات الحالية");

    return {
      tag,
      label,
      confidence,
      colorClass,
      reasons: reasons.slice(0, 5),
      note: "هذا التحليل مبني بالكامل على المؤشرات الفنية والكمية المتوفرة في التطبيق ولا يستخدم الذكاء الاصطناعي."
    };
  }
};

window.decisionEngine = decisionEngine;
