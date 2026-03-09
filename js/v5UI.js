
const v5UI = {
  init() {
    // nothing for now
  },
  render(analysis) {
    const empty = document.getElementById("v5-empty");
    const content = document.getElementById("v5-content");
    if (!analysis || !analysis.v5 || analysis.v5.status !== "ok") {
      empty.classList.remove("hidden");
      content.classList.add("hidden");
      return;
    }
    empty.classList.add("hidden");
    content.classList.remove("hidden");

    const v5 = analysis.v5;

    const fmtPct = (x) => {
      if (x == null || !isFinite(x)) return "—";
      return `${(x*100).toFixed(2)}%`;
    };

    document.getElementById("v5-inst-score").textContent = `${v5.institutional.score}/100`;
    document.getElementById("v5-obv-slope").textContent = (v5.institutional.obvSlope == null) ? "—" : Math.round(v5.institutional.obvSlope).toLocaleString();
    document.getElementById("v5-vwap-delta").textContent = fmtPct(v5.institutional.vwapDelta);
    document.getElementById("v5-inst-notes").textContent = (v5.institutional.notes && v5.institutional.notes.length) ? v5.institutional.notes.join(" • ") : "قراءات محايدة";

    document.getElementById("v5-manip-score").textContent = `${v5.manipulation.score}/100`;
    document.getElementById("v5-vol-spike").textContent = v5.manipulation.volSpike ? "نعم" : "لا";
    document.getElementById("v5-overheat").textContent = v5.manipulation.overheat ? "نعم" : "لا";
    document.getElementById("v5-manip-notes").textContent = (v5.manipulation.notes && v5.manipulation.notes.length) ? v5.manipulation.notes.join(" • ") : "لا إشارات قوية";

    document.getElementById("v5-down-vel").textContent = (v5.crash.downsideVelocity == null) ? "—" : `${v5.crash.downsideVelocity}%`;
    document.getElementById("v5-up-vel").textContent = (v5.crash.upsideVelocity == null) ? "—" : `${v5.crash.upsideVelocity}%`;
    document.getElementById("v5-crash-score").textContent = `${v5.crash.score}/100`;
    document.getElementById("v5-crash-notes").textContent = (v5.crash.notes && v5.crash.notes.length) ? v5.crash.notes.join(" • ") : "قراءات عامة";

    const bullets = document.getElementById("v5-bullets");
    bullets.innerHTML = (v5.bullets || []).map(t => `<li>${t}</li>`).join("");
  }
};

window.v5UI = v5UI;
