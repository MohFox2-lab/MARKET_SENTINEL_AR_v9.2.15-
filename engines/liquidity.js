
/**
 * Market Sentinel AR - Liquidity Engine (Static Adaptation)
 * مقتبس من v3.12.x (server/liquidity.js) — بدون سيرفر.
 * يعتمد على بيانات الشموع (OHLCV) فقط.
 *
 * API المتوافق مع النسخة Static:
 * liquidityEngine.analyze(rows) => { liquidity_score, liquidity_grade, vol_ratio20, flags, reasons, ... }
 */
(function(){
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function toNum(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
  function avg(arr){
    if (!Array.isArray(arr) || !arr.length) return null;
    const nums = arr.map(Number).filter(Number.isFinite);
    if (!nums.length) return null;
    return nums.reduce((a,b)=>a+b,0)/nums.length;
  }

  function analyzeLiquidityFromCandles(candles){
    const out = {
      liquidity_score: 50,
      liquidity_grade: 'D',
      dollar_volume: 0,
      avg_dollar_volume20: 0,
      vol_ratio20: 0,
      flags: [],
      reasons: [],
    };

    if (!Array.isArray(candles) || candles.length < 5) {
      out.reasons.push('بيانات الشموع غير كافية لحساب السيولة.');
      out.liquidity_score = 40;
      out.liquidity_grade = 'D';
      return out;
    }

    const last = candles[candles.length - 1];
    const lastClose = toNum(last.c);
    const lastVol = toNum(last.v);

    // dollar volume today
    const dollarVol = (lastClose && lastVol) ? lastClose * lastVol : 0;
    out.dollar_volume = dollarVol || 0;

    const last20 = candles.slice(-20);
    const dv20 = last20.map(c => {
      const cClose = toNum(c.c);
      const cVol = toNum(c.v);
      return (cClose && cVol) ? cClose * cVol : null;
    }).filter(v => Number.isFinite(v));

    const avgDV20 = avg(dv20) || 0;
    out.avg_dollar_volume20 = avgDV20;

    const vol20 = last20.map(c => toNum(c.v)).filter(v => Number.isFinite(v));
    const avgVol20 = avg(vol20) || 0;
    out.vol_ratio20 = (avgVol20 > 0 && Number.isFinite(lastVol)) ? (lastVol / avgVol20) : 0;

    // Conservative scoring rules
    let score = 60;

    // Liquidity threshold (adjusted for markets)
    // We keep generic thresholds; users can interpret in context.
    if (avgDV20 >= 50_000_000) { score += 20; out.flags.push('LIQ_HIGH'); out.reasons.push('سيولة يومية قوية (قيمة تداول highة).'); }
    else if (avgDV20 >= 10_000_000) { score += 10; out.flags.push('LIQ_OK'); out.reasons.push('سيولة يومية جيدة (قيمة تداول مناسبة).'); }
    else if (avgDV20 >= 2_000_000) { score += 0; out.flags.push('LIQ_LOW'); out.reasons.push('سيولة lowة نسبيًا (قيمة تداول ضعيفة).'); }
    else { score -= 15; out.flags.push('LIQ_VERY_LOW'); out.reasons.push('سيولة شديدة الضعف (قد تزيد مخاطر التلاعب/الانزلاق).'); }

    // Volume spike ratio
    if (out.vol_ratio20 >= 3) { score -= 8; out.flags.push('VOL_SPIKE'); out.reasons.push('قفزة حجم كبيرة مقارنة بمتوسط ٢٠ يوم (قد تشير إلى ضجيج/تطبيل أو حدث).'); }
    else if (out.vol_ratio20 <= 0.6) { score -= 6; out.flags.push('VOL_DRY'); out.reasons.push('ضعف واضح في الحجم مقارنة بمتوسط ٢٠ يوم (حركة بلا دعم سيولة).'); }
    else { score += 2; }

    score = clamp(score, 0, 100);
    out.liquidity_score = Math.round(score);

    // Grade
    if (out.liquidity_score >= 85) out.liquidity_grade = 'A';
    else if (out.liquidity_score >= 70) out.liquidity_grade = 'B';
    else if (out.liquidity_score >= 55) out.liquidity_grade = 'C';
    else out.liquidity_grade = 'D';

    return out;
  }

  // Adapter: rows (static) -> candles (c,v)
  function rowsToCandles(rows){
    if (!Array.isArray(rows)) return [];
    return rows.map(r => ({
      c: toNum(r.close),
      v: toNum(r.volume),
      t: r.date || r.time || r.t || null
    })).filter(c => Number.isFinite(c.c) && Number.isFinite(c.v));
  }

  window.liquidityEngine = window.liquidityEngine || {};
  window.liquidityEngine.analyze = function(rows){
    const candles = rowsToCandles(rows);
    return analyzeLiquidityFromCandles(candles);
  };
})();
window.marketSentinel.liquidityEngine = window.liquidityEngine;
window.safeEngine.wrap("liquidityEngine");
