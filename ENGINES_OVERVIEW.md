# نظرة عامة على المحركات (Engines Overview)

يحتوي مجلد `engines` على مجموعة من وحدات التحليل المنفصلة (Modules)، حيث يركز كل محرك على جانب محدد من حركة السعر والسيولة:

- **alerts.js**: إدارة التنبيهات الذكية والشروط.
- **candlesticks.js**: تحليل نماذج الشموع اليابانية وتحديد النماذج الانعكاسية والاستمرارية.
- **compositeSignals.js**: دمج الإشارات للحصول على تقييم مركب.
- **context.js**: قراءة سياق السوق العام (اتجاه صاعد، هابط، عرضي).
- **crossMarket.js**: ربط الأسواق ببعضها إذا لزم الأمر.
- **decisionRadar.js**: تقديم مصفوفة القرار بناءً على الرادار الشامل.
- **fakeVolumeEngine.js**: كشف أحجام التداول الوهمية والاختراقات الكاذبة.
- **fetchLiveEngine.js**: جلب البيانات الحية من مزودي البيانات الخارجية.
- **globalRiskScore.js**: حساب مستوى المخاطرة الكلي في السوق.
- **hypeBubble.js**: رصد فقاعات الشراء وحالات المبالغة (FOMO).
- **iceberg.js**: تتبع الأوامر المخفية والسيولة غير الظاهرة (Iceberg Orders).
- **indicators.js**: حساب المؤشرات الفنية الكلاسيكية (RSI, MACD, Moving Averages...).
- **liquidity.js / liquidityTrap.js**: تحليل مناطق السيولة وفخاخ صانع السوق.
- **marketRadar.js / watchlistRadar.js**: أداة لمسح وتتبع عدة أصول في نفس الوقت.
- **offlineLayers.js**: دعم العمل بدون اتصال وعرض التخزين المحلي.
- **patterns.js**: رصد الأنماط الفنية الكلاسيكية (رأس وكتفين، مثلثات، قمم مزدوجة...).
- **portfolioGuard.js / portfolioRadar.js / portfolioStress.js**: حماية المحفظة واختبار تحملها (Stress Test) وتحليل الأداء.
- **riskControls.js / riskTimeline.js**: إدارة المخاطر وتتبع تطور المخاطرة مع الزمن.
- **screener.js**: تصفية الأسهم أو العملات حسب شروط معينة.
- **sectorHeatmap.js**: خريطة حرارية للقطاعات لتحديد السيولة المتنقلة.
- **smartMoney.js / smartMoneyPro.js**: تتبع أثر الأموال الذكية (Smart Money Concepts - SMC).
- **v5.js**: محرك التحليل من الجيل الخامس للقرارات المتقدمة.
- **vwapEngine.js**: تحليل السعر بناءً على حجم التداول (VWAP).
