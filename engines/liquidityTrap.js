/**
 * Liquidity Trap Detector (Static)
 * الهدف: كشف حالات "سيولة كبيرة + متابعة ضعيفة" التي غالباً تسبق تصريف/هبوط سريع.
 * لا يعطي توصية شراء/بيع — فقط "تحذير مبكر" مع أسباب.
 */
const liquidityTrapEngine = {
  analyze(analysis){
    const out = {
      status:"ok",
      symbol: analysis?.symbol || analysis?.meta?.symbol || "",
      score: 0,        // 0..100
      level: "LOW",    // LOW/MED/HIGH
      label: "لا توجد إشارات قوية لفخ سيولة",
      reasons: [],
      metrics: {}
    };
    if(!analysis){ out.status="missing"; return out; }

    const ind = analysis?.indicators || {};
    const price = Number(ind.currentPrice || ind.price || analysis.currentPrice || 0);
    const sma20 = Number(ind.sma20 || ind.SMA20 || 0);
    const rsi = Number(ind.rsi14 || ind.RSI || 0);
    const volRatio = Number(ind.volumeRatio || ind.volRatio || ind.volume_ratio || 0);
    const atr = Number(ind.atr || 0);
    const avgPrice = Number(ind.avgPrice || 0);

    const alerts = Array.isArray(analysis.alerts) ? analysis.alerts : [];
    const highs = alerts.filter(a=>String(a.level||"").toUpperCase()==="HIGH");

    const candles = analysis?.candlestickSignals || {};
    const topCandle = candles?.top || null;
    const candleType = String(topCandle?.type || topCandle?.label || "");

    const iceberg = analysis?.icebergDetection || analysis?.iceberg || null;
    const icebergHit = !!(iceberg && (iceberg?.detected || iceberg?.flag || iceberg?.score>=70));

    const smf = analysis?.smartMoney || analysis?.smf || null;
    const smfSignal = String(smf?.signal || smf?.tag || smf?.state || "");

    // 1) حجم غير طبيعي
    let score = 0;
    if(volRatio){
      out.metrics.volRatio = volRatio;
      if(volRatio >= 2.2){ score += 28; out.reasons.push("حجم تداول أعلى بكثير من المعتاد (Volume Ratio high)."); }
      else if(volRatio >= 1.6){ score += 18; out.reasons.push("حجم تداول أعلى من المعتاد (Volume Ratio)."); }
      else if(volRatio >= 1.2){ score += 8; }
    }

    // 2) تمدد سعري فوق SMA20
    if(price && sma20){
      const dist = (price - sma20) / sma20 * 100;
      out.metrics.sma20DistPct = dist;
      if(dist >= 15){ score += 22; out.reasons.push("السعر متمدّد بقوة فوق SMA20 — احتمال مطاردة/فقاعة قصيرة."); }
      else if(dist >= 10){ score += 14; out.reasons.push("السعر بعيد عن SMA20 — يحتاج تأكيد سيولة صحية."); }
      else if(dist >= 6){ score += 7; }
    }

    // 3) تشبع RSI + ضعف متابعة (إشارة احتمالية)
    if(rsi){
      out.metrics.rsi = rsi;
      if(rsi >= 78){ score += 14; out.reasons.push("RSI high جدًا — تشبع شراء قد يتحول لالتقاط قمة."); }
      else if(rsi >= 72){ score += 10; out.reasons.push("RSI high — راقب أي انعكاس."); }
    }

    // 4) شموع انعكاس
    const bearishCandles = ["BEARISH_ENGULFING","SHOOTING_STAR","HANGING_MAN","EVENING_STAR","DARK_CLOUD_COVER","GRAVESTONE_DOJI"];
    const neutralCandle = ["DOJI","SPINNING_TOP"];
    if(candleType){
      out.metrics.candle = candleType;
      if(bearishCandles.includes(candleType)){
        score += 18;
        out.reasons.push("تم رصد شمعة انعكاسية هابطة — قد تكون بداية تصريف.");
      } else if(neutralCandle.includes(candleType)){
        score += 8;
        out.reasons.push("شمعة تردد (Doji/Spinning Top) مع سيولة — قد تعني ضعف متابعة.");
      }
    }

    // 5) Iceberg
    if(icebergHit){
      score += 16;
      out.reasons.push("تم رصد Iceberg/أوامر مخفية محتملة — مؤشر تصريف/امتصاص.");
    }

    // 6) Smart Money signal
    if(smfSignal){
      out.metrics.smf = smfSignal;
      const s = smfSignal.toUpperCase();
      if(s.includes("DISTRIB") || s.includes("SELL") || s.includes("EXIT")){
        score += 18;
        out.reasons.push("إشارة سيولة ذكية تميل للتصريف (Distribution).");
      } else if(s.includes("ACCUM")){
        score -= 8;
      }
    }

    // 7) تنبيهات عالية موجودة
    if(highs.length){
      score += Math.min(12, highs.length * 6);
      out.reasons.push("يوجد تنبيهات HIGH — يزيد احتمال فخ السيولة.");
    }

    // 8) تذبذب عالي (اختياري)
    if(atr && avgPrice){
      const vol = avgPrice > 0 ? (atr/avgPrice*100) : 0;
      out.metrics.volatilityPct = vol;
      if(vol >= 6){ score += 10; out.reasons.push("تذبذب high (ATR/AvgPrice) — الفخاخ أكثر شيوعًا."); }
      else if(vol >= 4){ score += 6; }
    }

    // clamp
    score = Math.max(0, Math.min(100, Math.round(score)));
    out.score = score;

    // level
    if(score >= 70){
      out.level = "HIGH";
      out.label = "⚠️ احتمال فخ سيولة high";
    } else if(score >= 45){
      out.level = "MED";
      out.label = "⚠️ احتمال فخ سيولة متوسط";
    } else {
      out.level = "LOW";
      out.label = "✅ لا توجد إشارات قوية لفخ سيولة";
    }

    // تنظيم أسباب (اختصار)
    out.reasons = Array.from(new Set(out.reasons)).slice(0,6);
    if(out.reasons.length === 0){
      out.reasons.push("الإشارات الحالية لا تدعم وجود فخ سيولة واضح.");
    }

    return out;
  }
};

window.liquidityTrapEngine = liquidityTrapEngine;window.marketSentinel.liquidityTrapEngine = liquidityTrapEngine;
window.safeEngine.wrap("liquidityTrapEngine");
