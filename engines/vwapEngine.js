const vwapEngine = {
      analyze: function(rows) {
          if (!rows || rows.length === 0) return { status: 'not_loaded', score: 0, reason: null };
          let cumulativeVolume = 0;
          let cumulativePV = 0;
          let latestVwap = 0;
          let latestPrice = rows[rows.length - 1].close;
          const period = Math.min(rows.length, 30);
          const lastRows = rows.slice(-period);
          lastRows.forEach(r => {
              const typicalPrice = (r.high + r.low + r.close) / 3;
              const volume = r.volume || 0;
              cumulativePV += typicalPrice * volume;
              cumulativeVolume += volume;
          });
          if (cumulativeVolume > 0) {
              latestVwap = cumulativePV / cumulativeVolume;
          }
          let diff = latestVwap > 0 ? ((latestPrice - latestVwap) / latestVwap) * 100 : 0;
          let signal = "NEUTRAL";
          let score = 50;
          let reason = "السعر قريب من التوازن (VWAP)";
          if (diff > 5) {
              signal = "OVERBOUGHT"; score = 80; reason = `السعر أعلى من VWAP بـ ${diff.toFixed(2)}% (احتمال جني أرباح)`;
          } else if (diff < -5) {
              signal = "OVERSOLD"; score = 20; reason = `السعر أقل من VWAP بـ ${Math.abs(diff).toFixed(2)}% (مناطق دعم محتملة)`;
          } else if (diff > 0) {
              signal = "BULLISH"; score = 60; reason = "دخول سيولة إيجابية (السعر أعلى قليلاً من VWAP)";
          } else {
              signal = "BEARISH"; score = 40; reason = "ضغط بيعي (السعر أقل قليلاً من VWAP)";
          }
          return { status: 'ok', vwap: latestVwap, diff, signal, score, reason };
      }
  };

window.vwapEngine = vwapEngine;
window.marketSentinel.vwapEngine = vwapEngine;
window.safeEngine.wrap("vwapEngine");
