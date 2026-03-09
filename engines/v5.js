
const v5Engine = {
  analyze(rows, snapshot = {}, context = {}, smartMoney = {}, liquidity = {}, alerts = []) {
    const len = rows.length || 0;
    if (!len) return { status: "no_data" };

    const close = snapshot.close ?? null;
    const rsi = snapshot.rsi ?? null;
    const volRatio = snapshot.volRatio ?? null;
    const mfi = snapshot.mfi ?? null;
    const cmf = snapshot.cmf ?? null;
    const obvSlope = snapshot.obvSlope ?? null;
    const vwapDelta = snapshot.vwapDelta ?? null;
    const bbPos = snapshot.bb?.pos ?? null;

    // ===== Institutional Footprint (0..100)
    let inst = 50;
    const instNotes = [];
    if (cmf != null) {
      if (cmf > 0.05) { inst += 12; instNotes.push("تدفق سيولة إيجابي (CMF)"); }
      if (cmf < -0.05) { inst -= 12; instNotes.push("تدفق سيولة سلبي (CMF)"); }
    }
    if (mfi != null) {
      if (mfi > 60) { inst += 8; instNotes.push("زخم سيولة high (MFI)"); }
      if (mfi < 40) { inst -= 8; instNotes.push("زخم سيولة low (MFI)"); }
    }
    if (obvSlope != null) {
      if (obvSlope > 0) { inst += 10; instNotes.push("تراكم محتمل (OBV↑)"); }
      if (obvSlope < 0) { inst -= 10; instNotes.push("تصريف محتمل (OBV↓)"); }
    }
    if (vwapDelta != null) {
      if (vwapDelta > 0.01) { inst += 6; instNotes.push("السعر أعلى من VWAP"); }
      if (vwapDelta < -0.01) { inst -= 6; instNotes.push("السعر أسفل من VWAP"); }
    }
    inst = Math.max(0, Math.min(100, Math.round(inst)));

    // ===== Manipulation الرادار (0..100)
    let manip = 30;
    const manipNotes = [];
    const volSpike = (volRatio != null && volRatio >= 1.5);
    const overheat = (rsi != null && rsi >= 75) || (bbPos != null && bbPos >= 0.9);
    if (volRatio != null) {
      if (volRatio >= 2.0) { manip += 22; manipNotes.push("قفزة حجم قوية (VolRatio≥2)"); }
      else if (volRatio >= 1.5) { manip += 14; manipNotes.push("قفزة حجم ملحوظة (VolRatio≥1.5)"); }
      else if (volRatio <= 0.7) { manip += 6; manipNotes.push("سيولة أضعف من المتوسط"); }
    }
    if (overheat) { manip += 18; manipNotes.push("سخونة/تشبع شرائي (RSI/BB)"); }
    if (mfi != null && mfi >= 80) { manip += 10; manipNotes.push("MFI high جدًا"); }
    if (cmf != null && cmf < -0.05) { manip += 8; manipNotes.push("ضغط تصريف (CMF سلبي)"); }

    // Use existing alert signals as penalties
    const aIds = new Set((alerts || []).map(a => a.id));
    if (aIds.has("A04") || aIds.has("A09")) { manip += 10; manipNotes.push("إشارات Pump/Distribution"); }
    if (aIds.has("A10")) { manip += 8; manipNotes.push("سيولة رقيقة"); }

    manip = Math.max(0, Math.min(100, Math.round(manip)));

    // ===== Crash / Bounce الرادار
    // Velocity measured from last N daily returns
    const N = Math.min(15, len - 1);
    let minRet = null, maxRet = null;
    for (let i = len - N; i < len; i++) {
      const prev = Number(rows[i-1]?.close);
      const cur = Number(rows[i]?.close);
      if (!isFinite(prev) || !isFinite(cur) || prev === 0) continue;
      const r = (cur - prev) / prev;
      if (minRet == null || r < minRet) minRet = r;
      if (maxRet == null || r > maxRet) maxRet = r;
    }
    const downsideVelocity = minRet == null ? null : Math.round(minRet * 1000) / 10; // %
    const upsideVelocity = maxRet == null ? null : Math.round(maxRet * 1000) / 10; // %

    let crash = 50;
    const crashNotes = [];
    if (downsideVelocity != null) {
      if (downsideVelocity <= -6) { crash += 18; crashNotes.push("هبوط يومي حاد ضمن آخر 15 جلسة"); }
      else if (downsideVelocity <= -3) { crash += 10; crashNotes.push("هبوط يومي ملحوظ"); }
      else { crash -= 4; crashNotes.push("هبوط يومي محدود"); }
    }
    if (liquidity?.grade === "C" || liquidity?.grade === "D") { crash += 12; crashNotes.push("سيولة ضعيفة تزيد حساسية الهبوط"); }
    if (context?.regime === "DOWNTREND") { crash += 10; crashNotes.push("سياق هابط"); }
    if (context?.regime === "UPTREND") { crash -= 6; crashNotes.push("سياق صاعد"); }
    if (volRatio != null && volRatio < 0.8) { crash += 6; crashNotes.push("حجم low (قابلية للانزلاق)"); }

    crash = Math.max(0, Math.min(100, Math.round(crash)));

    // Bullets (explainable)
    const bullets = [];
    bullets.push(`بصمة المؤسسات: ${inst}/100 (${instNotes.slice(0,2).join("، ") || "قراءات محايدة"})`);
    bullets.push(`رادار التلاعب: ${manip}/100 (${manipNotes.slice(0,2).join("، ") || "لا إشارات قوية"})`);
    bullets.push(`حساسية الانهيار: ${crash}/100 (${crashNotes.slice(0,2).join("، ") || "قراءات عامة"})`);

    return {
      status: "ok",
      institutional: { score: inst, obvSlope, vwapDelta, notes: instNotes },
      manipulation: { score: manip, volSpike, overheat, notes: manipNotes },
      crash: { score: crash, downsideVelocity, upsideVelocity, notes: crashNotes },
      bullets
    };
  }
};

window.v5Engine = v5Engine;
window.marketSentinel.v5Engine = v5Engine;
window.safeEngine.wrap("v5Engine");
