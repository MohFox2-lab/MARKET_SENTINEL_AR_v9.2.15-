const advancedUI = {
  renderCrossMarket(analysis){
    const box = document.getElementById("crossmarket-box");
    if(!box) return;
    const cm = analysis?.crossMarket;
    if(!cm){ box.innerHTML = `<div class="text-sm text-gray-600">غير متاح.</div>`; return; }
    if(cm.status !== "ok"){
      box.innerHTML = `<div class="text-sm text-gray-600">${(cm.reasons && cm.reasons[0]) || "لم يتم تحميل السياق العالمي"}</div>`;
      return;
    }
    const badge = cm.conflict ? `<span class="px-2 py-1 text-xs rounded bg-red-100 text-red-800">تعارض</span>`
                             : `<span class="px-2 py-1 text-xs rounded bg-green-100 text-green-800">متوافق/محايد</span>`;
    const list = (cm.reasons||[]).map(r=>`<li class="mb-1">• ${r}</li>`).join("");
    const bms = (cm.evidence?.benchmarks||[]).map(b=>`<div class="text-xs bg-white rounded border p-2"><div class="font-semibold">${b.symbol}</div><div class="text-gray-600">النظام: ${b.regime}</div></div>`).join("");
    box.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="font-bold">السياق العالمي/المرجعي</div>
        ${badge}
      </div>
      <ul class="text-sm text-gray-700 mb-3">${list}</ul>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">${bms || ""}</div>
      <div class="text-xs text-gray-500 mt-3">ملاحظة: يتم تحميل المؤشرات المرجعية عبر بروكسي البيانات عند الضغط على "حلّل".</div>
    `;
  },

  renderSectorHeatmap(analysis){
    const grid = document.getElementById("sector-heatmap-grid");
    const select = document.getElementById("sector-select");
    const btnSave = document.getElementById("sector-save");
    const symEl = document.getElementById("sector-symbol");
    if(symEl) symEl.textContent = analysis?.symbol || "-";

    const sh = analysis?.sectorHeatmap || null;
    const db = sh?.heatmap || (window.sectorHeatmapEngine ? sectorHeatmapEngine.loadDB() : []);

    if(select){
      select.innerHTML = `<option value="">اختر القطاع</option>` + db.map(x=>`<option value="${x.key}">${x.key}</option>`).join("");
      const cur = sh?.sector || (window.sectorHeatmapEngine ? sectorHeatmapEngine.getSectorForSymbol(analysis?.symbol||"") : null);
      if(cur) select.value = cur;
    }
    if(btnSave){
      btnSave.onclick = () => {
        const sym = analysis?.symbol || "";
        const val = select?.value || "";
        if(!sym){ ui.showToast("حلّل سهمًا أولاً", "error"); return; }
        if(!val){ ui.showToast("اختر قطاعًا أولاً", "error"); return; }
        sectorHeatmapEngine.setSectorForSymbol(sym, val);
        ui.showToast("تم حفظ قطاع السهم", "success");
        // rerender
        const updated = sectorHeatmapEngine.analyze({ symbol: sym });
        analysis.sectorHeatmap = updated;
        renderStockDetails(analysis);
        this.renderSectorHeatmap(analysis);
      };
    }

    if(grid){
      const sorted = db.slice().sort((a,b)=> (b.score||0)-(a.score||0));
      grid.innerHTML = sorted.map(item=>{
        const s = Number(item.score||0);
        const cls = s>=20 ? "bg-green-100 border-green-200 text-green-900"
                 : s<=-20 ? "bg-red-100 border-red-200 text-red-900"
                 : "bg-gray-50 border-gray-200 text-gray-800";
        return `<div class="p-3 rounded-lg border ${cls}">
          <div class="font-semibold text-sm">${item.key}</div>
          <div class="text-xs mt-1 opacity-80">قوة/ضغط: ${s}</div>
        </div>`;
      }).join("");
    }

    const note = document.getElementById("sector-note");
    if(note){
      note.textContent = sh?.reason || "يمكنك تحديد قطاع السهم ليؤثر بشكل بسيط على القرار والأسباب.";
    }
  },

  renderSmartMoneyPro(analysis){
    const box = document.getElementById("smpro-box");
    if(!box) return;
    const smp = analysis?.smartMoneyPro;
    if(!smp){
      box.innerHTML = `<div class="text-sm text-gray-600">غير متاح.</div>`;
      return;
    }
    const badge = smp.signal==="ACCUMULATION" ? `<span class="px-2 py-1 text-xs rounded bg-green-100 text-green-800">تجميع</span>`
                : smp.signal==="DISTRIBUTION" ? `<span class="px-2 py-1 text-xs rounded bg-red-100 text-red-800">تصريف</span>`
                : `<span class="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">محايد</span>`;
    const reasons = (smp.reasons||[]).slice(0,5).map(r=>`<li class="mb-1">• ${r}</li>`).join("");
    box.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="font-bold">Smart Money Pro (لحظي)</div>
        ${badge}
      </div>
      <div class="text-sm text-gray-700 mb-2">الدرجة: <span class="font-bold">${smp.score}</span></div>
      <ul class="text-sm text-gray-700">${reasons}</ul>
      <div class="text-xs text-gray-500 mt-3">ملاحظة: يعمل Pro فقط عند توفر بيانات لحظية (وجود وقت).</div>
    `;
  },

  renderIceberg(analysis){
    const box = document.getElementById("iceberg-box");
    if(!box) return;
    const det = analysis?.iceberg;
    if(!det){ box.innerHTML = `<div class="text-sm text-gray-600">غير متاح.</div>`; return; }
    const badge = det.found ? `<span class="px-2 py-1 text-xs rounded bg-red-100 text-red-800">محتمل</span>`
                            : `<span class="px-2 py-1 text-xs rounded bg-green-100 text-green-800">غير ظاهر</span>`;
    box.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="font-bold">Iceberg Detection</div>
        ${badge}
      </div>
      <div class="text-sm text-gray-700 mb-2">القوة: <span class="font-bold">${det.strength}</span>/100</div>
      <ul class="text-sm text-gray-700">${(det.reasons||[]).map(r=>`<li class="mb-1">• ${r}</li>`).join("")}</ul>
      <div class="text-xs text-gray-500 mt-3">تفسير: حجم high بنطاق ضيق متكرر قد يعني أوامر مخفية/امتصاص.</div>
    `;
  }
};

window.advancedUI = advancedUI;

advancedUI.renderMarketRadar = function(analysis){
  const box = document.getElementById("market-radar-box");
  if(!box) return;
  const mr = analysis?.marketRadar;
  if(!mr){
    box.innerHTML = `<div class="text-sm text-gray-600">غير متاح.</div>`;
    return;
  }
  if(mr.status !== "ok"){
    box.innerHTML = `<div class="text-sm text-gray-600">لم يتم تحميل بيانات السوق المرجعية بعد. قم بتحليل سهم أولًا.</div>`;
    return;
  }
  const badge = mr.light==="GREEN" ? `<span class="px-2 py-1 text-xs rounded bg-green-100 text-green-800">🟢 داعم</span>`
             : mr.light==="YELLOW" ? `<span class="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">🟡 حذر</span>`
             : `<span class="px-2 py-1 text-xs rounded bg-red-100 text-red-800">🔴 خطر</span>`;
  const comps = (mr.components||[]).map(c=>`<div class="text-xs bg-white rounded border p-2"><div class="font-semibold">${c.symbol}</div><div class="text-gray-600">الحالة: ${c.regime}</div><div class="text-gray-700">الدرجة: ${c.score}</div></div>`).join("");
  const reasons = (mr.reasons||[]).map(r=>`<li class="mb-1">• ${r}</li>`).join("");
  box.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="font-bold">رادار السوق العام</div>
      ${badge}
    </div>
    <div class="text-sm text-gray-700 mb-2">درجة السوق: <span class="font-bold">${mr.score}</span>/100</div>
    <ul class="text-sm text-gray-700 mb-3">${reasons}</ul>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">${comps}</div>
  `;
};

advancedUI.renderPatterns = function(analysis){
  const box = document.getElementById("patterns-box");
  if(!box) return;
  const p = analysis?.patterns;
  if(!p){
    box.innerHTML = `<div class="text-sm text-gray-600">غير متاح.</div>`;
    return;
  }
  const top = p.top ? `<div class="p-3 rounded border bg-gray-50 mb-3"><div class="font-bold">النمط الأرجح:</div><div class="text-lg font-bold mt-1">${p.top.ar}</div><div class="text-sm text-gray-600 mt-1">إشارات: ${(p.top.hits||[]).join("، ")}</div></div>` : "";
  const list = (p.patterns||[]).map(x=>`<div class="p-3 rounded border bg-white"><div class="font-semibold">${x.ar}</div><div class="text-xs text-gray-500 mt-1">Score: ${x.score} — Hits: ${(x.hits||[]).join("، ")}</div></div>`).join("");
  const reasons = (p.reasons||[]).map(r=>`<li class="mb-1">• ${r}</li>`).join("");
  box.innerHTML = `
    ${top}
    <div class="text-sm text-gray-700 mb-2"><ul>${reasons}</ul></div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${list || ""}</div>
    <div class="text-xs text-gray-500 mt-3">ملاحظة: هذه أنماط قواعدية قابلة للتفسير وليست حكمًا قطعيًا.</div>
  `;
};

advancedUI.renderRiskTimeline = function(analysis){
  const box = document.getElementById("timeline-box");
  if(!box) return;
  const t = analysis?.riskTimeline;
  if(!t){
    box.innerHTML = `<div class="text-sm text-gray-600">غير متاح.</div>`;
    return;
  }
  if(t.status !== "ok"){
    box.innerHTML = `<div class="text-sm text-gray-600">بيانات غير كافية لبناء خط زمني.</div>`;
    return;
  }
  const pill = (lvl)=> lvl==="HIGH" ? "bg-red-100 text-red-800" : (lvl==="MEDIUM" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800");
  const rows = (t.events||[]).map(e=>`
    <div class="p-3 rounded border bg-white">
      <div class="flex items-center justify-between mb-1">
        <div class="text-sm font-semibold">${e.title}</div>
        <span class="px-2 py-1 text-xs rounded ${pill((e.level||"MEDIUM").toUpperCase())}">${(e.level||"MEDIUM").toUpperCase()}</span>
      </div>
      <div class="text-xs text-gray-500 mb-1">${e.when}</div>
      <div class="text-sm text-gray-700">${e.detail || ""}</div>
    </div>
  `).join("");
  box.innerHTML = `<div class="grid grid-cols-1 gap-2">${rows}</div>`;
};

advancedUI.renderPortfolioRadar = function(analysisList){
  const box = document.getElementById("portfolio-radar-box");
  if(!box) return;

  const list = Array.isArray(analysisList) && analysisList.length
    ? analysisList.slice()
    : (Array.isArray(window.analysisResults) ? window.analysisResults.slice() : []);

  const normalized = list.map(function(item){
    const a = item && item.analysis ? item.analysis : item;
    if(!a || !a.symbol) return null;
    const trustScore = Number(a?.trust?.score ?? a?.trustScore ?? 0);
    const traffic = a?.trust?.light || a?.traffic || (trustScore >= 75 ? '🟢' : trustScore >= 50 ? '🟡' : '🔴');
    return {
      symbol: a.symbol,
      trustScore,
      traffic,
      updatedAt: a.updatedAt || a?.meta?.timestamp || Date.now()
    };
  }).filter(Boolean);

  const latestMap = new Map();
  normalized.forEach(function(item){ latestMap.set(item.symbol, item); });
  const uniq = Array.from(latestMap.values());

  if(!uniq.length){
    box.innerHTML = `<div class="text-sm text-gray-600">قم بتحليل عدة أسهم ثم ارجع هنا.</div>`;
    return;
  }

  const counts = { green: 0, yellow: 0, red: 0 };
  uniq.forEach(function(item){
    if(item.trustScore >= 75) counts.green += 1;
    else if(item.trustScore >= 50) counts.yellow += 1;
    else counts.red += 1;
  });

  const avg = uniq.reduce((sum, item) => sum + item.trustScore, 0) / uniq.length;
  const score = Math.round(avg);
  const light = score >= 75 ? 'GREEN' : score >= 50 ? 'YELLOW' : 'RED';
  const topRisks = uniq.slice().sort((a,b) => a.trustScore - b.trustScore).slice(0, 5);

  try {
    localStorage.setItem('MS_LAST_PORTFOLIO_ANALYSIS', JSON.stringify({ score, light, counts, topRisks }));
  } catch(e) {}

  const badge = light==="GREEN" ? `<span class="px-2 py-1 text-xs rounded bg-green-100 text-green-800">🟢 جيد</span>`
             : light==="YELLOW" ? `<span class="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">🟡 حذر</span>`
             : `<span class="px-2 py-1 text-xs rounded bg-red-100 text-red-800">🔴 خطر</span>`;
  const top = topRisks.map(x=>`<li class="mb-1">• ${x.symbol} — ${x.trustScore} (${x.traffic})</li>`).join("");
  box.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="font-bold">رادار المحفظة</div>
      ${badge}
    </div>
    <div class="text-sm text-gray-700 mb-2">عدد الأسهم المحللة: <span class="font-bold">${uniq.length}</span></div>
    <div class="text-sm text-gray-700 mb-2">متوسط المخاطر/الثقة: <span class="font-bold">${score}</span>/100</div>
    <div class="text-sm text-gray-700 mb-2">توزيع الإشارات: 🟢 ${counts.green} — 🟡 ${counts.yellow} — 🔴 ${counts.red}</div>
    <div class="text-sm font-semibold mt-3 mb-1">أعلى مخاطر:</div>
    <ul class="text-sm text-gray-700">${top || "<li>—</li>"}</ul>
  `;
};


advancedUI.renderCandles = function(analysis){
  const box = document.getElementById("candles-box");
  if(!box) return;
  const cs = analysis?.candlestickSignals;
  if(!cs){
    box.innerHTML = `<div class="text-sm text-gray-600">غير متاح.</div>`;
    return;
  }
  if(cs.status !== "ok"){
    box.innerHTML = `<div class="text-sm text-gray-600">بيانات غير كافية لاستخراج الشموع.</div>`;
    return;
  }
  const top = cs.top ? cs.top.ar : "—";
  const conf = Number(cs.confidence||0);
  const badge = conf >= 70 ? `<span class="px-2 py-1 text-xs rounded bg-green-100 text-green-800">قوي</span>`
             : conf >= 40 ? `<span class="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">متوسط</span>`
             : `<span class="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">ضعيف</span>`;

  const list = (cs.patterns||[]).slice(0,6).map(p=>`<div class="p-3 rounded border bg-white"><div class="font-semibold">${p.ar}</div><div class="text-xs text-gray-500 mt-1">القوة: ${p.strength} — ${p.why}</div></div>`).join("");
  const reasons = (cs.reasons||[]).map(r=>`<li class="mb-1">• ${r}</li>`).join("");

  box.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="font-bold">إشارة الشموع الحالية</div>
      ${badge}
    </div>
    <div class="text-sm text-gray-700 mb-2">النمط الأبرز: <span class="font-bold">${top}</span></div>
    <div class="text-sm text-gray-700 mb-2">ثقة النمط بعد ربطه بالسياق: <span class="font-bold">${conf}%</span></div>
    <ul class="text-sm text-gray-700 mb-3">${reasons}</ul>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${list || ""}</div>
    <div class="text-xs text-gray-500 mt-3">${cs.note || "الشموع طبقة مساعدة فقط."}</div>
  `;
};


advancedUI.renderComposite = function(analysis){
  const box = document.getElementById("composite-box");
  if(!box) return;
  const c = analysis?.compositeSignals;
  if(!c){
    box.innerHTML = `<div class="text-sm text-gray-600">غير متاح.</div>`;
    return;
  }
  if(c.status !== "ok"){
    box.innerHTML = `<div class="text-sm text-gray-600">غير متاح.</div>`;
    return;
  }
  const tag = c.tag || "NEUTRAL";
  const badge = tag==="STRONG_SETUP" ? `<span class="px-2 py-1 text-xs rounded bg-green-100 text-green-800">🟢 إيجابي</span>`
             : tag==="SELL_PRESSURE" ? `<span class="px-2 py-1 text-xs rounded bg-red-100 text-red-800">🔴 ضغط بيع</span>`
             : tag==="BLOWOFF_RISK" ? `<span class="px-2 py-1 text-xs rounded bg-red-100 text-red-800">⚠️ قمة/فقاعة</span>`
             : `<span class="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">محايد</span>`;
  const reasons = (c.reasons||[]).map(r=>`<li class="mb-1">• ${r}</li>`).join("");
  const note = c.scoreAdj ? `تأثير على Trust: ${c.scoreAdj > 0 ? '+' : ''}${c.scoreAdj}` : "بدون تأثير مباشر";
  box.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="font-bold">الإشارات المركبة</div>
      ${badge}
    </div>
    <div class="text-sm text-gray-700 mb-2">النتيجة: <span class="font-bold">${tag}</span></div>
    <div class="text-xs text-gray-500 mb-3">${note}</div>
    <ul class="text-sm text-gray-700">${reasons || "<li>—</li>"}</ul>
    <div class="text-xs text-gray-500 mt-3">هذه طبقة تجميعية (شموع + سيولة + Iceberg + سياق) لتقليل الإشارات الكاذبة.</div>
  `;
};


advancedUI.renderDecisionRadar = function(analysis){
  const box = document.getElementById("decision-radar-box");
  if(!box) return;

  const rd = (window.decisionRadarEngine && typeof decisionRadarEngine.build === "function")
    ? decisionRadarEngine.build(analysis)
    : null;

  if(!rd || rd.status !== "ok"){
    box.innerHTML = `<div class="text-sm text-gray-600">قم بتحليل سهم أولاً لعرض رادار القرار.</div>`;
    return;
  }

  const cards = (rd.buckets||[]).map(b=>{
    const cls = b.active ? "border-2 border-black bg-white" : "border border-gray-200 bg-gray-50";
    return `
      <div class="p-4 rounded-xl ${cls}">
        <div class="flex items-center justify-between mb-2">
          <div class="font-bold">${b.icon} ${b.title}</div>
          ${b.active ? '<span class="text-xs px-2 py-1 rounded bg-black text-white">مختار</span>' : ''}
        </div>
        <div class="text-sm text-gray-600">${b.hint}</div>
      </div>
    `;
  }).join("");

  const reasons = (rd.reasons||[]).map(r=>`<div class="flex items-start gap-2"><span class="text-accent mt-0.5">•</span><div>${r}</div></div>`).join("");

  box.innerHTML = `
    <div class="mb-4">
      <div class="text-xl font-bold mb-1">${rd.headline}</div>
      <div class="text-xs text-gray-500">${rd.note}</div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
      ${cards}
    </div>

    <div class="bg-white rounded-xl border p-4">
      <div class="font-bold mb-2">الأسباب (Why)</div>
      <div class="space-y-2 text-sm text-gray-700">${reasons}</div>
    </div>
  `;
};


advancedUI.renderTopLists = function(){
  const box = document.getElementById("toplists-box");
  if(!box) return;

  const data = (window.watchlistRadarEngine && typeof watchlistRadarEngine.build === "function")
    ? watchlistRadarEngine.build()
    : null;

  if(!data || data.status !== "ok"){
    box.innerHTML = `<div class="text-sm text-gray-600">غير متاح.</div>`;
    return;
  }

  const card = (it, mode)=>{
    const d = it.decision || {};
    const label = d.label || (mode==="opp" ? "فرصة" : "خطر");
    const badge = mode==="opp"
      ? `<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Opportunity</span>`
      : `<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-800">Risk</span>`;

    const reasons = (it.reasons||[]).map(r=>`<div class="text-xs text-gray-600">• ${r}</div>`).join("");
    const trust = `${Math.round(it.trust)}/100`;
    return `
      <div class="p-4 rounded-xl border bg-white">
        <div class="flex items-center justify-between mb-2">
          <div class="font-bold">${it.symbol}</div>
          ${badge}
        </div>
        <div class="text-sm text-gray-700 mb-1">${label} <span class="text-xs text-gray-500">(Trust ${trust})</span></div>
        <div class="space-y-1">${reasons || '<div class="text-xs text-gray-500">—</div>'}</div>
      </div>
    `;
  };

  const oppHtml = (data.opportunities||[]).map(it=>card(it,"opp")).join("") || `<div class="text-sm text-gray-600">لا توجد فرص بعد — حلّل أسهمك أولاً.</div>`;
  const riskHtml = (data.highRisk||[]).map(it=>card(it,"risk")).join("") || `<div class="text-sm text-gray-600">لا توجد مخاطر عالية بعد — حلّل أسهمك أولاً.</div>`;

  box.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <div class="font-bold mb-2">🟢 أفضل الفرص (Top Opportunities)</div>
        <div class="grid grid-cols-1 gap-2">${oppHtml}</div>
      </div>
      <div>
        <div class="font-bold mb-2">🔴 أعلى المخاطر للتخفيف (High Risk To Reduce)</div>
        <div class="grid grid-cols-1 gap-2">${riskHtml}</div>
      </div>
    </div>
    <div class="text-xs text-gray-500 mt-3">${data.note || ""}</div>
  `;
};


advancedUI.renderRiskControls = function(analysis){
  const box = document.getElementById("riskcontrols-box");
  if(!box) return;

  const data = (window.riskControlsEngine && typeof riskControlsEngine.build === "function")
    ? riskControlsEngine.build(analysis)
    : null;

  if(!data || data.status !== "ok"){
    box.innerHTML = `<div class="text-sm text-gray-600">قم بتحليل سهم أولاً لعرض قسم إدارة المخاطر.</div>`;
    return;
  }

  const badge = data.level==="low"
    ? `<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-800">low</span>`
    : data.level==="متوسط"
      ? `<span class="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">متوسط</span>`
      : `<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-800">high</span>`;

  const controls = (data.controls||[]).map(c=>{
    const sev = String(c.severity||"MED");
    const sevBadge = sev==="LOW"
      ? `<span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">low</span>`
      : sev==="MED"
        ? `<span class="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">متوسط</span>`
        : `<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-800">عالي</span>`;
    return `
      <div class="p-4 rounded-xl border bg-white mb-2">
        <div class="flex items-center justify-between mb-1">
          <div class="font-bold">${c.title}</div>
          ${sevBadge}
        </div>
        <div class="text-sm text-gray-700">${c.text}</div>
      </div>
    `;
  }).join("");

  const checklist = (data.checklist||[]).map(it=>{
    const ok = !!it.ok;
    return `
      <div class="p-3 rounded-xl border ${ok ? 'bg-green-50' : 'bg-red-50'}">
        <div class="flex items-center justify-between">
          <div class="font-bold text-sm">${ok ? '✅' : '⚠️'} ${it.title}</div>
          <div class="text-xs text-gray-600">${it.hint||""}</div>
        </div>
      </div>
    `;
  }).join("");

  box.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="text-xl font-bold">${data.headline}</div>
        <div class="text-xs text-gray-500 mt-1">${data.disclaim}</div>
      </div>
      ${badge}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
      <div class="bg-gray-50 border rounded-xl p-4">
        <div class="font-bold mb-2">قائمة تحقق الطمأنينة</div>
        <div class="grid grid-cols-1 gap-2">${checklist}</div>
      </div>
      <div class="bg-gray-50 border rounded-xl p-4">
        <div class="font-bold mb-2">ضوابط وإرشادات</div>
        <div>${controls || '<div class="text-sm text-gray-600">—</div>'}</div>
      </div>
    </div>

    <div class="text-xs text-gray-500">الهدف: وضع قواعد حماية واضحة تقلل المخاطر وتساعدك على قرار تفسيري.</div>
  `;
};


advancedUI.renderPortfolioGuard = function(){
  const box = document.getElementById("portfolio-guard-box");
  if(!box) return;

  const store = (window.portfolioGuardEngine ? portfolioGuardEngine.load() : {items:[]});
  const evald = (window.portfolioGuardEngine ? portfolioGuardEngine.evaluate(store) : {status:"err"});

  const levelBadge = (lvl)=>{
    const L = String(lvl||"MED").toUpperCase();
    if(L==="HIGH") return `<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-800">عالي</span>`;
    if(L==="MED") return `<span class="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">متوسط</span>`;
    return `<span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">low</span>`;
  };

  const warnings = (evald.warnings||[]).map(w=>`
    <div class="p-4 rounded-xl border bg-white mb-2">
      <div class="flex items-center justify-between mb-1">
        <div class="font-bold">⚠️ ${w.title}</div>
        ${levelBadge(w.level)}
      </div>
      <div class="text-sm text-gray-700">${w.text}</div>
    </div>
  `).join("") || `<div class="text-sm text-gray-600">لا توجد تحذيرات كبيرة حالياً.</div>`;

  const insights = (evald.insights||[]).map(i=>`
    <div class="p-4 rounded-xl border bg-gray-50 mb-2">
      <div class="font-bold mb-1">💡 ${i.title}</div>
      <div class="text-sm text-gray-700">${i.text}</div>
    </div>
  `).join("");

  const sectorRows = Object.entries(evald.sector||{})
    .map(([name,v])=>({name, ...v}))
    .sort((a,b)=>b.weight-a.weight)
    .map(s=>`
      <tr class="border-b">
        <td class="py-2 font-bold">${s.name}</td>
        <td class="py-2 text-sm text-gray-700">${s.count}</td>
        <td class="py-2 text-sm text-gray-700">${s.weight.toFixed(1)}%</td>
      </tr>
    `).join("") || `<tr><td class="py-2 text-sm text-gray-600" colspan="3">—</td></tr>`;

  const items = (store.items||[]).map((it,idx)=>`
    <tr class="border-b">
      <td class="py-2 font-bold">${it.symbol}</td>
      <td class="py-2 text-sm text-gray-700">${it.sector||"غير محدد"}</td>
      <td class="py-2 text-sm text-gray-700">${it.weight||""}</td>
      <td class="py-2 text-left">
        <button class="ms-btn-del text-xs px-3 py-1 rounded bg-red-100 text-red-800" data-idx="${idx}">حذف</button>
      </td>
    </tr>
  `).join("") || `<tr><td class="py-2 text-sm text-gray-600" colspan="4">لا توجد عناصر — أضف أسهمك هنا.</td></tr>`;

  box.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2">
        <div class="bg-white border rounded-2xl p-4 mb-4">
          <div class="flex items-center justify-between mb-3">
            <div class="text-xl font-bold">📌 أصول المحفظة</div>
            <div class="text-xs text-gray-500">حفظ محلي فقط (Static)</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input id="pg-symbol" class="border rounded-xl p-2" placeholder="symbol (AAPL / 2222.SR)" />
            <input id="pg-sector" class="border rounded-xl p-2" placeholder="القطاع (تقنية/بنوك/طاقة…)" />
            <input id="pg-weight" class="border rounded-xl p-2" placeholder="الوزن % (اختياري)" />
          </div>
          <div class="flex gap-2 mb-4">
            <button id="pg-add" class="px-4 py-2 rounded-xl bg-black text-white">إضافة</button>
            <button id="pg-clear" class="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 border">مسح الكل</button>
            <button id="pg-refresh" class="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 border">تحديث التحذيرات</button>
          </div>

          <div class="overflow-auto">
            <table class="w-full text-right">
              <thead>
                <tr class="border-b">
                  <th class="py-2">السهم</th>
                  <th class="py-2">القطاع</th>
                  <th class="py-2">الوزن%</th>
                  <th class="py-2 text-left">إجراء</th>
                </tr>
              </thead>
              <tbody>${items}</tbody>
            </table>
          </div>
        </div>

        <div class="bg-white border rounded-2xl p-4">
          <div class="text-xl font-bold mb-2">🧭 توزيع القطاعات</div>
          <div class="overflow-auto">
            <table class="w-full text-right">
              <thead>
                <tr class="border-b">
                  <th class="py-2">القطاع</th>
                  <th class="py-2">عدد الأسهم</th>
                  <th class="py-2">الوزن التقريبي</th>
                </tr>
              </thead>
              <tbody>${sectorRows}</tbody>
            </table>
          </div>
          <div class="text-xs text-gray-500 mt-2">إذا لم تضع أوزاناً، يتم توزيع الوزن بالتساوي تلقائياً.</div>
        </div>
      </div>

      <div class="lg:col-span-1">
        <div class="bg-white border rounded-2xl p-4 mb-4">
          <div class="text-xl font-bold mb-2">🚨 تحذيرات التركّز</div>
          ${warnings}
        </div>
        <div class="bg-white border rounded-2xl p-4">
          <div class="text-xl font-bold mb-2">💡 اقتراحات</div>
          ${insights || '<div class="text-sm text-gray-600">—</div>'}
        </div>
      </div>
    </div>
  `;

  // events
  const addBtn = document.getElementById("pg-add");
  const clearBtn = document.getElementById("pg-clear");
  const refreshBtn = document.getElementById("pg-refresh");

  const symbolEl = document.getElementById("pg-symbol");
  const sectorEl = document.getElementById("pg-sector");
  const weightEl = document.getElementById("pg-weight");

  const rerender = ()=>{ try{ advancedUI.renderPortfolioGuard(); }catch(e){} };

  if(addBtn){
    addBtn.onclick = ()=>{
      const sym = (symbolEl?.value||"").trim().toUpperCase();
      if(!sym) return alert("اكتب symbol أولاً.");
      const sec = (sectorEl?.value||"").trim() || "غير محدد";
      const w = Number((weightEl?.value||"").trim() || 0);
      const st = portfolioGuardEngine.load();
      st.items = Array.isArray(st.items) ? st.items : [];
      st.items.push({ symbol: sym, sector: sec, weight: (isFinite(w)?w:0) });
      portfolioGuardEngine.save(st);
      if(symbolEl) symbolEl.value = "";
      if(weightEl) weightEl.value = "";
      rerender();
    };
  }

  if(clearBtn){
    clearBtn.onclick = ()=>{
      if(!confirm("مسح جميع عناصر المحفظة؟")) return;
      portfolioGuardEngine.save({ items: [] });
      rerender();
    };
  }

  if(refreshBtn){
    refreshBtn.onclick = ()=> rerender();
  }

  // delete buttons
  box.querySelectorAll(".ms-btn-del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.getAttribute("data-idx")||"-1");
      const st = portfolioGuardEngine.load();
      if(idx>=0 && st.items && st.items[idx]){
        st.items.splice(idx,1);
        portfolioGuardEngine.save(st);
        rerender();
      }
    });
  });
};


advancedUI.renderLiquidityTrap = function(analysis){
  const box = document.getElementById("liquiditytrap-box");
  if(!box) return;

  if(!analysis){
    box.innerHTML = `<div class="text-sm text-gray-600">قم بتحليل سهم أولاً لعرض كاشف فخ السيولة.</div>`;
    return;
  }

  const res = (window.liquidityTrapEngine && typeof liquidityTrapEngine.analyze === "function")
    ? liquidityTrapEngine.analyze(analysis)
    : { status:"err" };

  if(!res || res.status !== "ok"){
    box.innerHTML = `<div class="text-sm text-gray-600">تعذر حساب فخ السيولة.</div>`;
    return;
  }

  const badge = res.level==="HIGH"
    ? `<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-800">عالي</span>`
    : res.level==="MED"
      ? `<span class="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">متوسط</span>`
      : `<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-800">low</span>`;

  const meter = `
    <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div class="h-3 bg-black" style="width:${res.score}%;"></div>
    </div>
    <div class="flex items-center justify-between text-xs text-gray-500 mt-1">
      <span>0</span><span>50</span><span>100</span>
    </div>
  `;

  const reasons = (res.reasons||[]).map(r=>`
    <div class="p-3 rounded-xl border bg-white mb-2">
      <div class="text-sm text-gray-700">• ${r}</div>
    </div>
  `).join("");

  const metrics = res.metrics || {};
  const mrows = Object.entries(metrics).map(([k,v])=>{
    const keyMap = {
      volRatio:"Volume Ratio",
      sma20DistPct:"بعد السعر عن SMA20 (%)",
      rsi:"RSI",
      candle:"شمعة",
      smf:"Smart Money",
      volatilityPct:"تذبذب (ATR/AvgPrice %)"
    };
    const name = keyMap[k] || k;
    const val = (typeof v === "number") ? (Math.round(v*10)/10) : String(v);
    return `<tr class="border-b"><td class="py-2 font-bold">${name}</td><td class="py-2 text-sm text-gray-700">${val}</td></tr>`;
  }).join("") || `<tr><td class="py-2 text-sm text-gray-600" colspan="2">—</td></tr>`;

  box.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div>
        <div class="text-xl font-bold">${res.label}</div>
        <div class="text-xs text-gray-500 mt-1">Static Detector — هدفه التحذير المبكر من "سيولة مضللة/تصريف".</div>
      </div>
      ${badge}
    </div>

    <div class="bg-gray-50 border rounded-xl p-4 mb-4">
      <div class="flex items-center justify-between mb-2">
        <div class="font-bold">درجة فخ السيولة</div>
        <div class="text-sm font-bold">${res.score}/100</div>
      </div>
      ${meter}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="bg-gray-50 border rounded-xl p-4">
        <div class="font-bold mb-2">أسباب مختصرة</div>
        ${reasons}
      </div>
      <div class="bg-gray-50 border rounded-xl p-4">
        <div class="font-bold mb-2">قراءات داعمة</div>
        <div class="overflow-auto">
          <table class="w-full text-right">
            <thead>
              <tr class="border-b"><th class="py-2">المؤشر</th><th class="py-2">القيمة</th></tr>
            </thead>
            <tbody>${mrows}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="text-xs text-gray-500 mt-4">
      ملاحظة: إذا كانت الدرجة عالية، فهذا يعني أن "السيولة قد تكون تصريفًا أو مطاردة". القرار النهائي يبقى لك.
    </div>
  `;
};


advancedUI.renderGlobalRiskScore = function(analysis){
  const box = document.getElementById("globalRiskScore-box");
  if(!box) return;

  const gs = analysis && analysis.globalRiskScore ? analysis.globalRiskScore : null;
  if(!gs || gs.status!=="ok"){
    box.innerHTML = `
      <div class="p-4 rounded-xl bg-gray-50 border text-sm text-gray-700">
        لم يتم توليد المؤشر بعد. قم بتحليل سهم من (تحليل فوري) ثم ارجع هنا.
      </div>
    `;
    return;
  }

  const score = Number(gs.score||0);
  const label = String(gs.label||"").trim() || (score>=70?"خطر high":score>=40?"خطر متوسط":"خطر low");
  const desc  = String(gs.description||"").trim();
  const why   = Array.isArray(gs.why) ? gs.why : [];

  const barClass = score>=70 ? "bg-red-500" : (score>=40 ? "bg-yellow-500" : "bg-green-500");
  const pillClass = score>=70 ? "bg-red-100 text-red-800" : (score>=40 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800");

  const whyHtml = (why.slice(0,6).map(x=>`<div class="text-xs text-gray-700">• ${String(x)}</div>`).join(""))
    || `<div class="text-xs text-gray-500">—</div>`;

  box.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div class="p-4 rounded-2xl border bg-white">
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm text-gray-600">الدرجة</div>
          <div class="text-xs px-2 py-1 rounded ${pillClass}">${label}</div>
        </div>
        <div class="text-4xl font-extrabold mb-3">${score}</div>
        <div class="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div class="h-full ${barClass}" style="width:${Math.max(0,Math.min(100,score))}%"></div>
        </div>
        <div class="text-xs text-gray-500 mt-2">0 = أقل خطر … 100 = أعلى خطر</div>
      </div>

      <div class="p-4 rounded-2xl border bg-white lg:col-span-2">
        <div class="text-sm font-bold mb-2">التفسير المختصر</div>
        <div class="text-sm text-gray-700 mb-3">${desc || "—"}</div>
        <div class="text-sm font-bold mb-2">أهم الأسباب</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${whyHtml}</div>
      </div>
    </div>
  `;
};


advancedUI.renderFetchLiveStatus = function(message, type){
  const el = document.getElementById("fetchlive-status");
  if(!el) return;
  const cls = type === "error"
    ? "text-red-700 bg-red-50 border-red-200"
    : type === "success"
      ? "text-green-700 bg-green-50 border-green-200"
      : "text-gray-700 bg-gray-50 border-gray-200";
  el.className = `mt-3 text-sm border rounded-xl p-3 ${cls}`;
  el.textContent = message;
};
