const globalRiskScoreEngine = {
      calculate: function(analysisResult) {
          let score = 50;
          const reasons = [];
          const alerts = analysisResult.alerts || [];
          const highAlerts = alerts.filter(a => (a.level || "").toUpperCase() === "HIGH").length;
          if (highAlerts > 0) { score += highAlerts * 10; reasons.push(`يوجد ${highAlerts} تنبيهات مخاطر عالية`); }
          if (analysisResult.smartMoney) {
              if (analysisResult.smartMoney.state === "DISTRIBUTION") { score += 15; reasons.push("إشارات تصريف (Smart Money Distribution)"); }
              else if (analysisResult.smartMoney.state === "ACCUMULATION") { score -= 10; }
          }
          if (analysisResult.iceberg && analysisResult.iceberg.found) { score += 15; reasons.push("رصد أوامر مخفية (Iceberg Orders)"); }
          if (analysisResult.fakeVolume && analysisResult.fakeVolume.found) { score += 20; reasons.push(analysisResult.fakeVolume.reasons[0] || "حجم تداول وهمي / تدوير كميات"); }
          if (analysisResult.vwap && analysisResult.vwap.status === 'ok') {
              if (analysisResult.vwap.signal === "OVERBOUGHT") { score += 10; reasons.push(analysisResult.vwap.reason); }
              else if (analysisResult.vwap.signal === "BEARISH") { score += 5; reasons.push("السعر أقل من الـ VWAP (ضعف تدفق السيولة)"); }
              else if (analysisResult.vwap.signal === "OVERSOLD" || analysisResult.vwap.signal === "BULLISH") { score -= 5; }
          }
          const compTag = String(analysisResult.compositeSignals?.tag || "");
          if (compTag === "SELL_PRESSURE" || compTag === "BLOWOFF_RISK") { score += 15; reasons.push("ضغط بيعي أو مخاطر ذروة بيع"); }
          score = Math.max(0, Math.min(100, score));
          let level = "low";
          let colorClass = "text-green-500";
          if (score > 70) { level = "عالي جداً"; colorClass = "text-red-600 font-bold"; }
          else if (score > 50) { level = "high"; colorClass = "text-orange-500"; }
          else if (score > 30) { level = "متوسط"; colorClass = "text-yellow-500"; }
          
          let summary = "المخاطر في المستويات الطبيعية.";
          if (score > 50 && reasons.length > 0) {
              summary = "ارتفاع المخاطر بسبب:\n" + reasons.map(r => "• " + r).join("\n");
          }
          return { score, level, colorClass, reasons, summary };
      }
  };

window.globalRiskScoreEngine = globalRiskScoreEngine;
window.marketSentinel.globalRiskScoreEngine = globalRiskScoreEngine;
window.safeEngine.wrap("globalRiskScoreEngine");
