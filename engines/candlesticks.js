const candlestickEngine = {
  // حساب خصائص الشمعة
  candleParts(c){
    const o = Number(c.فتح);
    const h = Number(c.high);
    const l = Number(c.low);
    const cl = Number(c.close);
    const range = Math.max(1e-9, h - l);
    const body = Math.abs(cl - o);
    const upper = h - Math.max(o, cl);
    const lower = Math.min(o, cl) - l;
    return { o,h,l,cl,range,body,upper,lower, bodyRatio: body/range, upperRatio: upper/range, lowerRatio: lower/range };
  },

  // أنماط أساسية (مركّزة على الأكثر فائدة)
  detect(rows){
    const out = { status:"ok", patterns:[], top:null, confidence:0, reasons:[], evidence:{} };
    if(!Array.isArray(rows) || rows.length < 5){ out.status="insufficient"; return out; }

    const a = rows[rows.length-3];
    const b = rows[rows.length-2];
    const c = rows[rows.length-1];

    const pa = this.candleParts(a);
    const pb = this.candleParts(b);
    const pc = this.candleParts(c);

    const isGreen = (x)=> x.close > x.فتح;
    const isRed   = (x)=> x.close < x.فتح;

    // Doji
    if(pc.bodyRatio <= 0.12){
      out.patterns.push({ id:"C01", ar:"دوجي (تردد)", type:"NEUTRAL", strength: 35, why:"جسم صغير جدًا يدل على تردد السوق" });
    }

    // Hammer / Hanging Man (lower wick long)
    const hammerLike = pc.lowerRatio >= 0.55 && pc.upperRatio <= 0.20 && pc.bodyRatio <= 0.35;
    if(hammerLike){
      const t = isGreen(c) ? "BULL" : "BULL_WEAK";
      out.patterns.push({ id:"C02", ar:"شمعة مطرقة (Hammer)", type:t, strength: isGreen(c)? 65:55, why:"ذيل سفلي طويل مع جسم صغير قد يشير لاحتمال انعكاس" });
    }

    // Shooting Star (upper wick long)
    const shooting = pc.upperRatio >= 0.55 && pc.lowerRatio <= 0.20 && pc.bodyRatio <= 0.35;
    if(shooting){
      const t = isRed(c) ? "BEAR" : "BEAR_WEAK";
      out.patterns.push({ id:"C03", ar:"نجمة ساقطة (Shooting Star)", type:t, strength: isRed(c)? 65:55, why:"ذيل علوي طويل مع جسم صغير قد يشير لاحتمال انعكاس هابط" });
    }

    // Engulfing
    const prevBodyHigh = Math.max(Number(b.فتح), Number(b.close));
    const prevBodyLow  = Math.min(Number(b.فتح), Number(b.close));
    const curBodyHigh  = Math.max(Number(c.فتح), Number(c.close));
    const curBodyLow   = Math.min(Number(c.فتح), Number(c.close));
    const engulf = (curBodyHigh >= prevBodyHigh) && (curBodyLow <= prevBodyLow) && pb.bodyRatio >= 0.2 && pc.bodyRatio >= 0.25;
    if(engulf && isGreen(c) && isRed(b)){
      out.patterns.push({ id:"C04", ar:"ابتلاع شرائي (Bullish Engulfing)", type:"BULL", strength: 75, why:"شمعة صاعدة تبتلع جسم شمعة هابطة سابقة" });
    }
    if(engulf && isRed(c) && isGreen(b)){
      out.patterns.push({ id:"C05", ar:"ابتلاع بيعي (Bearish Engulfing)", type:"BEAR", strength: 75, why:"شمعة هابطة تبتلع جسم شمعة صاعدة سابقة" });
    }

    // Morning Star / Evening Star (تقريبي 3 شموع)
    // morning: red -> small -> green closing into first body
    if(isRed(a) && pa.bodyRatio>0.25 && pb.bodyRatio<0.20 && isGreen(c) && pc.bodyRatio>0.25){
      const midA = (Number(a.فتح)+Number(a.close))/2;
      if(Number(c.close) > midA){
        out.patterns.push({ id:"C06", ar:"نجمة الصباح (Morning Star)", type:"BULL", strength: 80, why:"نمط 3 شموع قد يدل على انعكاس صاعد" });
      }
    }
    // evening: green -> small -> red closing into first body
    if(isGreen(a) && pa.bodyRatio>0.25 && pb.bodyRatio<0.20 && isRed(c) && pc.bodyRatio>0.25){
      const midA = (Number(a.فتح)+Number(a.close))/2;
      if(Number(c.close) < midA){
        out.patterns.push({ id:"C07", ar:"نجمة المساء (Evening Star)", type:"BEAR", strength: 80, why:"نمط 3 شموع قد يدل على انعكاس هابط" });
      }
    }

    // pick top
    out.patterns.sort((x,y)=> (y.strength||0)-(x.strength||0));
    out.top = out.patterns[0] || null;

    if(!out.top){
      out.reasons.push("لا توجد إشارة شموع قوية وفق القواعد الحالية");
      out.confidence = 0;
      return out;
    }

    out.reasons.push(`تم رصد: ${out.top.ar}`);
    out.reasons.push(out.top.why);

    // Confidence is NOT final; it is adjusted later with context (market/smart money)
    out.confidence = Math.round(out.top.strength);

    out.evidence = {
      last: { open:Number(c.فتح), high:Number(c.high), low:Number(c.low), close:Number(c.close) }
    };

    return out;
  },

  // دمج ذكي: تعديل الثقة حسب طبقات النظام (حتى لا تكون الشموع مضللة)
  contextualize(det, result){
    if(!det || det.status!=="ok") return det;
    if(!det.top) return det;

    let conf = Number(det.confidence||0);

    // إذا Smart Money Pro/ Lite يشير لتصريف، نقلل الثقة في أنماط صعود
    const smLite = result?.smartMoney;
    const smPro = result?.smartMoneyPro;
    const dist = (smPro && smPro.status==="ok" && smPro.signal==="DISTRIBUTION") || (smLite && smLite.state==="DISTRIBUTION");

    if(dist && det.top.type && det.top.type.startsWith("BULL")){
      conf -= 25;
      det.reasons.push("تم تخفيض ثقة الشموع لأن السيولة الذكية تشير لتصريف");
    }

    // سياق السوق إذا RED يقلل الثقة الإيجابية
    const mr = result?.marketRadar;
    if(mr && mr.status==="ok" && mr.light==="RED" && det.top.type && det.top.type.startsWith("BULL")){
      conf -= 15;
      det.reasons.push("تم تخفيض ثقة الشموع لأن رادار السوق يشير لبيئة خطرة");
    }

    // إذا تنبيهات HIGH كثيرة يقلل الثقة
    const alerts = Array.isArray(result?.alerts) ? result.alerts : [];
    const hi = alerts.filter(a=>String(a.level||"").toUpperCase()==="HIGH").length;
    if(hi >= 2){
      conf -= 10;
      det.reasons.push("تم تخفيض ثقة الشموع بسبب وجود تنبيهات عالية متعددة");
    }

    conf = Math.max(0, Math.min(100, Math.round(conf)));
    det.confidence = conf;

    // ملاحظة إدارية
    det.note = "الشموع أداة مساعدة — تم ربطها مع السيولة/السياق لتقليل الإشارات الكاذبة.";

    return det;
  }
};

window.candlestickEngine = candlestickEngine;window.marketSentinel.candlestickEngine = candlestickEngine;
window.safeEngine.wrap("candlestickEngine");
