const alertsEngine = {
    generate: function(rows, context, smartMoney, liquidity) {
        const alerts = [];
        if(!rows || rows.length < 3) return alerts;

        const last = rows[rows.length-1];
        const prev = rows[rows.length-2];

        // Helpers
        const push = (a) => alerts.push(a);

        // البيانات quality (A12) - quick checks
        const missingOHLC = rows.some(r => [r.فتح,r.high,r.low,r.close,r.volume].some(v => typeof v !== 'number' || isNaN(v)));
        const dupDates = (() => {
            const seen = new Set();
            for(const r of rows) {
                if(!r.date) continue;
                if(seen.has(r.date)) return true;
                seen.add(r.date);
            }
            return false;
        })();
        const nonIncreasing = (() => {
            for(let i=1;i<rows.length;i++){
                if(new Date(rows[i].date) < new Date(rows[i-1].date)) return true;
            }
            return false;
        })();

        if(rows.length < 30 || missingOHLC || dupDates || nonIncreasing) {
            const issues = [];
            if(rows.length < 30) issues.push("عدد الأيام أقل من 30");
            if(missingOHLC) issues.push("قيم مفقودة/غير رقمية في OHLCV");
            if(dupDates) issues.push("تواريخ مكررة");
            if(nonIncreasing) issues.push("ترتيب التواريخ غير تصاعدي");
            push({
                id: "A12",
                level: "HIGH",
                title: "تحذير جودة البيانات",
                why: "قد تؤثر جودة البيانات على دقة التحليل",
                evidence: { issues, rows: rows.length },
                penalty: 12
            });
        }

        // A01 Overextended (price too far above SMA20)
        if(context.lastSma20 && last.close > context.lastSma20 * 1.15) {
            push({
                id: "A01",
                level: "HIGH",
                title: "تضخم سعري (Overextended)",
                why: "السعر ابتعد كثيرًا عن متوسط 20 يوم",
                evidence: {
                    close: last.close,
                    sma20: context.lastSma20,
                    ratio: Math.round((last.close / context.lastSma20) * 100) / 100
                },
                penalty: 15
            });
        }

        // A02 RSI extremes
        if(typeof context.lastRsi === "number") {
            if(context.lastRsi >= 75) {
                push({
                    id: "A02",
                    level: "MEDIUM",
                    title: "RSI high (تشبع شرائي)",
                    why: "قد يكون السهم في منطقة مبالغ فيها على المدى القصير",
                    evidence: { rsi: Math.round(context.lastRsi) },
                    penalty: 8
                });
            } else if(context.lastRsi <= 25) {
                push({
                    id: "A02",
                    level: "MEDIUM",
                    title: "RSI low (تشبع بيعي)",
                    why: "قد يكون السهم مضغوطًا بشدة (تقلبات محتملة)",
                    evidence: { rsi: Math.round(context.lastRsi) },
                    penalty: 6
                });
            }
        }

        // A03 volume Trap: volume high but price progress weak/negative
        if(smartMoney.volRatio >= 2) {
            const body = Math.abs(last.close - last.فتح);
            const range = Math.max(0.000001, (last.high - last.low));
            const bodyRatio = body / range;
            const progress = prev.close ? ((last.close - prev.close) / prev.close) : 0;
            if(bodyRatio < 0.25 || Math.abs(progress) < 0.005) {
                push({
                    id: "A03",
                    level: "MEDIUM",
                    title: "فخ سيولة (volume Trap)",
                    why: "سيولة عالية دون تقدم سعري واضح",
                    evidence: {
                        volRatio: smartMoney.volRatio,
                        bodyRatio: Math.round(bodyRatio * 100) / 100,
                        changePct: Math.round(progress * 10000) / 100
                    },
                    penalty: 10
                });
            }
        }

        // A04 Pump Risk: big green day + volume spike + close near high
        const chPct = prev.close ? ((last.close - prev.close) / prev.close) : 0;
        const closeNearHigh = (last.high - last.low) > 0 ? ((last.high - last.close) / (last.high - last.low)) < 0.2 : false;
        if(smartMoney.volRatio >= 2 && chPct >= 0.08 && closeNearHigh) {
            push({
                id: "A04",
                level: "HIGH",
                title: "مخاطر ضخ (Pump)",
                why: "قفزة قوية مع سيولة غير طبيعية وclose قرب القمة",
                evidence: { volRatio: smartMoney.volRatio, changePct: Math.round(chPct*10000)/100 },
                penalty: 14
            });
        }

        // A05 Dump Risk: big red day + volume spike
        if(smartMoney.volRatio >= 2 && chPct <= -0.08) {
            push({
                id: "A05",
                level: "HIGH",
                title: "مخاطر تفريغ (Dump)",
                why: "هبوط قوي مع سيولة غير طبيعية",
                evidence: { volRatio: smartMoney.volRatio, changePct: Math.round(chPct*10000)/100 },
                penalty: 14
            });
        }

        // A06 Trend Trap: breaks below SMA20 after being above recently
        if(context.lastSma20) {
            const aboveRecently = rows.slice(-6, -1).some(r => r.close > context.lastSma20);
            const nowBelow = last.close < context.lastSma20 && prev.close > context.lastSma20;
            if(aboveRecently && nowBelow) {
                push({
                    id: "A06",
                    level: "MEDIUM",
                    title: "فخ اتجاه (Trend Trap)",
                    why: "كسر متوسط 20 يوم بعد تماسك فوقه",
                    evidence: { close: last.close, sma20: context.lastSma20 },
                    penalty: 9
                });
            }
        }

        // A07 Divergence بروكسي: RSI falling while price making higher highs (simple 10-day)
        try {
            const rsiArr = indicators.RSI(rows, 14);
            const win = rows.slice(-12);
            const rsiWin = rsiArr.slice(-12).filter(v => typeof v === "number");
            if(win.length >= 10 && rsiWin.length >= 6) {
                const priceHigh1 = Math.max(...win.slice(0,6).map(r=>r.close));
                const priceHigh2 = Math.max(...win.slice(6).map(r=>r.close));
                const rsiAvg1 = rsiWin.slice(0, Math.floor(rsiWin.length/2)).reduce((s,v)=>s+v,0) / Math.max(1, Math.floor(rsiWin.length/2));
                const rsiAvg2 = rsiWin.slice(Math.floor(rsiWin.length/2)).reduce((s,v)=>s+v,0) / Math.max(1, rsiWin.length - Math.floor(rsiWin.length/2));
                if(priceHigh2 > priceHigh1 * 1.01 && rsiAvg2 < rsiAvg1 - 5) {
                    push({
                        id: "A07",
                        level: "MEDIUM",
                        title: "تباعد سلبي محتمل (Divergence)",
                        why: "السعر يحقق قممًا أعلى بينما الزخم (RSI) يضعف",
                        evidence: {
                            priceHigh1: Math.round(priceHigh1*100)/100,
                            priceHigh2: Math.round(priceHigh2*100)/100,
                            rsiAvg1: Math.round(rsiAvg1),
                            rsiAvg2: Math.round(rsiAvg2)
                        },
                        penalty: 10
                    });
                }
            }
        } catch(e) {}

        // A08 Global Context Conflict (static: only if benchmark provided)
        if(window && window.benchmarkContext && window.benchmarkContext.conflict === true) {
            push({
                id: "A08",
                level: "MEDIUM",
                title: "تعارض سياق عالمي",
                why: "سياق المؤشر المرجعي سلبي مقارنة بالسهم",
                evidence: window.benchmarkContext.evidence || {},
                penalty: 8
            });
        }

        // A09 SmartMoney Distribution
        if(smartMoney.state === "DISTRIBUTION") {
            push({
                id: "A09",
                level: "HIGH",
                title: "علامات تصريف (Smart Money)",
                why: "سيولة highة مع close أدنى",
                evidence: { volRatio: smartMoney.volRatio, dayChangePct: smartMoney.dayChangePct },
                penalty: 15
            });
        }

        // A10 Thin Liquidity
        if(liquidity.grade === "D") {
            push({
                id: "A10",
                level: "MEDIUM",
                title: "سيولة ضعيفة (Thin Liquidity)",
                why: "متوسط القيمة المتداولة low جدًا",
                evidence: { dollarVolume: Math.round(liquidity.dollarVolume) },
                penalty: 10
            });
        }

        // A11 Gap Risk
        const gap = prev.close ? Math.abs(last.فتح - prev.close) / prev.close : 0;
        if(gap > 0.04) {
            push({
                id: "A11",
                level: "MEDIUM",
                title: "مخاطر فجوة سعرية (Gap)",
                why: "فجوة كبيرة عند الافتتاح",
                evidence: { gapPct: Math.round(gap*10000)/100, فتح: last.فتح, prevClose: prev.close },
                penalty: 8
            });
        }

        // De-duplicate by id (keep highest penalty)
        const map = new Map();
        for(const a of alerts) {
            if(!map.has(a.id) || map.get(a.id).penalty < a.penalty) map.set(a.id, a);
        }
        return Array.from(map.values());
    }
};


window.alertsEngine = alertsEngine;
window.marketSentinel.alertsEngine = alertsEngine;
window.safeEngine.wrap("alertsEngine");
