const sectorHeatmapEngine = {
  // قاعدة بيانات قطاعات بسيطة (Static) قابلة للتعديل من الواجهة لاحقًا
  // score: -100..+100 (سالب = ضغط/ضعف، موجب = قوة/طلب)
  DEFAULT_SECTORS: [
    { key: "طاقة", score: 10 },
    { key: "بنوك", score: 5 },
    { key: "اتصالات", score: 0 },
    { key: "تقنية", score: -5 },
    { key: "بتروكيماويات", score: 5 },
    { key: "صناعة", score: 0 },
    { key: "تجزئة", score: -5 },
    { key: "صحة", score: 5 },
    { key: "نقل", score: -5 },
    { key: "عقار", score: 0 }
  ],

  loadDB(){
    try {
      const raw = localStorage.getItem("MS_SECTOR_DB");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch(e){}
    return this.DEFAULT_SECTORS.slice();
  },

  saveDB(db){
    try { localStorage.setItem("MS_SECTOR_DB", JSON.stringify(db)); } catch(e){}
  },

  getSectorForSymbol(symbol){
    try {
      const raw = localStorage.getItem("MS_SYMBOL_SECTOR_MAP");
      if (!raw) return null;
      const map = JSON.parse(raw);
      return map && map[symbol] ? map[symbol] : null;
    } catch(e){ return null; }
  },

  setSectorForSymbol(symbol, sectorKey){
    try {
      const raw = localStorage.getItem("MS_SYMBOL_SECTOR_MAP");
      const map = raw ? (JSON.parse(raw) || {}) : {};
      map[symbol] = sectorKey;
      localStorage.setItem("MS_SYMBOL_SECTOR_MAP", JSON.stringify(map));
    } catch(e){}
  },

  analyze({ symbol }){
    const out = { status: "ok", sector: null, scoreAdj: 0, reason: null, heatmap: [] };
    const db = this.loadDB();
    out.heatmap = db;

    const sector = this.getSectorForSymbol(symbol);
    out.sector = sector;

    if (!sector){
      out.status = "sector_unknown";
      out.reason = "لم يتم تحديد قطاع السهم (يمكن تحديده من صفحة خريطة القطاعات)";
      return out;
    }

    const item = db.find(x => x.key === sector);
    if (!item){
      out.status = "sector_not_in_db";
      out.reason = "قطاع السهم غير موجود في قاعدة القطاعات الحالية";
      return out;
    }

    // Translate sector score into trust adjustment (small)
    const s = Number(item.score || 0); // -100..+100
    // map to [-6..+6]
    const adj = Math.max(-6, Math.min(6, Math.round(s / 15)));
    out.scoreAdj = adj;

    if (s >= 20) out.reason = `القطاع (${sector}) قوي نسبيًا (طلب أعلى من المتوسط)`;
    else if (s <= -20) out.reason = `القطاع (${sector}) تحت ضغط (حذر من المبالغة/التذبذب)`;
    else out.reason = `القطاع (${sector}) محايد`;

    return out;
  }
};

window.sectorHeatmapEngine = sectorHeatmapEngine;window.marketSentinel.sectorHeatmapEngine = sectorHeatmapEngine;
window.safeEngine.wrap("sectorHeatmapEngine");
