/* js/portfolioUI.js
 * UI for اختبار ضغط المحفظة Test tab
 * يدعم ملفاً واحداً أو عدة ملفات CSV/JSON/XLS/XLSX
 */
(function(){
  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g, function(c){
      return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" })[c];
    });
  }
  function fmt(v, d){ if(v==null) return "-"; var x=Number(v); if(!isFinite(x)) return "-"; return x.toFixed(d==null?2:d); }
  function normalizeSymbolFromName(name){
    var base = String(name || '').replace(/\.[^.]+$/, '').trim().toUpperCase();
    base = base.replace(/\s+/g, '');
    if(/^\d{3,5}$/.test(base)) return base + '.SR';
    return base || 'UNKNOWN';
  }
  function ensureSymbol(rows, fallbackSymbol){
    return (rows || []).map(function(row){
      if(row && (row.symbol || row.Symbol || row.SYMBOL)) return row;
      return Object.assign({ symbol: fallbackSymbol }, row || {});
    });
  }
  async function loadFiles(files){
    var all = [];
    for(var i=0;i<files.length;i++){
      var file = files[i];
      var rows = await dataEngine.parseFileToRows(file);
      all = all.concat(ensureSymbol(rows, normalizeSymbolFromName(file.name)));
    }
    return all;
  }

  function renderTable(containerId, rows){
    var el = document.getElementById(containerId);
    if(!el) return;
    if(!rows || !rows.length){
      el.innerHTML = '<div class="text-sm text-gray-500">لا توجد نتائج</div>';
      return;
    }
    el.innerHTML = `
      <div class="overflow-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-gray-600">
              <th class="text-right p-2">السهم</th>
              <th class="text-right p-2">Risk</th>
              <th class="text-right p-2">هبوط%</th>
              <th class="text-right p-2">أيام الهبوط</th>
              <th class="text-right p-2">الارتداد</th>
              <th class="text-right p-2">الفئة</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(function(r){
              var cat = r.category || (r.categoryTitle ? (r.categoryTitle.includes("مستقرة")?"B": r.categoryTitle.includes("ولا ترتد")?"C":"A") : "-");
              return `
                <tr class="border-t">
                  <td class="p-2 font-bold">${esc(r.symbol)}</td>
                  <td class="p-2" dir="ltr">${esc(String(r.riskScore ?? "-"))}</td>
                  <td class="p-2" dir="ltr">${esc(String(r.mdd ?? "-"))}%</td>
                  <td class="p-2" dir="ltr">${esc(String(r.crashDays ?? "-"))}</td>
                  <td class="p-2">${esc(r.reboundSpeed ?? "-")}</td>
                  <td class="p-2">${esc(cat)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderRank(containerId, rows, mode){
    var el = document.getElementById(containerId);
    if(!el) return;
    if(!rows || !rows.length){
      el.innerHTML = '<div class="text-sm text-gray-500">لا توجد نتائج</div>';
      return;
    }
    var title = mode === "crash" ? "CrashSpeed" : "ReboundScore";
    el.innerHTML = `
      <div class="overflow-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-gray-600">
              <th class="text-right p-2">#</th>
              <th class="text-right p-2">السهم</th>
              <th class="text-right p-2">${title}</th>
              <th class="text-right p-2">مخاطرة</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(function(r, idx){
              var v = mode === "crash" ? fmt(r.crashSpeedScore, 6) : fmt(r.reboundScore, 6);
              return `
                <tr class="border-t">
                  <td class="p-2" dir="ltr">${idx+1}</td>
                  <td class="p-2 font-bold">${esc(r.symbol)}</td>
                  <td class="p-2" dir="ltr">${v}</td>
                  <td class="p-2" dir="ltr">${esc(String(r.riskScore ?? "-"))}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function downloadJSON(obj, filename){
    var blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function init(){
    var fileInput = document.getElementById("portfolioFile");
    var btnRun = document.getElementById("btnRunPortfolio");
    var btnExport = document.getElementById("btnExportPortfolio");
    var status = document.getElementById("portfolioStatus");

    if(!fileInput || !btnRun) return;

    var lastOut = null;

    btnRun.addEventListener("click", function(){
      try{
        var files = fileInput.files ? Array.from(fileInput.files) : [];
        if(!files.length){ ui.showToast("اختر ملفاً أو عدة ملفات أولاً", "error"); return; }
        status.textContent = "جارِ قراءة الملفات وتشغيل اختبار الضغط...";
        loadFiles(files).then(function(rows){
          var out = window.portfolioStressEngine.computePortfolio(rows, { recoveryFraction: 0.60, minRowsPerSymbol: 30 });
          lastOut = out;

          document.getElementById("pf-count").textContent = out.summary.count;
          document.getElementById("pf-risk").textContent = out.summary.weightedRisk;
          document.getElementById("pf-a").textContent = out.summary.counts.A;
          document.getElementById("pf-b").textContent = out.summary.counts.B;
          document.getElementById("pf-c").textContent = out.summary.counts.C;

          renderTable("portfolioTable", out.items);
          renderRank("portfolioCrashTable", out.crashRank, "crash");
          renderRank("portfolioReboundTable", out.reboundRank, "rebound");

          status.textContent = "تم ✅ (ملفات: " + files.length + ")";
          ui.showToast("تم اختبار الضغط بنجاح", "success");
        }).catch(function(err){
          console.error(err);
          status.textContent = "فشل: تحقق من الأعمدة أو ارفع ملفًا لكل سهم من Yahoo.";
          ui.showToast(err.message || "فشل اختبار الضغط", "error");
        });
      }catch(e){
        console.error(e);
        status.textContent = "فشل.";
        ui.showToast("فشل اختبار الضغط", "error");
      }
    });

    btnExport && btnExport.addEventListener("click", function(){
      if(!lastOut){ ui.showToast("شغّل اختبار الضغط أولاً", "error"); return; }
      downloadJSON(lastOut, "portfolio_stress_test.json");
    });
  }

  window.portfolioUI = { init: init };
})();
