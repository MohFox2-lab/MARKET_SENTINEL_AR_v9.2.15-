## v9.2.11 — Shared State Repair
- إصلاح ربط التبويبات بالحالة المشتركة `window.lastAnalysis` و `window.analysisResults`
- توحيد أسماء التبويبات بين HTML و `renderTabContent`
- إصلاح `ui.switchTab` لإظهار/إخفاء الصفحات بشكل صحيح
- تحديث رادار المحفظة والقوائم الذكية لقراءة التحليلات الفعلية
- دعم رفع عدة ملفات في فرز الأسهم واختبار ضغط المحفظة

# CHANGELOG — Market Sentinel AR (Static)

## v9.2.10 — Module Refresh Engine
- إنشاء دالة `refreshAllModules()` تحدّث جميع التبويبات بعد كل تحليل ناجح
- استدعاء `refreshAllModules()` في جميع نقاط التحليل الناجح
- ضمان أن جميع التبويبات تقرأ من `window.lastAnalysis` الحالية
- إضافة console.log لتتبع التحديثات في وضع المطور
- معالجة أخطاء شاملة لكل دالة تحديث

## v9.2.9 — Tab Synchronization Fix
- جميع التبويبات الآن تقرأ من الحالة المشتركة `window.lastAnalysis`
- إضافة دالة `renderTabContent()` تحدث المحتوى عند التبديل بين التبويبات
- إصلاح مشكلة "لم يتم تنفيذ تحليل بعد" في جميع التبويبات (Market Radar, Iceberg, Sector, إلخ)
- التبويبات الآن تظهر البيانات فوراً عند التبديل دون الحاجة لإعادة التحليل

## v9.2.8 — System Link Fix (Module Connection)
- إنشاء حالة مشتركة `window.lastAnalysis` و `window.analysisResults` لربط جميع الوحدات
- كل وحدة تقرأ من الآن نتائج التحليل المركزية بدلاً من انتظار التحديث
- إصلاح مشكلة "لم يتم تنفيذ تحليل بعد" في الوحدات
- إضافة كشف تلقائي لنوع البيانات (يومي vs لحظي)
- إضافة fallback Smart Money Pro → Smart Money Lite عند البيانات اليومية فقط
- عرض رسالة واضحة عند التبديل التلقائي للمستخدم

## v9.2.7 — Recommendation Engine with Detailed Reasoning
- نظام توصيات مباشر بدون ذكاء اصطناعي (مبني على المؤشرات فقط).
- 5 حالات توصية واضحة:
  1. **شراء / زيادة الكمية** (Trust Score >= 80 + بدون تنبيهات عالية)
  2. **شراء** (Trust Score >= 70 + تنبيهات منخفضة)
  3. **احتفاظ / تحت المتابعة** (Trust Score >= 55)
  4. **تصريف جزء منها** (Trust Score >= 40)
  5. **بيع** (Trust Score < 40)
- عرض تفسير مفصل لأسباب التوصية (من SmartMoney, Liquidity, VWAP, FakeVolume, MarketRadar, CompositeSignals).
- تحديث واجهة قسم التوصية لعرض الأسباب أسفل التوصية مباشرة.

## v9.2.5 — Analysis Fix (Hotfix)
- إصلاح خطأ `Cannot access 'allAlerts' before initialization` في مسار التحليل (`analysisEngine.js`).
- التأكد من إتاحة كل المؤشرات (Risk Score, Smart Money, Iceberg, Liquidity Trap, Fake Volume, VWAP, Global Risk Score, Radar) بعد تشغيل التحليل.
- التأكد من عمل تطبيق المحفظة (Portfolio) بدون أخطاء.

## v9.0.0 — Unified Risk Layer + VWAP + Fake Volume
- إضافة VWAP Engine لحساب متوسط السعر المرجح بالحجم.
- إضافة Fake Volume Engine لكشف Wash Trading / التدوير الوهمي.
- إضافة Global Risk Score لدمج نتائج المحركات وإخراج درجة موحدة 0..100 مع تفسير.
- عرض "مؤشر المخاطر الشامل" في Dashboard مع شريط مستوى الخطر + أهم الأسباب.
- تحديث رقم النسخة في ملفات النظام (index.html + js/version.js).


## v9.1.0 — Portfolio Watch
- إضافة تبويب المحفظة (Portfolio Watch): إضافة/حذف أسهم + تحليل الكل + تخزين محلي.
- تخزين ملخص آخر تحليل لكل سهم لعرض الأسباب بسرعة.
