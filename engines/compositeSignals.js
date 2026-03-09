const compositeSignalsEngine = {
  detect(input){
    const out = { status:"ok", tag:"NONE", scoreAdj:0, alerts:[], reasons:[] };

    const cs = input?.candlestickSignals;
    const smp = input?.smartMoneyPro;
    const sml = input?.smartMoney;
    const ice = input?.iceberg;
    const mr  = input?.marketRadar;
    const hb  = input?.hypeBubble;
    const alerts = Array.isArray(input?.alerts) ? input.alerts : [];

    const hiAlerts = alerts.filter(a=>String(a.level||"").toUpperCase()==="HIGH").length;

    const candle = cs && cs.top ? cs.top : null;
    const cConf = Number(cs?.confidence || 0);

    const proDist = (smp && smp.status==="ok" && smp.signal==="DISTRIBUTION");
    const proAcc  = (smp && smp.status==="ok" && smp.signal==="ACCUMULATION");
    const liteDist = (sml && sml.state==="DISTRIBUTION");
    const liteAcc  = (sml && sml.state==="ACCUMULATION");

    const iceStrong = ice && ice.status==="ok" && Number(ice.score||0) >= 70;
    const iceMed    = ice && ice.status==="ok" && Number(ice.score||0) >= 45;

    const hypeHigh  = hb && hb.status==="ok" && Number(hb.score||0) >= 70;

    const marketRed = (mr && mr.status==="ok" && mr.light==="RED");
    const marketGreen = (mr && mr.status==="ok" && mr.light==="GREEN");

    const isBull = candle && String(candle.type||"").startsWith("BULL");
    const isBear = candle && String(candle.type||"").startsWith("BEAR");

    // 🔴 ضغط بيع مركب: تصريف لحظي + Iceberg + شمعة هابطة قوية
    if((proDist || liteDist) && (iceStrong || iceMed) && isBear && cConf >= 55){
      out.tag = "SELL_PRESSURE";
      out.scoreAdj -= 3; // تأثير خفيف على Trust
      out.reasons.push("تم رصد ضغط بيع مركب (تصريف + Iceberg + إشارة شموع هابطة)");
      out.alerts.push({
        id:"A16",
        title:"ضغط بيع مركب",
        level:"HIGH",
        penalty:8,
        why:"تزامن تصريف الأموال الذكية مع اشتباه Iceberg وإشارة شموع هابطة — احتمال انعكاس/هبوط أعلى."
      });
      return out;
    }

    // 🟢 إعداد دخول مركب: تجميع + سوق داعم + شمعة صاعدة قوية وبدون تنبيهات عالية كثيرة
    if((proAcc || liteAcc) && marketGreen && isBull && cConf >= 60 && hiAlerts <= 1 && !hypeHigh){
      out.tag = "STRONG_SETUP";
      out.scoreAdj += 2;
      out.reasons.push("إعداد إيجابي مركب (تجميع + سوق داعم + شمعة صاعدة)");
      out.alerts.push({
        id:"A17",
        title:"إعداد إيجابي مركب",
        level:"MEDIUM",
        penalty:0,
        why:"تجميع مع سوق داعم وإشارة شموع إيجابية — أفضلية دخول أعلى وفق القواعد (ليست توصية)."
      });
      return out;
    }

    // ⚠️ خطر قمة/فقاعة: تضخيم عالي + تصريف + شمعة انعكاس هابط
    if(hypeHigh && (proDist || liteDist) && isBear && cConf >= 50){
      out.tag = "BLOWOFF_RISK";
      out.scoreAdj -= 2;
      out.reasons.push("خطر قمة/فقاعة: تضخيم + تصريف + انعكاس شموع");
      out.alerts.push({
        id:"A18",
        title:"خطر قمة/فقاعة",
        level:"HIGH",
        penalty:9,
        why:"ارتفاع تضخيم/ضجيج مع تصريف وإشارة انعكاس هابط — خطر قمة قصيرة أعلى."
      });
      return out;
    }

    // Neutral
    out.tag = "NEUTRAL";
    out.reasons.push("لا توجد إشارة مركبة قوية — الاعتماد على الطبقات الأساسية.");
    return out;
  }
};

window.compositeSignalsEngine = compositeSignalsEngine;window.marketSentinel.compositeSignalsEngine = compositeSignalsEngine;
window.safeEngine.wrap("compositeSignalsEngine");
