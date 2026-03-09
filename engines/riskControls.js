const riskControlsEngine = {
  build(analysis){
    const out = {
      status:"ok",
      headline:"",
      level:"",
      controls:[],
      checklist:[],
      disclaim:"هذه إرشادات إدارة مخاطر تفسيريّة مبنية على قواعد داخلية (Static) وليست توصية تداول."
    };
    if(!analysis){ out.status="missing"; return out; }

    const sym = analysis.symbol || analysis?.meta?.symbol || "";
    const trust = Number(analysis?.trust?.score ?? 0);
    const light = analysis?.trust?.light || (trust>=80?"GREEN":trust>=50?"YELLOW":"RED");

    const indicators = analysis?.indicators || {};
    const price = Number(indicators.currentPrice || indicators.price || analysis.currentPrice || 0);
    const sma200 = Number(indicators.sma200 || indicators.SMA200 || 0);
    const sma20  = Number(indicators.sma20  || indicators.SMA20  || 0);
    const rsi = Number(indicators.rsi14 || indicators.RSI || 0);

    const alerts = Array.isArray(analysis.alerts) ? analysis.alerts : [];
    const highs = alerts.filter(a=>String(a.level||"").toUpperCase()==="HIGH");
    const meds  = alerts.filter(a=>String(a.level||"").toUpperCase()==="MEDIUM");

    const comp = analysis?.compositeSignals;
    const compTag = String(comp?.tag||"");
    const decision = analysis?.decision || null;

    const owned = (analysis?.meta?.owned === 1 || analysis?.meta?.owned === true || analysis?.owned === 1);
    const exposure = String(analysis?.meta?.exposure || analysis?.exposure || "MED").toUpperCase(); // LOW/MED/HIGH

    // تحديد مستوى المخاطر العام
    let level = "متوسط";
    if(light==="RED" || trust < 50 || highs.length>=2 || compTag==="SELL_PRESSURE" || compTag==="BLOWOFF_RISK") level = "high";
    else if(light==="GREEN" && trust>=80 && highs.length===0 && compTag!=="BLOWOFF_RISK") level = "low";
    out.level = level;

    out.headline = `إدارة المخاطر — ${sym ? sym : "السهم"} — مستوى مخاطر: ${level}`;

    const controls = [];

    // 1) SMA200
    if(price && sma200){
      if(price < sma200){
        controls.push({
          id:"RC01",
          title:"حماية الاتجاه الطويل (SMA200)",
          severity:"HIGH",
          text:"السعر تحت SMA200 — ضعف هيكلي محتمل. كن أكثر تحفظًا في حجم التعرّض، وركّز على قواعد حماية رأس المال."
        });
      } else {
        controls.push({
          id:"RC01",
          title:"حماية الاتجاه الطويل (SMA200)",
          severity:"LOW",
          text:"السعر فوق SMA200 — الاتجاه الطويل داعم نسبيًا. ما زال يلزم الانتباه للتنبيهات والسيولة."
        });
      }
    }

    // 2) تمدد SMA20
    if(price && sma20){
      const dist = (price - sma20) / sma20 * 100;
      if(dist >= 15){
        controls.push({
          id:"RC02",
          title:"منع التعزيز عند التمدد",
          severity:"MED",
          text:`السعر متمدّد فوق SMA20 بحوالي ${dist.toFixed(1)}% — التعزيز الآن قد يرفع مخاطر الانعكاس. الأفضل انتظار تهدئة/تصحيح أو تأكيد سيولة.`
        });
      }
    }

    // 3) RSI
    if(rsi){
      if(rsi >= 75){
        controls.push({ id:"RC03", title:"فلتر التشبع (RSI)", severity:"MED", text:"RSI high جدًا — احتمال تشبع شراء. تجنّب المطاردة السعرية وراقب أي انعكاس." });
      } else if(rsi <= 25){
        controls.push({ id:"RC03", title:"فلتر التشبع (RSI)", severity:"LOW", text:"RSI low جدًا — قد توجد فرصة ارتداد، لكن تأكد من عدم وجود تصريف/تنبيهات عالية." });
      }
    }

    // 4) إشارات مركبة
    if(compTag==="SELL_PRESSURE"){
      controls.push({ id:"RC04", title:"ضغط بيع مركب", severity:"HIGH", text:"تم رصد ضغط بيع مركب (تصريف + Iceberg + شموع) — شدّد إدارة المخاطر وقلّل التعرّض إن كان highًا." });
    }
    if(compTag==="BLOWOFF_RISK"){
      controls.push({ id:"RC05", title:"خطر قمة/فقاعة", severity:"HIGH", text:"علامات قمة/فقاعة (تضخيم + تصريف + انعكاس) — كن حذرًا جدًا من الانعكاس السريع." });
    }

    // 5) قواعد المالك + التعرض
    if(owned){
      if(exposure==="HIGH" && (level==="high" || highs.length>=1)){
        controls.push({
          id:"RC06",
          title:"التعرّض عالي + مخاطر highة",
          severity:"HIGH",
          text:"بسبب كون التعرّض عالي ووجود مخاطر highة، طبّق تخفيف تدريجي للمخاطر (جني جزء/تقليل حجم المركز) حسب قواعدك."
        });
      } else if(exposure==="LOW" && level==="high"){
        controls.push({
          id:"RC06",
          title:"التعرّض خفيف + مخاطر highة",
          severity:"MED",
          text:"التعرّض خفيف لكن المخاطر highة — انتبه للتنبيهات وحدد حد خسارة واضح ضمن خطتك."
        });
      }
    } else {
      if(level==="high"){
        controls.push({
          id:"RC07",
          title:"قبل الدخول",
          severity:"HIGH",
          text:"قبل أي دخول: راجع التنبيهات العالية والسيولة الذكية. إذا كانت إشارات الخطر قوية، الأفضل المتابعة بدل الدخول."
        });
      }
    }

    // 6) Stop-Loss (إرشادي)
    if(price){
      let pct = 0.0;
      if(level==="low") pct = 6;
      else if(level==="متوسط") pct = 4.5;
      else pct = 3.0;

      if(compTag==="SELL_PRESSURE" || highs.length>=2) pct = Math.max(2.0, pct-1.0);
      if(exposure==="HIGH") pct = Math.max(2.0, pct-0.5);

      const stop = price * (1 - pct/100);
      controls.push({
        id:"RC08",
        title:"حد خسارة إرشادي (Stop-Loss)",
        severity: level==="high" ? "HIGH" : "MED",
        text:`اقتراح إرشادي: تحديد حد خسارة تقريبي حوالي ${pct.toFixed(1)}% أسفل السعر الحالي (≈ ${stop.toFixed(2)}). عدّل حسب تذبذب السهم وخطتك.`
      });
    }

    // 7) Checklist
    const checklist = [
      { id:"CL01", title:"هل توجد تنبيهات HIGH؟", ok: highs.length===0, hint: highs.length ? `يوجد ${highs.length} تنبيه HIGH` : "لا يوجد" },
      { id:"CL02", title:"هل توجد إشارة مركبة خطرة؟", ok: !(compTag==="SELL_PRESSURE" || compTag==="BLOWOFF_RISK"), hint: compTag ? `المركب: ${compTag}` : "—" },
      { id:"CL03", title:"هل الاتجاه الطويل داعم؟ (فوق SMA200)", ok: (price && sma200) ? (price>=sma200) : true, hint: (price && sma200) ? (price>=sma200 ? "فوق SMA200" : "تحت SMA200") : "غير متاح" },
      { id:"CL04", title:"هل السهم غير متمدّد عن SMA20؟", ok: true, hint:"غير متاح" }
    ];
    try{
      if(price && sma20){
        const dist = (price - sma20) / sma20 * 100;
        checklist[3].ok = dist < 15;
        checklist[3].hint = `الفرق: ${dist.toFixed(1)}%`;
      }
    }catch(e){}

    out.controls = controls;
    out.checklist = checklist;
    return out;
  }
};

window.riskControlsEngine = riskControlsEngine;window.marketSentinel.riskControlsEngine = riskControlsEngine;
window.safeEngine.wrap("riskControlsEngine");
