/* js/screenerUI.js
 * السوق Sentinel AR — الفرز الذكي UI
 * يدعم ملفاً واحداً أو عدة ملفات CSV/JSON/XLS/XLSX
 */
(function(){
  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g, function(c){
      return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" })[c];
    });
  }

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
      el.innerHTML = '<div class="text-sm opacity-70">لا توجد نتائج</div>';
      return;
    }
    var html = ''
      + '<div class="overflow-auto">'
      + '<table class="min-w-full text-sm">'
      + '<thead><tr class="opacity-80">'
      + '<th class="text-right p-2">السهم</th>'
      + '<th class="text-right p-2">المخاطرة</th>'
      + '<th class="text-right p-2">هبوط%</th>'
      + '<th class="text-right p-2">أيام الهبوط</th>'
      + '<th class="text-right p-2">الارتداد</th>'
      + '</tr></thead><tbody>';

    for(var i=0;i<rows.length;i++){
      var r = rows[i];
      html += '<tr class="border-t">'
        + '<td class="p-2 font-bold">'+esc(r.symbol)+'</td>'
        + '<td class="p-2">'+esc(r.riskScore)+'</td>'
        + '<td class="p-2">'+esc(r.mddPct)+'%</td>'
        + '<td class="p-2">'+esc(r.crashDays)+'</td>'
        + '<td class="p-2">'+esc(r.reboundSpeed)+'</td>'
        + '</tr>';
    }
    html += '</tbody></table></div>';
    el.innerHTML = html;
  }

  async function run(){
    var fileInput = document.getElementById("screenerFile");
    var status = document.getElementById("screenerStatus");
    var files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
    if(!files.length){
      ui && ui.showToast && ui.showToast("اختر ملفًا أو عدة ملفات أولاً", "error");
      return;
    }
    if(!dataEngine || !dataEngine.parseFileToRows){
      ui && ui.showToast && ui.showToast("المكوّن dataEngine.parseFileToRows غير متاح", "error");
      return;
    }
    try{
      status && (status.textContent = "جارِ قراءة الملفات وتحليل الأسهم...");
      var rows = await loadFiles(files);
      var out = screenerEngine.screenStocks(rows, { recoveryFraction: 0.60, minRowsPerSymbol: 30 });

      window.lastScreenerResult = out;

      renderTable("screenerTableA", out.A);
      renderTable("screenerTableB", out.B);
      renderTable("screenerTableC", out.C);

      status && (status.textContent = "تم الفرز ✅ (ملفات: "+files.length+" | A: "+out.A.length+" | B: "+out.B.length+" | C: "+out.C.length+")");
      ui && ui.showToast && ui.showToast("تم الفرز بنجاح", "success");
    }catch(e){
      console.error(e);
      status && (status.textContent = "فشل الفرز. تأكد من الأعمدة (symbol,date,فتح,high,low,close,volume) أو ارفع ملفًا لكل سهم من Yahoo.");
      ui && ui.showToast && ui.showToast("فشل الفرز", "error");
    }
  }

  function exportJSON(){
    var out = window.lastScreenerResult;
    if(!out){
      ui && ui.showToast && ui.showToast("شغّل الفرز أولاً", "error");
      return;
    }
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "screener_result.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function init(){
    var btnRun = document.getElementById("btnRunScreener");
    var btnExport = document.getElementById("btnExportScreener");
    if(btnRun) btnRun.addEventListener("click", run);
    if(btnExport) btnExport.addEventListener("click", exportJSON);
  }

  window.screenerUI = { init: init };
})();
