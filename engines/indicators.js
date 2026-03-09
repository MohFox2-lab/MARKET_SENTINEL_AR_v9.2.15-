// Technical Indicators (Static / No deps)
// Exposes a global `indicators` object used by engines + UI.
//
// Notes:
// - All functions are defensive (return arrays aligned with input length)
// - Input rows: [{فتح, high, low, close, volume, date}]

function _num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function _padToLen(arr, len, padValue = null) {
  if (arr.length === len) return arr;
  if (arr.length > len) return arr.slice(-len);
  const pad = Array(len - arr.length).fill(padValue);
  return pad.concat(arr);
}

function _smaValues(values, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out.push(sum / period);
    else out.push(null);
  }
  return out;
}

function _emaValues(values, period) {
  if (!values.length) return [];
  const out = [];
  const k = 2 / (period + 1);
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// Global API
const indicators = {
  // ===== السعر MAs =====
  SMA(rows, period = 20) {
    const closes = rows.map(r => _num(r.close));
    return _smaValues(closes, period);
  },
  EMA(rows, period = 20) {
    const closes = rows.map(r => _num(r.close));
    return _emaValues(closes, period);
  },

  // ===== ATR (Wilder smoothing) =====
  ATR(rows, period = 14) {
    const len = rows.length;
    if (len < 2) return Array(len).fill(null);

    const tr = [null];
    for (let i = 1; i < len; i++) {
      const h = _num(rows[i].high);
      const l = _num(rows[i].low);
      const pc = _num(rows[i - 1].close);
      tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }

    const out = Array(len).fill(null);
    if (len <= period) return out;

    let sum = 0;
    for (let i = 1; i <= period; i++) sum += tr[i] ?? 0;
    out[period] = sum / period;

    for (let i = period + 1; i < len; i++) {
      out[i] = ((out[i - 1] ?? 0) * (period - 1) + (tr[i] ?? 0)) / period;
    }
    return out;
  },

  // ===== RSI (Wilder) =====
  RSI(rows, period = 14) {
    const len = rows.length;
    if (len < period + 2) return Array(len).fill(null);
    const closes = rows.map(r => _num(r.close));

    const out = Array(len).fill(null);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;

    const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out[period] = 100 - 100 / (1 + rs0);

    for (let i = period + 1; i < len; i++) {
      const diff = closes[i] - closes[i - 1];
      const g = diff > 0 ? diff : 0;
      const l = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + g) / period;
      avgLoss = (avgLoss * (period - 1) + l) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out[i] = 100 - 100 / (1 + rs);
    }
    return out;
  },

  // ===== Bollinger Bands =====
  BOLLINGER(rows, period = 20, stdMult = 2) {
    const closes = rows.map(r => _num(r.close));
    const len = closes.length;
    const mid = _smaValues(closes, period);
    const upper = Array(len).fill(null);
    const lower = Array(len).fill(null);

    for (let i = period - 1; i < len; i++) {
      const mean = mid[i];
      if (mean === null) continue;
      const slice = closes.slice(i - period + 1, i + 1);
      const variance = slice.reduce((a, v) => a + (v - mean) ** 2, 0) / period;
      const sd = Math.sqrt(variance);
      upper[i] = mean + stdMult * sd;
      lower[i] = mean - stdMult * sd;
    }

    return { mid, upper, lower };
  },

  // ===== MACD (12,26,9) =====
  MACD(rows, fast = 12, slow = 26, signal = 9) {
    const closes = rows.map(r => _num(r.close));
    const len = closes.length;
    if (!len) return { macd: [], signal: [], hist: [] };

    const fastE = _emaValues(closes, fast);
    const slowE = _emaValues(closes, slow);
    const macdLine = closes.map((_, i) => fastE[i] - slowE[i]);
    const signalLine = _emaValues(macdLine, signal);
    const hist = macdLine.map((v, i) => v - (signalLine[i] ?? 0));

    return {
      macd: _padToLen(macdLine, len, null),
      signal: _padToLen(signalLine, len, null),
      hist: _padToLen(hist, len, null)
    };
  },

  // ===== volume tools =====
  AVG_VOLUME(rows, period = 20) {
    const vols = rows.map(r => _num(r.volume));
    return _smaValues(vols, period);
  },
  VOL_RATIO(rows, period = 20) {
    const len = rows.length;
    if (len < period + 1) return Array(len).fill(null);
    const vols = rows.map(r => _num(r.volume));
    const out = Array(len).fill(null);
    const avg = _smaValues(vols, period);

    for (let i = 0; i < len; i++) {
      if (avg[i] && avg[i] > 0) out[i] = vols[i] / avg[i];
    }

    return out;
  },

  // ===== OBV (On-Balance volume) =====
  OBV(rows) {
    const len = rows.length;
    const out = Array(len).fill(null);
    if (!len) return out;

    let obv = 0;
    out[0] = 0;

    for (let i = 1; i < len; i++) {
      const c = _num(rows[i].close);
      const pc = _num(rows[i - 1].close);
      const v = _num(rows[i].volume);
      if (c > pc) obv += v;
      else if (c < pc) obv -= v;
      out[i] = obv;
    }

    return out;
  },

  // ===== MFI (Money Flow Index) =====
  MFI(rows, period = 14) {
    const len = rows.length;
    const out = Array(len).fill(null);
    if (len < period + 2) return out;

    const tp = rows.map(r => (_num(r.high) + _num(r.low) + _num(r.close)) / 3);
    const mf = tp.map((t, i) => t * _num(rows[i].volume));

    for (let i = period; i < len; i++) {
      let pos = 0;
      let neg = 0;
      for (let j = i - period + 1; j <= i; j++) {
        if (tp[j] > tp[j - 1]) pos += mf[j];
        else if (tp[j] < tp[j - 1]) neg += mf[j];
      }

      if (pos === 0 && neg === 0) { out[i] = 50; continue; }
      if (neg === 0) { out[i] = 100; continue; }

      const ratio = pos / neg;
      out[i] = 100 - 100 / (1 + ratio);
    }

    return out;
  },

  // ===== CMF (Chaikin Money Flow) =====
  CMF(rows, period = 20) {
    const len = rows.length;
    const out = Array(len).fill(null);
    if (len < period) return out;

    const mfm = rows.map(r => {
      const h = _num(r.high);
      const l = _num(r.low);
      const c = _num(r.close);
      const denom = (h - l);
      if (denom === 0) return 0;
      return ((c - l) - (h - c)) / denom; // Money Flow Multiplier
    });

    const mfv = mfm.map((m, i) => m * _num(rows[i].volume));

    for (let i = period - 1; i < len; i++) {
      let sumMFV = 0;
      let sumVol = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumMFV += mfv[j];
        sumVol += _num(rows[j].volume);
      }
      out[i] = sumVol === 0 ? 0 : (sumMFV / sumVol);
    }

    return out;
  },

  // Snapshot for UI (last values)
  
// ===== VWAP (volume Weighted Average السعر) =====
VWAP(rows) {
  const len = rows.length;
  const out = Array(len).fill(null);
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < len; i++) {
    const h = _num(rows[i].high);
    const l = _num(rows[i].low);
    const c = _num(rows[i].close);
    const v = _num(rows[i].volume);
    if (h == null || l == null || c == null || v == null) {
      out[i] = i > 0 ? out[i-1] : null;
      continue;
    }
    const tp = (h + l + c) / 3;
    cumPV += tp * v;
    cumV += v;
    out[i] = cumV > 0 ? (cumPV / cumV) : null;
  }
  return out;
},

snapshot(rows) {
    const len = rows.length;
    if (!len) return {};

    const rsi = this.RSI(rows, 14);
    const atr = this.ATR(rows, 14);
    const bb = this.BOLLINGER(rows, 20, 2);
    const macd = this.MACD(rows, 12, 26, 9);
    const volRatio = this.VOL_RATIO(rows, 20);
    const mfi = this.MFI(rows, 14);
    const cmf = this.CMF(rows, 20);
    const obvArr = this.OBV(rows);
    const vwapArr = this.VWAP(rows);

    const last = len - 1;
    const close = _num(rows[last].close);
    const bbUpper = bb.upper[last];
    const bbLower = bb.lower[last];
    let bbPos = null;

    if (bbUpper != null && bbLower != null && bbUpper !== bbLower) {
      bbPos = (close - bbLower) / (bbUpper - bbLower); // 0..1
    }

// OBV slope (last 10 points)
const obvLast = obvArr[last];
let obvSlope = null;
const look = Math.min(10, len-1);
if (look >= 2) {
  const a = obvArr[last - look + 1];
  const b = obvArr[last];
  if (a != null && b != null) {
    obvSlope = (b - a) / look;
  }
}

const vwapLast = vwapArr[last];
let vwapDelta = null;
if (vwapLast != null && close != null && close !== 0) {
  vwapDelta = (close - vwapLast) / close;
}


    return {
      close,
      rsi: rsi[last],
      atr: atr[last],
      volRatio: volRatio[last],
      bb: { mid: bb.mid[last], upper: bbUpper, lower: bbLower, pos: bbPos },
      macd: { macd: macd.macd[last], signal: macd.signal[last], hist: macd.hist[last] },
      mfi: mfi[last],
      cmf: cmf[last],
      obv: obvLast,
      obvSlope: obvSlope,
      vwap: vwapLast,
      vwapDelta: vwapDelta
    };
  }
};

window.indicators = indicators;
window.marketSentinel.indicators = indicators;
window.safeEngine.wrap("indicators");
