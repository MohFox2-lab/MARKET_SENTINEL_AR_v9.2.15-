function clamp(n,a,b){return Math.max(a,Math.min(b,n));}

// --- جودة البيانات (Data Quality) ---
function parseCandleTs(row){
  if (!row) return null;
  const t = row.date || row.time || row.t;
  if (!t) return null;
  // YYYY-MM-DD
  if (typeof t === 'string' && t.length === 10 && t.includes('-')){
    const ms = Date.parse(t + 'T00:00:00Z');
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(String(t));
  return Number.isFinite(ms) ? ms : null;
}
function computeMissingDaysRatio(rows){
  if (!Array.isArray(rows) || rows.length < 10) return null;
  const first = parseCandleTs(rows[0]);
  const last = parseCandleTs(rows[rows.length-1]);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return null;
  const daysSpan = Math.max(1, Math.round((last-first)/(24*60*60*1000)));
  // توقع محافظ لأيام التداول (~70% من الأيام)
  const expected = Math.max(1, Math.round(daysSpan*0.7));
  const actual = rows.length;
  const missing = Math.max(0, expected-actual);
  return clamp(missing/expected, 0, 1);
}

// Shared analysis state — all modules read from this
window.analysisResults = window.analysisResults || [];
window.lastAnalysis = null;

function saveAnalysisResult(result) {
    window.lastAnalysis = result;
    window.analysisResults.push({
        symbol: result.symbol,
        trustScore: result.trust.score,
        recommendation: result.decision.label,
        reasons: result.decision.reasons,
        smartMoney: result.smartMoney,
        liquidity: result.liquidity,
        fakeVolume: result.fakeVolume,
        vwap: result.vwap,
        iceberg: result.iceberg,
        hypeBubble: result.hypeBubble,
        marketRadar: result.marketRadar,
        compositeSignals: result.compositeSignals,
        globalRiskScore: result.globalRiskScore,
        context: result.context,
        updatedAt: Date.now()
    });
}

const analysisEngine = {
    run: function(marketData) {
        const rows = marketData.rows;

        // يدوي/offline advanced layers (Earnings/Sector/Hype)
        const manual = (window.storage && typeof storage.loadManual === 'function')
            ? (storage.loadManual(marketData.symbol) || null)
            : null;
        const off = window.offlineLayers || null;
        const earningsLayer = off ? off.earnings(manual || {}) : { status: 'not_loaded', scoreAdj: 0, reason: null };
        const sectorLayer   = off ? off.sector(manual || {})   : { status: 'not_loaded', scoreAdj: 0, reason: null };
        const hypeLayer     = off ? off.hype(manual || {})     : { status: 'not_loaded', scoreAdj: 0, reason: null };

        // Indicator snapshot (for UI + explainability)
        let indicatorSnapshot = {};
        try {
            indicatorSnapshot = indicators.snapshot(rows);
        } catch(e) {
            indicatorSnapshot = {};
        }

        const context = contextEngine.analyze(rows);
        const smartMoney = smartMoneyEngine.analyze(rows);
        const liquidity = liquidityEngine.analyze(rows);
        const alerts = alertsEngine.generate(rows, context, smartMoney, liquidity);

        // --- طبقات متقدمة (Static) ---
        const smartMoneyPro = (window.smartMoneyProEngine && typeof smartMoneyProEngine.analyze === 'function')
            ? smartMoneyProEngine.analyze(rows)
            : { status: 'not_loaded', score: 0, signal: 'NEUTRAL', reasons: [] };

        
          const vwap = (window.vwapEngine && typeof vwapEngine.analyze === 'function')
              ? vwapEngine.analyze(rows)
              : { status: 'not_loaded', score: 0, reason: null };

          const fakeVolume = (window.fakeVolumeEngine && typeof fakeVolumeEngine.analyze === 'function')
              ? fakeVolumeEngine.analyze(rows)
              : { status: 'not_loaded', found: false, riskScore: 0, reasons: [] };
  
        const iceberg = (window.icebergEngine && typeof icebergEngine.detect === 'function')
            ? icebergEngine.detect(rows)
            : { status: 'not_loaded', found: false, strength: 0, reasons: [] };

        const hypeBubble = (window.hypeBubbleEngine && typeof hypeBubbleEngine.detect === 'function')
            ? hypeBubbleEngine.detect({ rows, indicatorsSnap: indicatorSnapshot, manual: manual || {} })
            : { status: 'not_loaded', found: false, strength: 0, reasons: [] };

        const sectorHeatmap = (window.sectorHeatmapEngine && typeof sectorHeatmapEngine.analyze === 'function')
            ? sectorHeatmapEngine.analyze({ symbol: marketData.symbol })
            : { status: 'not_loaded', sector: null, scoreAdj: 0, reason: null, heatmap: [] };

        const crossMarket = (window.crossMarketEngine && typeof crossMarketEngine.analyze === 'function')
            ? crossMarketEngine.analyze({ symbol: marketData.symbol, stockRows: rows, benchmarksRowsMap: marketData.benchmarks || null })
            : { status: 'not_loaded', conflict: false, scoreAdj: 0, reasons: [], evidence: {} };
        
        const marketRadar = (window.marketRadarEngine && typeof marketRadarEngine.analyze === 'function')
            ? marketRadarEngine.analyze({ symbol: marketData.symbol, benchmarksRowsMap: marketData.benchmarks || null })
            : { status: 'not_loaded', score: 50, light: 'YELLOW', reasons: [], components: [] };

        const patterns = (window.patternsEngine && typeof patternsEngine.detect === 'function')
            ? patternsEngine.detect({ alerts: alerts, smartMoneyPro, iceberg,
            vwap,
            fakeVolume, hypeBubble, marketRadar, crossMarket })
            : { status:'not_loaded', patterns: [], top: null, reasons: [] };

        const riskTimeline = (window.riskTimelineEngine && typeof riskTimelineEngine.build === 'function')
            ? riskTimelineEngine.build(rows, { alerts: alerts, marketRadar })
            : { status:'not_loaded', events: [] };

        const candlestickSignalsRaw = (window.candlestickEngine && typeof candlestickEngine.detect === 'function')
            ? candlestickEngine.detect(rows)
            : { status:'not_loaded', patterns:[], top:null, confidence:0, reasons:[] };

        // ربط ذكي مع طبقات النظام لتقليل الإشارات الكاذبة
        const candlestickSignals = (window.candlestickEngine && typeof candlestickEngine.contextualize === 'function')
            ? candlestickEngine.contextualize(candlestickSignalsRaw, { alerts: alerts, smartMoney, smartMoneyPro, marketRadar })
            : candlestickSignalsRaw;

        const compositeSignals = (window.compositeSignalsEngine && typeof compositeSignalsEngine.detect === 'function')
            ? compositeSignalsEngine.detect({ candlestickSignals, smartMoney, smartMoneyPro, iceberg, marketRadar, hypeBubble, alerts: alerts })
            : { status:'not_loaded', tag:'NONE', scoreAdj:0, alerts:[], reasons:[] };


        // expose for alerts A08
        try {
            window.benchmarkContext = { conflict: !!crossMarket.conflict, evidence: crossMarket.evidence || {} };
        } catch(e) {}

        const v5 = (window.v5Engine && typeof v5Engine.analyze === 'function')
            ? v5Engine.analyze(rows, indicatorSnapshot, context, smartMoney, liquidity, alerts)
            : { status: 'not_loaded' };

        // Base trust
        let trustScore = 70;

        // Context adjustments
        if(context.regime === "UPTREND") trustScore += 5;
        if(context.regime === "DOWNTREND") trustScore -= 10;
        if(context.regime === "VOLATILE") trustScore -= 8;

        // Liquidity adjustments
        if(liquidity.grade === "A") trustScore += 5;
        if(liquidity.grade === "D") trustScore -= 10;

        // Smart money adjustments (light)
        if(smartMoney.state === "ACCUMULATION") trustScore += 3;
        if(smartMoney.state === "DISTRIBUTION") trustScore -= 5;

        // Smart Money Pro (لحظي) — تأثير صغير (حتى لا يطغى)
        if(smartMoneyPro && smartMoneyPro.status === 'ok') {
            trustScore += Math.round((smartMoneyPro.score || 0) / 5); // ~ -3..+3
        }

        // التنبيهات penalties (cap)
        const extraAlerts = [];
        try {
            const a13 = icebergEngine && icebergEngine.toAlert ? icebergEngine.toAlert(iceberg) : null;
            if(a13) extraAlerts.push(a13);
        } catch(e) {}
        try {
            const a14 = hypeBubbleEngine && hypeBubbleEngine.toAlert ? hypeBubbleEngine.toAlert(hypeBubble) : null;
            if(a14) extraAlerts.push(a14);
        } catch(e) {}

        
        try {
            const compAlerts = (typeof compositeSignals !== 'undefined' && compositeSignals && Array.isArray(compositeSignals.alerts)) ? compositeSignals.alerts : [];
            compAlerts.forEach(a=>{ if(a) extraAlerts.push(a); });
        } catch(e) {}
        
// دمج التنبيهات
        const allAlerts = alerts.concat(extraAlerts);

        const totalPenalty = allAlerts.reduce((sum, a) => sum + (a.penalty || 0), 0);
        trustScore -= Math.min(totalPenalty, 45);

        // ✅ غير متصل advanced layers adjustments (optional)
        trustScore += Number(earningsLayer.scoreAdj || 0);
        trustScore += Number(sectorLayer.scoreAdj || 0);
        trustScore += Number(hypeLayer.scoreAdj || 0);

        // Sector Heatmap (Static)
        trustScore += Number(sectorHeatmap.scoreAdj || 0);

        // Cross Market Context
        trustScore += Number(crossMarket.scoreAdj || 0);


        // Candlestick Intelligence — تأثير خفيف (لا يطغى على المحركات الأساسية)
        let candlestickAdj = 0;
        try {
            if(candlestickSignals && candlestickSignals.top){
                const conf = Number(candlestickSignals.confidence||0);
                const t = String(candlestickSignals.top.type||'');
                if(conf >= 70){ candlestickAdj = t.startsWith('BULL') ? 2 : (t.startsWith('BEAR') ? -2 : 0); }
                else if(conf >= 40){ candlestickAdj = t.startsWith('BULL') ? 1 : (t.startsWith('BEAR') ? -1 : 0); }
            }
        } catch(e) {}
        trustScore += candlestickAdj;

        // Composite Signals — تأثير صغير + تنبيه تفسيري
        try { trustScore += Number(compositeSignals.scoreAdj || 0); } catch(e) {}


        trustScore = Math.max(0, Math.min(100, trustScore));

        let light = '🔴';
        if(trustScore >= 75) light = '🟢';
        else if(trustScore >= 50) light = '🟡';

        const result = {
            symbol: marketData.symbol,
            source: marketData.source,
            range: `${rows.length} يوم`,
            trust: { score: Math.round(trustScore), light },
            context,
            smartMoney,
            liquidity,
            alerts: allAlerts,

            indicators: indicatorSnapshot,

            // يدوي/offline layers (Static)
            fundamentals: marketData.fundamentals || manual?.fundamentals || { status: "manual_not_set" },
            sentiment: marketData.sentiment || manual?.sentiment || { status: "manual_not_set" },
            earningsTrend: earningsLayer,
            sectorCompare: sectorLayer,
            hypeDetector: hypeLayer,

            // طبقات متقدمة
            crossMarket,
            sectorHeatmap,
            smartMoneyPro,
            iceberg,
            hypeBubble,
            marketRadar,
            patterns,
            riskTimeline,
            candlestickSignals,
            compositeSignals,

            meta: { rows: rows.length, firstDate: rows[0].date, lastDate: rows[rows.length-1].date }
        };

        // القرار
        try {
            result.decision = decisionEngine.getDecision(result);
        } catch(e) {
            result.decision = { label: "غير متاح", colorClass: "text-gray-600 border-gray-200", reasons: [] };
        }

        
          if (window.globalRiskScoreEngine && typeof globalRiskScoreEngine.calculate === 'function') {
              result.globalRiskScore = globalRiskScoreEngine.calculate(result);
          }

          // Save to shared state so all modules can access
          saveAnalysisResult(result);

          return result;
    }
};
