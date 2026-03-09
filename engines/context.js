const contextEngine = {
    analyze: function(rows) {
        // Moving averages
        const sma20 = indicators.SMA(rows, 20);
        const sma200 = indicators.SMA(rows, 200);

        const last = rows[rows.length-1];
        const prev = rows[rows.length-2];

        const lastPrice = last.close;
        const lastSma20 = sma20[sma20.length-1];
        const lastSma200 = sma200[sma200.length-1];

        // RSI / ATR
        const rsiArr = indicators.RSI(rows, 14);
        const atrArr = indicators.ATR(rows, 14);
        const lastRsi = rsiArr[rsiArr.length-1];
        const lastAtr = atrArr[atrArr.length-1];

        // Simple slope proxy (20-day MA delta over 10 days)
        const i0 = Math.max(0, sma20.length-11);
        const sma20Start = sma20[i0];
        const sma20End = lastSma20;
        const sma20Slope = (sma20Start && sma20End) ? (sma20End - sma20Start) / Math.max(1, (sma20.length-1) - i0) : 0;

        let regime = "RANGE";
        let strength = 50;

        if(lastSma20 && lastSma200 && lastSma20 > lastSma200 && lastPrice > lastSma20) {
            regime = "UPTREND";
            strength = 80;
        } else if(lastSma20 && lastSma200 && lastSma20 < lastSma200 && lastPrice < lastSma20) {
            regime = "DOWNTREND";
            strength = 20;
        }

        // Volatility check (ATR ratio)
        let atrRatio = 0;
        if(lastAtr && lastPrice) {
            atrRatio = lastAtr / lastPrice;
            if(atrRatio > 0.05) {
                regime = "VOLATILE";
                strength = Math.max(0, strength - 20);
            }
        }

        // Short-term momentum (1-day change)
        const dayChangePct = prev && prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;

        return {
            regime,
            strength,
            lastSma20,
            lastSma200,
            lastRsi,
            lastAtr,
            atrRatio,
            sma20Slope,
            dayChangePct
        };
    }
};


window.contextEngine = contextEngine;
window.marketSentinel.contextEngine = contextEngine;
window.safeEngine.wrap("contextEngine");
