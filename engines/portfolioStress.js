/* engines/portfolioStress.js
 * السوق Sentinel AR — اختبار ضغط المحفظة Test (Static)
 * يعتمد على screenerEngine لتقييم كل سهم ثم يبني ملخص محفظة + ترتيب
 * Input rows: symbol,date,فتح,high,low,close,volume (weight optional)
 */
(function(){
  function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
  function round(v,d){ var p=Math.pow(10,d||2); return Math.round(v*p)/p; }

  function computePortfolio(allRows, opts){
    opts = opts || {};
    if(!window.screenerEngine || typeof window.screenerEngine.screenStocks !== 'function'){
      throw new Error("screenerEngine غير متاح");
    }
    if(!Array.isArray(allRows) || allRows.length===0) throw new Error("لا توجد بيانات");

    // weights: if provided per row as weight, we take latest non-empty weight per symbol
    var bySymbol = {};
    for(var i=0;i<allRows.length;i++){
      var r = allRows[i] || {};
      var sym = String(r.symbol || r.symbol || r.SYMBOL || "").trim();
      if(!sym) continue;
      if(!bySymbol[sym]) bySymbol[sym] = { rows: [], weight: null };
      bySymbol[sym].rows.push(r);
      var w = r.weight ?? r.Weight ?? null;
      if(w !== null && w !== undefined && w !== ""){
        var wn = Number(w);
        if(isFinite(wn) && wn > 0) bySymbol[sym].weight = wn;
      }
    }

    // Build a flat array for screenerEngine (it groups by symbol internally)
    var flat = [];
    Object.keys(bySymbol).forEach(function(sym){
      flat = flat.concat(bySymbol[sym].rows.map(function(r){
        // ensure symbol field exists
        return Object.assign({ symbol: sym }, r);
      }));
    });

    var cat = window.screenerEngine.screenStocks(flat, opts);

    // Map weights
    var items = (cat.all || []).map(function(x){
      var w = bySymbol[x.symbol] ? bySymbol[x.symbol].weight : null;
      return Object.assign({ weight: w }, x);
    });

    // Normalize weights if any exist
    var anyW = items.some(function(i){ return i.weight != null; });
    if(anyW){
      var sumW = items.reduce(function(s,i){ return s + (i.weight!=null ? num(i.weight):0); }, 0);
      if(sumW <= 0) { anyW = false; }
      else {
        items = items.map(function(i){
          var w = i.weight!=null ? num(i.weight) : 0;
          return Object.assign({}, i, { weightNorm: w/sumW });
        });
      }
    } else {
      items = items.map(function(i){ return Object.assign({}, i, { weightNorm: 1/items.length }); });
    }

    // Summary
    var summary = {
      count: items.length,
      weightedRisk: round(items.reduce(function(s,i){ return s + (num(i.riskScore) * num(i.weightNorm)); }, 0), 1),
      counts: {
        A: (cat.A||[]).length,
        B: (cat.B||[]).length,
        C: (cat.C||[]).length
      }
    };

    // Rankings
    var crashRank = items.slice().sort(function(a,b){ return (b.crashSpeedScore||0) - (a.crashSpeedScore||0); }).slice(0, 15);
    var reboundRank = items.slice().filter(function(i){ return i.recoverDays !== null; })
      .sort(function(a,b){
        // higher reboundScore better; if tie, fewer recoverDays better
        var d = (b.reboundScore||0) - (a.reboundScore||0);
        if(d!==0) return d;
        return (a.recoverDays||9999) - (b.recoverDays||9999);
      }).slice(0, 15);

    // Order by risk score desc
    items.sort(function(a,b){ return (b.riskScore||0) - (a.riskScore||0); });

    return { summary: summary, items: items, crashRank: crashRank, reboundRank: reboundRank, categories: { A: cat.A||[], B: cat.B||[], C: cat.C||[] } };
  }

  window.portfolioStressEngine = { computePortfolio: computePortfolio };
})();window.marketSentinel.portfolioStressEngine = window.portfolioStressEngine;
window.safeEngine.wrap("portfolioStressEngine");
