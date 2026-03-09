const fakeVolumeEngine = {
      analyze: function(rows) {
          const out = { status: 'ok', found: false, riskScore: 0, reasons: [] };
          if (!rows || rows.length < 20) return out;
          const lastRows = rows.slice(-20);
          const avgVol = lastRows.reduce((sum, r) => sum + (r.volume || 0), 0) / 20;
          const avgRange = lastRows.reduce((sum, r) => sum + (Math.max(0.0001, r.high - r.low)), 0) / 20;
          const lastRow = rows[rows.length - 1];
          const vol = lastRow.volume || 0;
          const range = Math.max(0.0001, lastRow.high - lastRow.low);
          const midPoint = (lastRow.high + lastRow.low) / 2;
          const closeToMid = Math.abs(lastRow.close - midPoint) / range < 0.2;
          if (vol > avgVol * 2.5 && range < avgRange * 0.8 && closeToMid) {
              out.found = true; out.riskScore = 85;
              out.reasons.push("تداول وهمي (Fake Volume / Wash Trading): حجم عالي جداً مع نطاق ضيق وclose في المنتصف.");
          } else if (vol > avgVol * 2 && range < avgRange * 0.9) {
              out.found = true; out.riskScore = 60;
              out.reasons.push("تدوير كميات (Churning): حجم high دون تحرك سعري حقيقي.");
          }
          return out;
      }
  };

window.fakeVolumeEngine = fakeVolumeEngine;
window.marketSentinel.fakeVolumeEngine = fakeVolumeEngine;
window.safeEngine.wrap("fakeVolumeEngine");
