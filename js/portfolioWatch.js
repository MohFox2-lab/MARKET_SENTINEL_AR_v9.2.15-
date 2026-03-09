
/**
 * Market Sentinel AR — Portfolio Watch (Static)
 * حفظ محفظة المستخدم في localStorage + تحليل دفعي متسلسل بدون تجميد الهيكل
 */
(function(){
  const KEY = "MS_PORTFOLIO_V1";
  const KEY_LAST_PREFIX = "MS_LAST_ANALYSIS_"; // per symbol summary
  const nowISO = () => new Date().toISOString();

  function safeParse(str, fallback){
    try { return JSON.parse(str); } catch(e){ return fallback; }
  }

  function loadPortfolio(){
    return safeParse(localStorage.getItem(KEY) || "[]", []);
  }

  function savePortfolio(list){
    localStorage.setItem(KEY, JSON.stringify(list || []));
  }

  function normalizeSymbol(raw){
    if (window.normalizeSymbol) return window.normalizeSymbol(raw);
    // fallback basic
    const s = (raw||"").trim().toUpperCase();
    if(!s) return "";
    if(/^\d{4}$/.test(s)) return s + ".SR";
    return s;
  }

  function getLastSummary(symbol){
    return safeParse(localStorage.getItem(KEY_LAST_PREFIX + symbol) || "null", null);
  }

  function setLastSummary(symbol, summary){
    localStorage.setItem(KEY_LAST_PREFIX + symbol, JSON.stringify(summary));
  }

  function summarizeAnalysis(analysis){
    if(!analysis) return null;
    const grs = analysis.globalRisk || analysis.globalRiskScore || analysis.globalRiskResult || {};
    const score = (typeof grs.score === "number") ? grs.score : (analysis.riskScore ?? null);
    const label = grs.label || grs.state || "";
    const reasons = Array.isArray(grs.reasons) ? grs.reasons.slice(0,4) : (Array.isArray(grs.topReasons)? grs.topReasons.slice(0,4): []);
    return {
      symbol: analysis.symbol || "",
      ts: nowISO(),
      globalRiskScore: score,
      globalRiskLabel: label,
      reasons,
      traffic: analysis.trafficLight || analysis.traffic || "",
      smf: (analysis.smartMoney && analysis.smartMoney.signal) ? analysis.smartMoney.signal : (analysis.smf ? analysis.smf : ""),
      alertsHigh: Array.isArray(analysis.alerts) ? analysis.alerts.filter(a => (a.severity||"").toUpperCase()==="HIGH").length : (analysis.alertsHigh||0)
    };
  }

  async function analyzeSymbol(symbol, range="6mo"){
    // Requires proxy + fetchEngine + analysisEngine
    const proxy = (window.fetchEngine && window.fetchEngine.getProxyUrl) ? window.fetchEngine.getProxyUrl() : "";
    if(!proxy){
      if(window.ui && window.ui.showToast) window.ui.showToast("لتحليل المحفظة: اضبط بروكسي في (البيانات والإعدادات) أو ارفع CSV.", "error");
      if(window.ui && window.ui.switchTab) window.ui.switchTab("view-data");
      return { ok:false, error:"NO_PROXY" };
    }
    if(!window.fetchEngine || !window.analysisEngine) return { ok:false, error:"MISSING_ENGINE" };

    try{
      if(window.ui && window.ui.showLoading) window.ui.showLoading(true);
      const chart = await window.fetchEngine.fetchYahooChart({ symbol, range, interval: "1d" });
      const rows = window.fetchEngine.yahooToRows(chart);
      // set market data for analysis
      if(window.setMarketData){
        window.setMarketData({ symbol, source: `ياهو via بروكسي (${range}/1d)`, rows });
      } else {
        window.marketSentinel.marketData = { symbol, source: `ياهو via بروكسي (${range}/1d)`, rows };
      }
      const analysis = window.analysisEngine.run(window.marketSentinel.marketData);
      const summary = summarizeAnalysis(analysis);
      if(summary) setLastSummary(symbol, summary);
      return { ok:true, analysis, summary };
    } catch(e){
      console.error("Portfolio analyze failed", symbol, e);
      return { ok:false, error:String(e?.message||e) };
    } finally {
      if(window.ui && window.ui.showLoading) window.ui.showLoading(false);
    }
  }

  function upsertItem(list, item){
    const idx = list.findIndex(x => x.symbol === item.symbol);
    if(idx >= 0) list[idx] = { ...list[idx], ...item, updated_at: nowISO() };
    else list.push({ ...item, added_at: nowISO(), updated_at: nowISO() });
    return list;
  }

  function removeItem(list, symbol){
    return (list||[]).filter(x => x.symbol !== symbol);
  }

  function exportPortfolio(){
    const list = loadPortfolio();
    const payload = {
      schema: "MS_PORTFOLIO_EXPORT_V1",
      exported_at: nowISO(),
      items: list
    };
    return JSON.stringify(payload, null, 2);
  }

  function importPortfolio(jsonText){
    const obj = safeParse(jsonText, null);
    if(!obj || obj.schema !== "MS_PORTFOLIO_EXPORT_V1" || !Array.isArray(obj.items)){
      return { ok:false, error:"INVALID_FORMAT" };
    }
    // merge by symbol
    let list = loadPortfolio();
    for(const it of obj.items){
      if(!it || !it.symbol) continue;
      const sym = normalizeSymbol(it.symbol);
      list = upsertItem(list, { ...it, symbol: sym });
    }
    savePortfolio(list);
    return { ok:true, count: obj.items.length };
  }

  function renderPortfolio(){
    const table = document.getElementById("portfolio-table-body");
    const empty = document.getElementById("portfolio-empty");
    if(!table) return;

    const list = loadPortfolio().sort((a,b)=> (a.symbol||"").localeCompare(b.symbol||""));
    table.innerHTML = "";

    if(!list.length){
      if(empty) empty.classList.remove("hidden");
      return;
    }
    if(empty) empty.classList.add("hidden");

    for(const it of list){
      const last = getLastSummary(it.symbol);
      const score = (last && typeof last.globalRiskScore === "number") ? last.globalRiskScore : null;
      const label = last?.globalRiskLabel || "";
      const reasons = (last?.reasons || []).join(" • ");
      const traffic = last?.traffic || "";
      const smf = last?.smf || "";
      const ts = last?.ts ? new Date(last.ts).toLocaleString("ar-SA") : "—";

      const tr = document.createElement("tr");
      tr.className = "border-b last:border-b-0";
      tr.innerHTML = `
        <td class="py-2 px-2 font-semibold">${it.symbol}</td>
        <td class="py-2 px-2">${it.owned ? "أملكه" : "لا أملكه"}</td>
        <td class="py-2 px-2">${it.exposure || "—"}</td>
        <td class="py-2 px-2">${score===null ? "—" : score}</td>
        <td class="py-2 px-2">${label || traffic || "—"}</td>
        <td class="py-2 px-2">${smf || "—"}</td>
        <td class="py-2 px-2 text-xs text-slate-600">${reasons || "—"}</td>
        <td class="py-2 px-2 text-xs text-slate-600">${ts}</td>
        <td class="py-2 px-2">
          <button class="btn btn-sm" data-act="analyze" data-sym="${it.symbol}">تحليل</button>
          <button class="btn btn-sm" data-act="open" data-sym="${it.symbol}">تفاصيل</button>
          <button class="btn btn-sm btn-danger" data-act="remove" data-sym="${it.symbol}">حذف</button>
        </td>
      `;
      table.appendChild(tr);
    }

    table.querySelectorAll("button[data-act]").forEach(btn=>{
      btn.addEventListener("click", async (e)=>{
        const act = btn.dataset.act;
        const sym = btn.dataset.sym;
        if(act==="remove"){
          savePortfolio(removeItem(loadPortfolio(), sym));
          renderPortfolio();
          if(window.ui && window.ui.showToast) window.ui.showToast("تم حذف السهم من المحفظة", "success");
          return;
        }
        if(act==="open"){
          // فتح التفاصيل عبر تعبئة صندوق الداشبورد ثم تحليل
          const input = document.getElementById("dashboard-symbol-input");
          if(input) input.value = sym;
          if(window.ui && window.ui.switchTab) window.ui.switchTab("view-dashboard");
          // trigger analyze button click
          const btnAnalyze = document.getElementById("dashboard-btn-analyze");
          if(btnAnalyze) btnAnalyze.click();
          return;
        }
        if(act==="analyze"){
          const rangeSel = document.getElementById("portfolio-range");
          const range = (rangeSel?.value || "6mo").trim();
          const res = await analyzeSymbol(sym, range);
          if(res.ok){
            renderPortfolio();
            if(window.ui && window.ui.showToast) window.ui.showToast(`تم تحليل ${sym}`, "success");
          } else {
            if(window.ui && window.ui.showToast) window.ui.showToast(`فشل تحليل ${sym}`, "error");
          }
        }
      });
    });
  }

  async function analyzeAll(){
    const list = loadPortfolio();
    if(!list.length){
      if(window.ui && window.ui.showToast) window.ui.showToast("المحفظة فارغة", "error");
      return;
    }
    const rangeSel = document.getElementById("portfolio-range");
    const range = (rangeSel?.value || "6mo").trim();

    // Sequential to avoid global collisions
    for(let i=0;i<list.length;i++){
      const sym = list[i].symbol;
      if(window.ui && window.ui.showToast) window.ui.showToast(`تحليل ${sym} (${i+1}/${list.length})...`, "info");
      const res = await analyzeSymbol(sym, range);
      if(!res.ok){
        console.warn("Portfolio analyze failed", sym, res.error);
      }
      renderPortfolio();
      await new Promise(r => setTimeout(r, 250));
    }
    if(window.ui && window.ui.showToast) window.ui.showToast("اكتمل تحليل المحفظة", "success");
  }

  function bindUI(){
    const addBtn = document.getElementById("portfolio-add-btn");
    const addInput = document.getElementById("portfolio-symbol-input");
    const ownedChk = document.getElementById("portfolio-owned");
    const exposureSel = document.getElementById("portfolio-exposure");
    const noteInput = document.getElementById("portfolio-note");

    addBtn && addBtn.addEventListener("click", ()=>{
      const sym = normalizeSymbol(addInput?.value || "");
      if(!sym){
        window.ui && window.ui.showToast && window.ui.showToast("اكتب symbol", "error");
        return;
      }
      let list = loadPortfolio();
      list = upsertItem(list, {
        symbol: sym,
        owned: !!(ownedChk && ownedChk.checked),
        exposure: (exposureSel?.value || "").trim() || "",
        note: (noteInput?.value || "").trim()
      });
      savePortfolio(list);
      if(addInput) addInput.value="";
      if(noteInput) noteInput.value="";
      renderPortfolio();
      window.ui && window.ui.showToast && window.ui.showToast("تمت إضافة السهم للمحفظة", "success");
    });

    const analyzeAllBtn = document.getElementById("portfolio-analyze-all");
    analyzeAllBtn && analyzeAllBtn.addEventListener("click", analyzeAll);

    const exportBtn = document.getElementById("portfolio-export");
    const importBtn = document.getElementById("portfolio-import");
    const ioBox = document.getElementById("portfolio-io");

    exportBtn && exportBtn.addEventListener("click", ()=>{
      if(ioBox) ioBox.value = exportPortfolio();
      window.ui && window.ui.showToast && window.ui.showToast("تم تجهيز تصدير المحفظة", "success");
    });

    importBtn && importBtn.addEventListener("click", ()=>{
      const txt = (ioBox?.value || "").trim();
      if(!txt){
        window.ui && window.ui.showToast && window.ui.showToast("الصق ملف التصدير أولاً", "error");
        return;
      }
      const res = importPortfolio(txt);
      if(res.ok){
        renderPortfolio();
        window.ui && window.ui.showToast && window.ui.showToast("تم استيراد المحفظة", "success");
      } else {
        window.ui && window.ui.showToast && window.ui.showToast("صيغة الاستيراد غير صحيحة", "error");
      }
    });

    const clearBtn = document.getElementById("portfolio-clear");
    clearBtn && clearBtn.addEventListener("click", ()=>{
      if(confirm("مسح المحفظة بالكامل؟")){
        savePortfolio([]);
        renderPortfolio();
        window.ui && window.ui.showToast && window.ui.showToast("تم مسح المحفظة", "success");
      }
    });
  }

  window.portfolioWatch = {
    loadPortfolio,
    savePortfolio,
    renderPortfolio,
    analyzeSymbol,
    analyzeAll,
    exportPortfolio,
    importPortfolio
  };

  document.addEventListener("DOMContentLoaded", ()=>{
    bindUI();
    renderPortfolio();
  });
})();
