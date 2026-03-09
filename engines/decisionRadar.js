const decisionRadarEngine = {
  // تحويل confidence النصية إلى نسبة تقريبية
  confidenceToPct(conf){
    const c = String(conf||"").trim();
    if(c === "high") return 82;
    if(c === "متوسط") return 60;
    if(c === "low") return 38;
    return 55;
  },

  build(analysis){
    const out = { status:"ok", headline:"", pct:55, buckets:[], reasons:[], note:"" };
    if(!analysis){ out.status="missing"; return out; }

    const decision = analysis.decision || (window.decisionEngine && decisionEngine.getDecision ? decisionEngine.getDecision(analysis) : null);
    if(!decision){ out.status="missing_decision"; return out; }

    const score = Number(analysis?.trust?.score ?? 0);
    const pct = this.confidenceToPct(decision.confidence);
    out.pct = pct;

    // Buckets مثل المنصات (لكن بصيغة نظامية)
    const buckets = [
      { id:"B1", title:"أفضلية دخول highة", tag:"OPPORTUNITY_HIGH", icon:"🟢", hint:"إشارات داعمة مع مخاطر lowة نسبيًا" },
      { id:"B2", title:"أفضلية دخول بحذر", tag:"OPPORTUNITY_CAUTION", icon:"🟡", hint:"إشارات جيدة لكن يوجد سبب/سببان للحذر" },
      { id:"B3", title:"تحت المتابعة", tag:"MONITOR", icon:"🟠", hint:"انتظر تأكيد/هدوء أو تحسن جودة البيانات" },
      { id:"B4", title:"خطر high (تخفيف تعرّض)", tag:"HIGH_RISK", icon:"🔴", hint:"إشارات خطر تستدعي تقليل المخاطر" },
      { id:"B5", title:"تجنّب", tag:"AVOID", icon:"⛔", hint:"مخاطر highة أو بيانات غير موثوقة" }
    ];

    // تحديد البكت المختار
    const selectedTag = String(decision.tag||"AVOID");
    out.buckets = buckets.map(b => ({...b, active: selectedTag === b.tag }));

    // عنوان مختصر
    out.headline = `${decision.label} — ثقة ${pct}% — Trust ${score}/100`;

    // أسباب
    out.reasons = Array.isArray(decision.reasons) ? decision.reasons.slice(0,6) : [];
    if(out.reasons.length < 3){
      out.reasons.push("طبّق إدارة مخاطر صارمة ولا تبالغ بحجم التعرّض");
      out.reasons.push("راجع السيولة والتنبيهات قبل اتخاذ أي إجراء");
    }

    // ملاحظة
    out.note = "هذا رادار قرار تفسيري مبني على قواعد (Static) — ليس توصية تداول ملزمة.";

    return out;
  }
};

window.decisionRadarEngine = decisionRadarEngine;window.marketSentinel.decisionRadarEngine = decisionRadarEngine;
window.safeEngine.wrap("decisionRadarEngine");
