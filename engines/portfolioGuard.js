const portfolioGuardEngine = {
  STORAGE_KEY: "MS_PORTFOLIO_V1",

  load(){
    try{
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if(!raw) return { items: [] };
      const data = JSON.parse(raw);
      if(!data || !Array.isArray(data.items)) return { items: [] };
      return data;
    }catch(e){
      return { items: [] };
    }
  },

  save(data){
    try{
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data||{items:[]}));
      return true;
    }catch(e){ return false; }
  },

  // الربط مع آخر تحليلات (من watchlistRadarEngine إن وُجد)
  loadLatestAnalyses(){
    try{
      if(window.watchlistRadarEngine && typeof watchlistRadarEngine.loadAnalyses === "function"){
        const arr = watchlistRadarEngine.loadAnalyses();
        // normalize like v8.1
        const map = new Map();
        for(const item of arr){
          const a = item.analysis ? item.analysis : item;
          const symbol = a.symbol || a?.meta?.symbol || a?.meta?.ticker || a?.input?.symbol;
          if(!symbol) continue;
          const ts = a?.meta?.timestamp || a?.meta?.ts || a?.timestamp || 0;
          const t = ts ? new Date(ts).getTime() : 0;
          const cur = map.get(symbol);
          if(!cur || (t >= (cur._t||0))){
            a._t = t;
            map.set(symbol, a);
          }
        }
        return map;
      }
    }catch(e){}
    return new Map();
  },

  // حساب توزيع القطاعات + تركّز
  evaluate(portfolio){
    const out = {
      status:"ok",
      totals:{ count:0, weightSum:0 },
      sector:{}, // {name:{weight,count}}
      topSingles:[], // [{symbol,weight,sector}]
      warnings:[],   // [{level,title,text}]
      insights:[],   // [{title,text}]
      items:[]
    };

    const items = (portfolio?.items||[]).map(x=>{
      const symbol = String(x.symbol||"").trim().toUpperCase();
      const sector = String(x.sector||"غير محدد").trim();
      const weight = Number(x.weight||0); // %
      return { symbol, sector, weight: isFinite(weight)?weight:0 };
    }).filter(x=>x.symbol);

    out.items = items;
    out.totals.count = items.length;
    out.totals.weightSum = items.reduce((s,x)=>s+x.weight,0);

    // إذا لم يضع المستخدم أوزاناً، نوزع بالتساوي
    const useWeights = out.totals.weightSum > 0;
    const eq = items.length ? (100/items.length) : 0;

    const sectorAgg = {};
    for(const it of items){
      const w = useWeights ? it.weight : eq;
      if(!sectorAgg[it.sector]) sectorAgg[it.sector] = { weight:0, count:0 };
      sectorAgg[it.sector].weight += w;
      sectorAgg[it.sector].count += 1;
    }
    out.sector = sectorAgg;

    // top singles
    const singles = items.map(it=>{
      const w = useWeights ? it.weight : eq;
      return { symbol: it.symbol, weight: w, sector: it.sector };
    }).sort((a,b)=>b.weight-a.weight);
    out.topSingles = singles.slice(0,5);

    // Warnings: sector concentration
    const sectorList = Object.entries(sectorAgg).map(([name,v])=>({name, ...v})).sort((a,b)=>b.weight-a.weight);
    const topSector = sectorList[0];
    if(topSector && topSector.weight >= 45){
      out.warnings.push({
        level:"HIGH",
        title:"تركّز قطاعي high",
        text:`قطاع "${topSector.name}" يمثل تقريبًا ${topSector.weight.toFixed(1)}% من المحفظة. جرّب توزيع جزء على قطاع آخر لتقليل المخاطر.`
      });
    } else if(topSector && topSector.weight >= 35){
      out.warnings.push({
        level:"MED",
        title:"تركّز قطاعي متوسط",
        text:`قطاع "${topSector.name}" يمثل تقريبًا ${topSector.weight.toFixed(1)}% من المحفظة. راقب المخاطر المرتبطة بنفس القطاع.`
      });
    }

    // Warnings: single position concentration
    const topSingle = singles[0];
    if(topSingle && topSingle.weight >= 25){
      out.warnings.push({
        level:"HIGH",
        title:"تعرّض high لسهم واحد",
        text:`السهم "${topSingle.symbol}" يمثل تقريبًا ${topSingle.weight.toFixed(1)}% من المحفظة. لو ظهرت إشارات خطر، سيكون أثرها كبيراً.`
      });
    } else if(topSingle && topSingle.weight >= 18){
      out.warnings.push({
        level:"MED",
        title:"تعرّض ملحوظ لسهم واحد",
        text:`السهم "${topSingle.symbol}" يمثل تقريبًا ${topSingle.weight.toFixed(1)}% من المحفظة. ضع حدود مخاطر واضحة.`
      });
    }

    // Insights (تنويع بسيط)
    if(items.length <= 2 && items.length > 0){
      out.insights.push({
        title:"تنويع المحفظة",
        text:"عدد الأسهم قليل. إضافة 2–4 أسهم من قطاعات مختلفة عادةً يقلل تذبذب المحفظة."
      });
    }

    if(Object.keys(sectorAgg).length <= 1 && items.length >= 2){
      out.insights.push({
        title:"تنويع القطاعات",
        text:"جميع الأسهم تقريبًا في قطاع واحد. جرّب إدخال قطاع آخر (طاقة/بنوك/تقنية/اتصالات/صناعة… إلخ)."
      });
    }

    // ربط مبسط مع آخر التحليلات: عدّ الأسهم عالية المخاطر
    const latest = this.loadLatestAnalyses();
    let highRiskCount = 0;
    for(const it of items){
      const a = latest.get(it.symbol);
      if(!a) continue;
      const trust = Number(a?.trust?.score ?? 0);
      const tag = String(a?.decision?.tag || "");
      if(trust < 50 || tag === "HIGH_RISK" || tag === "AVOID"){
        highRiskCount += 1;
      }
    }
    if(highRiskCount >= 2){
      out.warnings.push({
        level:"MED",
        title:"عدة أسهم عالية المخاطر",
        text:`تم رصد ${highRiskCount} سهم/أسهم ضمن فئة مخاطر highة حسب آخر التحليلات. راجع تبويب "إدارة المخاطر" لكل سهم.`
      });
    }

    return out;
  }
};

window.portfolioGuardEngine = portfolioGuardEngine;window.marketSentinel.portfolioGuardEngine = portfolioGuardEngine;
window.safeEngine.wrap("portfolioGuardEngine");
