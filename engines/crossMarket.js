const crossMarketEngine = {
  // روابط مرجعية افتراضية (يمكن تعديلها لاحقًا)
  // الفكرة: إذا كان السهم سعودي/طاقة => النفط، إذا تقنية => ناسداك.. إلخ
  MAP: {
    // SA examples
    "2222.SR": ["CL=F", "BZ=F"],   // أرامكو ↔ النفط
    "TASI": ["^TASI.SR"],
    // US examples (generic)
    "TECH": ["^IXIC", "^GSPC"],
    "SPX": ["^GSPC"],
    "NDX": ["^IXIC"]
  },

  normalizeSymbol(sym){
    return (sym || "").trim().toUpperCase();
  },

  guessBenchmarks(symbol){
    const s = this.normalizeSymbol(symbol);
    // explicit
    if (this.MAP[s]) return this.MAP[s];
    // Saudi stocks often end with .SR
    if (s.endsWith(".SR")) {
      // Default: TASI + Brent
      return ["^TASI.SR", "BZ=F"];
    }
    // US default: SPX + Nasdaq
    return ["^GSPC", "^IXIC"];
  },

  // analyze using pre-fetched benchmark rows: { "<bm>": rows[] }
  analyze({ symbol, stockRows, benchmarksRowsMap }){
    const out = {
      status: "not_loaded",
      conflict: false,
      scoreAdj: 0,
      reasons: [],
      evidence: {}
    };
    if (!Array.isArray(stockRows) || stockRows.length < 30) {
      out.status = "insufficient_stock_data";
      return out;
    }
    const wanted = this.guessBenchmarks(symbol);
    if (!benchmarksRowsMap || typeof benchmarksRowsMap !== "object") {
      out.status = "benchmarks_missing";
      out.reasons.push("السياق العالمي غير متاح (لم يتم تحميل المؤشرات المرجعية)");
      return out;
    }

    const bmStates = [];
    for (const bm of wanted){
      const rows = benchmarksRowsMap[bm];
      if (!Array.isArray(rows) || rows.length < 30) continue;
      try {
        const ctx = contextEngine.analyze(rows);
        bmStates.push({ symbol: bm, regime: ctx.regime, lastClose: rows[rows.length-1].close, sma200: ctx.lastSma200 || null });
      } catch(e){}
    }
    if (bmStates.length === 0){
      out.status = "benchmarks_insufficient";
      out.reasons.push("السياق العالمي غير متاح (بيانات المؤشرات غير كافية)");
      return out;
    }

    out.status = "ok";
    // conflict rule: stock in uptrend but benchmarks in downtrend/volatile
    let stockCtx = { regime: "RANGE" };
    try { stockCtx = contextEngine.analyze(stockRows); } catch(e){}
    const stockReg = (stockCtx.regime || "").toUpperCase();

    const neg = bmStates.filter(b => ["DOWNTREND","VOLATILE"].includes((b.regime||"").toUpperCase())).length;
    const total = bmStates.length;

    out.evidence = { stockRegime: stockReg, benchmarks: bmStates };

    if (stockReg === "UPTREND" && neg >= Math.ceil(total/2)){
      out.conflict = true;
      out.scoreAdj = -6; // moderate penalty
      out.reasons.push("تعارض سياق عالمي: المؤشرات المرجعية سلبية بينما السهم يظهر صعودًا");
    } else if (stockReg === "DOWNTREND" && neg === 0){
      out.reasons.push("السياق العالمي داعم نسبيًا، لكن السهم ضعيف داخليًا");
      out.scoreAdj = 0;
    } else {
      out.reasons.push("السياق العالمي متوافق/محايد مع حركة السهم");
    }

    return out;
  }
};

window.crossMarketEngine = crossMarketEngine;window.marketSentinel.crossMarketEngine = crossMarketEngine;
window.safeEngine.wrap("crossMarketEngine");
