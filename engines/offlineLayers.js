// engines/offlineLayers.js
// Static-first versions of (اتجاه الأرباح / مقارنة القطاع / كاشف الضجيج)
// These layers are OPTIONAL and work offline via manual inputs stored in localStorage.

window.offlineLayers = {
  // اتجاه الأرباح (manual)
  // mode: improving | flat | declining | unknown
  earnings: function(manual = {}) {
    const mode = String(manual?.earnings?.mode || 'unknown').toLowerCase();
    let scoreAdj = 0;
    let label = 'غير متاح';
    let reason = null;

    if (mode === 'improving') {
      scoreAdj = +5;
      label = 'تحسّن';
      reason = 'نمو الأرباح: تحسّن (يدوي)';
    } else if (mode === 'flat') {
      scoreAdj = 0;
      label = 'ثابت';
      reason = 'نمو الأرباح: ثابت (يدوي)';
    } else if (mode === 'declining') {
      scoreAdj = -8;
      label = 'تدهور';
      reason = 'نمو الأرباح: تدهور (يدوي)';
    }

    return { status: 'ok', mode, label, scoreAdj, reason };
  },

  // مقارنة القطاع (manual)
  // valuation_delta_pct: negative => cheaper than sector, positive => more expensive
  sector: function(manual = {}) {
    const sector = String(manual?.sector?.name || '').toUpperCase();
    const d = Number(manual?.sector?.valuation_delta_pct);
    if (!Number.isFinite(d)) {
      return { status: 'not_set', sector: sector || null, valuation_delta_pct: null, scoreAdj: 0, reason: null };
    }

    let scoreAdj = 0;
    let label = 'محايد';
    if (d <= -10) { scoreAdj = +4; label = 'أقل من القطاع'; }
    else if (d >= 15) { scoreAdj = -6; label = 'أعلى من القطاع'; }

    const reason = `مقارنة القطاع: ${label} (${d > 0 ? '+' : ''}${Math.round(d)}%)`;
    return { status: 'ok', sector: sector || null, valuation_delta_pct: d, label, scoreAdj, reason };
  },

  // كاشف الضجيج (manual)
  // hype_score / news_severity: 0..100
  hype: function(manual = {}) {
    const hype = Number(manual?.sentiment?.hype_score);
    const sev = Number(manual?.sentiment?.news_severity);

    if (!Number.isFinite(hype) && !Number.isFinite(sev)) {
      return { status: 'not_set', hype_score: null, news_severity: null, scoreAdj: 0, reason: null };
    }
    const hs = Number.isFinite(hype) ? clamp(hype, 0, 100) : null;
    const ns = Number.isFinite(sev) ? clamp(sev, 0, 100) : null;

    // Conservative penalties (avoid false positives)
    let scoreAdj = 0;
    let riskLabel = 'low';

    const maxV = Math.max(hs ?? 0, ns ?? 0);
    if (maxV >= 80) { scoreAdj = -10; riskLabel = 'high'; }
    else if (maxV >= 60) { scoreAdj = -6; riskLabel = 'متوسط'; }
    else if (maxV >= 40) { scoreAdj = -2; riskLabel = 'خفيف'; }

    const parts = [];
    if (hs != null) parts.push(`Hype ${Math.round(hs)}`);
    if (ns != null) parts.push(`News ${Math.round(ns)}`);
    const reason = `الضجيج/التطبيل: ${riskLabel} (${parts.join(' • ')}) (يدوي)`;

    return { status: 'ok', hype_score: hs, news_severity: ns, riskLabel, scoreAdj, reason };
  },
};

function clamp(x, a, b) {
  const n = Number(x);
  if (!Number.isFinite(n)) return a;
  return Math.min(b, Math.max(a, n));
}
window.marketSentinel.offlineLayers = window.offlineLayers;
window.safeEngine.wrap("offlineLayers");
