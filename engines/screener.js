/* engines/screener.js
 * السوق Sentinel AR — Crisis Behavior الفرز الذكي (Static)
 * فرز مجموعة أسهم حسب سرعة الهبوط وسرعة الارتداد (بروكسي للأزمات)
 * Input rows should include columns:
 * symbol,date,فتح,high,low,close,volume (beta optional)
 * Output: { A:[], B:[], C:[], all:[] }
 */
(function(){
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
  function round(v,d){ d=d||2; var p=Math.pow(10,d); return Math.round(v*p)/p; }
  function median(arr){
    if(!arr.length) return 0;
    var s = arr.slice().sort(function(a,b){return a-b;});
    var m = Math.floor(s.length/2);
    return (s.length%2) ? s[m] : (s[m-1]+s[m])/2;
  }
  function avg(arr){
    if(!arr.length) return 0;
    var sum=0; for(var i=0;i<arr.length;i++) sum+=arr[i];
    return sum/arr.length;
  }
  function groupBy(arr, keyFn){
    var out = {};
    for(var i=0;i<arr.length;i++){
      var k = keyFn(arr[i]);
      if(!out[k]) out[k]=[];
      out[k].push(arr[i]);
    }
    return out;
  }
  function normalizeRows(rows){
    rows = Array.isArray(rows) ? rows : [];
    var out = [];
    for(var i=0;i<rows.length;i++){
      var r = rows[i] || {};
      var sym = (r.symbol ?? r.symbol ?? r.SYMBOL ?? "").toString().trim();
      var date = (r.date ?? r.Date ?? r.DATE ?? "").toString().slice(0,10);
      var فتح = num(r.فتح ?? r.فتح);
      var high = num(r.high ?? r.high);
      var low  = num(r.low  ?? r.low);
      var close= num(r.close ?? r.close ?? r.price ?? r.السعر);
      var volume = num(r.volume ?? r.volume ?? r.vol ?? r.Vol);
      var beta = r.beta ?? r.Beta ?? null;
      if(!sym || !date || !(close>0)) continue;
      out.push({ symbol:sym, date:date, فتح:فتح, high:high, low:low, close:close, volume:volume, beta:beta });
    }
    return out;
  }

  function rollingAvg(arr,w){
    var out = new Array(arr.length);
    var sum=0;
    for(var i=0;i<arr.length;i++){
      sum += arr[i];
      if(i>=w) sum -= arr[i-w];
      out[i] = (i>=w-1) ? (sum/w) : null;
    }
    return out;
  }

  function peakToTrough(rows){
    var peak=-Infinity, peakIdx=0;
    var troughClose=Infinity, troughIdx=0;
    var maxDD = 0; // negative
    for(var i=0;i<rows.length;i++){
      var c = rows[i].close;
      if(c>peak){ peak=c; peakIdx=i; troughClose=c; troughIdx=i; }
      var dd = (c-peak)/peak;
      if(dd<maxDD){ maxDD=dd; troughClose=c; troughIdx=i; }
    }
    return { peakIdx:peakIdx, troughIdx:troughIdx, peakClose:rows[peakIdx].close, troughClose:rows[troughIdx].close, mdd:maxDD };
  }

  function recoveryDays(rows, troughIdx, target){
    for(var i=troughIdx;i<rows.length;i++){
      if(rows[i].close >= target) return { days: i-troughIdx, idx:i };
    }
    return { days:null, idx:null };
  }

  function latestNonNull(arr){
    for(var i=arr.length-1;i>=0;i--){
      var v = arr[i];
      var n = Number(v);
      if(v!==null && v!==undefined && v!=="" && Number.isFinite(n)) return n;
    }
    return null;
  }

  function atrPercent(rows, window){
    window = window || 14;
    if(rows.length < window + 2) return null;
    var trs = [];
    for(var i=1;i<rows.length;i++){
      var h=rows[i].high, l=rows[i].low, pc=rows[i-1].close;
      var tr = Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc));
      trs.push(tr);
    }
    var atr = avg(trs.slice(-window));
    var lastClose = rows[rows.length-1].close || 0;
    return lastClose ? (atr/lastClose) : null;
  }

  function volumeSpikeAfter(rows, troughIdx, avgWindow, lookahead, factor){
    avgWindow = avgWindow || 20;
    lookahead = lookahead || 5;
    factor = factor || 1.5;
    var vols = rows.map(function(r){return r.volume;});
    var av = rollingAvg(vols, avgWindow);
    for(var k=0;k<lookahead;k++){
      var i = troughIdx + k;
      if(i>=rows.length) break;
      var base = av[i] || av[av.length-1] || 0;
      if(base>0 && rows[i].volume >= factor*base) return true;
    }
    return false;
  }

  function dataQuality(rows){
    if(!Array.isArray(rows) || rows.length < 10){
      return { ok:false, why:"عدد الصفوف قليل جدًا للتحليل الموثوق.", penalty:12 };
    }
    var last = rows[rows.length-1] || {};
    var required = ["date","فتح","high","low","close","volume"];
    for(var i=0;i<required.length;i++){
      if(last[required[i]]===undefined || last[required[i]]===null || last[required[i]]===""){
        return { ok:false, why:"أعمدة أساسية مفقودة (تأكد من mapping).", penalty:14 };
      }
    }
    if(!(last.close>0) || !(last.فتح>0) || !(last.high>0) || !(last.low>0) || last.high < last.low){
      return { ok:false, why:"قيم غير منطقية في البيانات (قد يكون mapping خاطئ).", penalty:14 };
    }
    return { ok:true };
  }

  function categorize(results){
    if(!results.length) return { A:[], B:[], C:[], all:[] };

    var crash = results.map(function(r){return r.crashSpeedScore;});
    var mdds = results.map(function(r){return Math.abs(r.mddPct);});
    var medCrash = median(crash);
    var medMdd = median(mdds);

    var A=[],B=[],C=[];
    for(var i=0;i<results.length;i++){
      var r = results[i];
      var fastCrash = r.crashSpeedScore >= medCrash*1.2;
      var bigDrop = Math.abs(r.mddPct) >= medMdd*1.1;
      var fastRebound = (r.recoverDays !== null) && (r.recoverDays <= 10);
      var noRebound = (r.recoverDays === null) || (r.recoverDays > 20);

      if((fastCrash && fastRebound) || (bigDrop && fastRebound && r.volSpikeAfterTrough)){
        A.push(Object.assign({}, r, {category:"A", categoryTitle:"سريعة الهبوط وسريعة الارتداد"}));
      } else if(!bigDrop && !fastCrash && r.riskScore <= 45){
        B.push(Object.assign({}, r, {category:"B", categoryTitle:"بطيئة الهبوط ومستقرة"}));
      } else if(bigDrop && noRebound){
        C.push(Object.assign({}, r, {category:"C", categoryTitle:"تهبط ولا ترتد سريعًا"}));
      } else {
        if(r.riskScore >= 65) C.push(Object.assign({}, r, {category:"C", categoryTitle:"تهبط ولا ترتد سريعًا"}));
        else if(r.riskScore <= 45) B.push(Object.assign({}, r, {category:"B", categoryTitle:"بطيئة الهبوط ومستقرة"}));
        else A.push(Object.assign({}, r, {category:"A", categoryTitle:"سريعة الهبوط وسريعة الارتداد"}));
      }
    }
    return { A:A, B:B, C:C, all:results };
  }

  function screenStocks(allRows, opts){
    opts = opts || {};
    var recoveryFraction = (opts.recoveryFraction ?? 0.60);
    var minRowsPerSymbol = (opts.minRowsPerSymbol ?? 30);
    var avgVolWindow = (opts.avgVolWindow ?? 20);

    var norm = normalizeRows(allRows);
    var grouped = groupBy(norm, function(r){return r.symbol;});
    var results = [];

    for(var sym in grouped){
      var rows = grouped[sym] || [];
      if(rows.length < minRowsPerSymbol) continue;
      rows.sort(function(a,b){ return a.date.localeCompare(b.date); });

      var dq = dataQuality(rows);
      var p2t = peakToTrough(rows);
      var mdd = p2t.mdd; // negative
      var crashDays = Math.max(1, p2t.troughIdx - p2t.peakIdx);
      var crashSpeedScore = Math.abs(mdd) / crashDays;

      var peakClose = p2t.peakClose, troughClose = p2t.troughClose;
      var target = troughClose + recoveryFraction*(peakClose - troughClose);
      var rec = recoveryDays(rows, p2t.troughIdx, target);
      var recoverDays = rec.days;

      var volSpike = volumeSpikeAfter(rows, p2t.troughIdx, avgVolWindow, 5, 1.5);
      var atrPct = atrPercent(rows, avgVolWindow);

      var beta = latestNonNull(rows.map(function(r){return r.beta;}));

      var risk = 0;
      risk += clamp(Math.abs(mdd)*400, 0, 35);
      risk += clamp(crashSpeedScore*1200, 0, 25);
      risk += (recoverDays===null) ? 25 : clamp(recoverDays, 0, 25);
      risk += volSpike ? -6 : 4;
      risk += atrPct ? clamp(atrPct*300, 0, 15) : 0;
      if(beta && beta>1) risk += clamp((beta-1)*8, 0, 10);
      if(!dq.ok) risk += dq.penalty;

      risk = clamp(Math.round(risk), 0, 100);

      var reboundScore = (recoverDays===null) ? 0 : (recoveryFraction*Math.abs(mdd)) / Math.max(1, recoverDays);
      var reboundSpeed = (recoverDays===null) ? "لا" : (recoverDays + " يوم");

      results.push({
        symbol: sym,
        beta: beta ?? null,
        mddPct: round(mdd*100, 2),
        crashDays: crashDays,
        crashSpeedScore: round(crashSpeedScore, 6),
        recoverDays: recoverDays,
        reboundScore: round(reboundScore, 6),
        volSpikeAfterTrough: volSpike,
        atrPct: atrPct ? round(atrPct*100, 2) : null,
        riskScore: risk,
        reboundSpeed: reboundSpeed
      });
    }

    var cat = categorize(results);
    cat.all.sort(function(a,b){ return b.riskScore - a.riskScore; });
    return cat;
  }

  window.screenerEngine = { screenStocks: screenStocks };
})();
window.marketSentinel.screenerEngine = window.screenerEngine;
window.safeEngine.wrap("screenerEngine");
