const riskTimelineEngine = {
  build(rows, result){
    const out = { status:"ok", events:[] };
    if(!Array.isArray(rows) || rows.length < 40){
      out.status="insufficient";
      return out;
    }
    const last = rows[rows.length-1];
    const fmt = (d)=> d || "—";

    // 1) تسارع آخر 10 أيام
    const win10 = rows.slice(-11);
    const pct = (a,b)=> b? ((a-b)/b) : 0;
    const ch10 = pct(win10[win10.length-1].close, win10[0].close);

    if(ch10 >= 0.25){
      out.events.push({ when:"آخر 10 أيام", level:"HIGH", title:"تسارع سعري قوي", detail:`ارتفاع ~${Math.round(ch10*100)}%` });
    } else if(ch10 <= -0.15){
      out.events.push({ when:"آخر 10 أيام", level:"MEDIUM", title:"هبوط ملحوظ", detail:`انخفاض ~${Math.round(Math.abs(ch10)*100)}%` });
    }

    // 2) تنبيهات اليوم
    const alerts = Array.isArray(result?.alerts) ? result.alerts : [];
    for(const a of alerts.slice(0,6)){
      out.events.push({
        when:"اليوم/آخر قراءة",
        level: (a.level || "MEDIUM").toUpperCase(),
        title: a.title || a.id || "تنبيه",
        detail: a.why || ""
      });
    }

    // 3) سياق السوق
    const mr = result?.marketRadar;
    if(mr && mr.status==="ok"){
      out.events.push({
        when:"الآن",
        level: mr.light==="RED" ? "HIGH" : (mr.light==="YELLOW" ? "MEDIUM" : "LOW"),
        title:"حالة السوق العام",
        detail:`الضوء: ${mr.light} — الدرجة: ${mr.score}`
      });
    }

    if(out.events.length===0){
      out.events.push({ when:"الآن", level:"LOW", title:"لا توجد أحداث مخاطرة بارزة", detail:"" });
    }
    return out;
  }
};

window.riskTimelineEngine = riskTimelineEngine;window.marketSentinel.riskTimelineEngine = riskTimelineEngine;
window.safeEngine.wrap("riskTimelineEngine");
