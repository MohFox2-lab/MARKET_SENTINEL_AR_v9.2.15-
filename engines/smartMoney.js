const smartMoneyEngine = {
    analyze: function(rows) {
        let score = 50;
        let state = "NEUTRAL";

        const last20 = rows.slice(-20);
        const avgVol = last20.reduce((sum, r) => sum + r.volume, 0) / 20;

        const last = rows[rows.length-1];
        const prev = rows[rows.length-2];

        const volRatio = avgVol > 0 ? (last.volume / avgVol) : 1;
        const changePct = prev && prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;

        const reasons = [];

        // high volume day interpretation (simple)
        if(volRatio >= 2) {
            if(changePct >= 0) {
                state = "ACCUMULATION";
                score += 20;
                reasons.push("ارتفاع سيولة قوي مع close أعلى (تجميع محتمل)");
            } else {
                state = "DISTRIBUTION";
                score -= 20;
                reasons.push("ارتفاع سيولة قوي مع close أدنى (تصريف محتمل)");
            }
        } else if(volRatio >= 1.5) {
            if(changePct >= 0.5) { score += 8; reasons.push("سيولة فوق المتوسط مع صعود"); }
            else if(changePct <= -0.5) { score -= 8; reasons.push("سيولة فوق المتوسط مع هبوط"); }
        }

        score = Math.max(0, Math.min(100, score));

        return {
            state,
            score,
            reasons,
            volRatio: Math.round(volRatio * 100) / 100,
            dayChangePct: Math.round(changePct * 100) / 100
        };
    }
};


window.smartMoneyEngine = smartMoneyEngine;
window.marketSentinel.smartMoneyEngine = smartMoneyEngine;
window.safeEngine.wrap("smartMoneyEngine");
