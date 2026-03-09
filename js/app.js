window.marketSentinel = window.marketSentinel || {};
window.marketSentinel.marketData = null;
window.lastAnalysis = window.lastAnalysis || null;
window.analysisResults = window.analysisResults || [];

function persistSharedAnalyses() {
    try {
        localStorage.setItem("MS_LAST_ANALYSES", JSON.stringify(window.analysisResults || []));
    } catch(e) {}
}

function syncSharedAnalysisState(analysis) {
    if(!analysis || !analysis.symbol) return;
    window.lastAnalysis = analysis;
    window.analysisResults = Array.isArray(window.analysisResults) ? window.analysisResults : [];
    const symbol = String(analysis.symbol);
    const filtered = window.analysisResults.filter(item => String((item && item.symbol) || '') !== symbol);
    filtered.push(analysis);
    window.analysisResults = filtered;
    persistSharedAnalyses();
}

// Render specific tab from shared state
function renderTabContent(tabId, analysis) {
    if(!analysis) return;

    switch(tabId) {
        case 'view-details':
            renderStockDetails(analysis);
            break;
        case 'view-dashboard':
        case 'view-data':
        case 'view-screener':
            break;
        case 'view-fundamentals':
            try { if(window.advancedUI && advancedUI.renderFundamentals) advancedUI.renderFundamentals(analysis); } catch(e){}
            break;
        case 'view-alerts':
            try { if(window.advancedUI && advancedUI.renderAlerts) advancedUI.renderAlerts(analysis); } catch(e){}
            break;
        case 'view-smart-money-pro':
        case 'view-smartmoneypro':
            try { if(window.advancedUI) advancedUI.renderSmartMoneyPro(analysis); } catch(e){}
            break;
        case 'view-radar':
            break;
        case 'view-sentiment':
            try { if(window.advancedUI && advancedUI.renderSentiment) advancedUI.renderSentiment(analysis); } catch(e){}
            break;
        case 'view-earnings':
            try { if(window.advancedUI && advancedUI.renderEarnings) advancedUI.renderEarnings(analysis); } catch(e){}
            break;
        case 'view-hype':
            try { if(window.advancedUI && advancedUI.renderHype) advancedUI.renderHype(analysis); } catch(e){}
            break;
        case 'view-controls':
        case 'view-riskcontrols':
            try { if(window.advancedUI) advancedUI.renderRiskControls(analysis); } catch(e){}
            break;
        case 'view-liquidity-trap':
        case 'view-liquiditytrap':
            try { if(window.advancedUI) advancedUI.renderLiquidityTrap(analysis); } catch(e){}
            break;
        case 'view-portfolioRadar':
            try { if(window.advancedUI) advancedUI.renderPortfolioRadar(window.analysisResults); } catch(e){}
            break;
    }
}

// Update all modules after successful analysis
function refreshAllModules(analysis) {
    if(!analysis) return;
    syncSharedAnalysisState(analysis);
    console.log("📊 Refreshing all modules with:", analysis.symbol);

    try {
        if(window.advancedUI) {
            advancedUI.renderSmartMoneyPro(analysis);
            advancedUI.renderRiskControls(analysis);
            advancedUI.renderLiquidityTrap(analysis);
            if(advancedUI.renderPortfolioRadar) advancedUI.renderPortfolioRadar(window.analysisResults);
        }
    } catch(e) {
        console.error("❌ Error refreshing modules:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version-badge').textContent = `v${MS_VERSION.version} • ${MS_VERSION.build_tag}`;
    const clearAllButton = document.getElementById('dashboard-clear-all');
    if(clearAllButton){
        clearAllButton.addEventListener('click', () => {
            if(confirm('هل تريد مسح جميع الأسهم المحللة من لوحة المتابعة؟')){
                clearArchiveAll();
            }
        });
    }
    
    // Tab switching — render from shared state
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            if(!target) return;
            ui.switchTab(target);

            if(window.lastAnalysis){
                renderTabContent(target, window.lastAnalysis);
            }
        });
    });

    // File رفع
    document.getElementById('file-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        try {
            const rows = await dataEngine.loadFromFile(file);
            let symbol = document.getElementById('symbol-input').value.trim() || file.name.split('.')[0];
            setMarketData({ symbol, source: "CSV رفع", rows });
            ui.showToast("تم تحميل البيانات بنجاح", "success");
        } catch(err) {
            ui.showToast(err.message, "error");
        }
    });

    // لصق CSV
    document.getElementById('btn-parse-paste').addEventListener('click', () => {
        const text = document.getElementById('csv-paste').value;
        if(!text.trim()) {
            ui.showToast("يرجى لصق البيانات أولاً", "error");
            return;
        }
        try {
            const rows = dataEngine.parseCSV(text);
            let symbol = document.getElementById('symbol-input').value.trim() || "PASTED_DATA";
            setMarketData({ symbol, source: "Text لصق", rows });
            ui.showToast("تم تحميل البيانات بنجاح", "success");
        } catch(err) {
            ui.showToast(err.message, "error");
        }
    });

    // Sample البيانات
    document.getElementById('btn-load-sample').addEventListener('click', async () => {
        const file = document.getElementById('sample-select').value;
        try {
            const res = await fetch(file);
            if(!res.ok) throw new Error("لم يتم العثور على العينة");
            const text = await res.text();
            const rows = dataEngine.parseCSV(text);
            const symbol = file.includes('2222') ? '2222.SR' : 'AAPL';
            document.getElementById('symbol-input').value = symbol;
            setMarketData({ symbol, source: "Sample", rows });
            ui.showToast("تم تحميل العينة بنجاح", "success");
        } catch(err) {
            ui.showToast(err.message, "error");
        }
    });

    // Run Analysis
    document.getElementById('btn-run-analysis').addEventListener('click', async () => {
        if(!window.marketSentinel.marketData) return;
        
        // Update symbol if changed
        const newSym = document.getElementById('symbol-input').value.trim();
        if(newSym) window.marketSentinel.marketData.symbol = newSym;
        
        ui.showLoading(true);
        setTimeout(async () => {
            try {
                // تحميل مؤشرات مرجعية للسياق العالمي (اختياري)
                try {
                    const sym = window.marketSentinel.marketData.symbol;
                    const want = (window.crossMarketEngine ? crossMarketEngine.guessBenchmarks(sym) : []);
                    const bmMap = {};
                    for(const bm of want){
                        try {
                            const chart = await window.fetchEngine.fetchYahooChart({ symbol: bm, range: '6mo', interval: '1d' });
                            bmMap[bm] = window.fetchEngine.yahooToRows(chart);
                        } catch(e) {}
                    }
                    if(Object.keys(bmMap).length){
                        window.marketSentinel.marketData.benchmarks = bmMap;
                    }
                } catch(e) {}

                window.lastAnalysis = analysisEngine.run(window.marketSentinel.marketData);
                syncSharedAnalysisState(window.lastAnalysis);
                renderStockDetails(window.lastAnalysis);
                refreshAllModules(window.lastAnalysis);
                document.getElementById('tab-details').classList.remove('hidden');
                ui.switchTab('view-details');
                ui.showToast("تم التحليل بنجاح", "success");

                const archiveRaw = storage.loadData(storage.keys.ARCHIVE) || [];
                const archive = normalizeArchive(archiveRaw);
                const newItem = { id: `${window.marketSentinel.marketData.symbol}_${Date.now()}`, symbol: window.marketSentinel.marketData.symbol, date: new Date().toISOString(), score: window.lastAnalysis.trust.score };
                archive.push(newItem);
                storage.saveData(storage.keys.ARCHIVE, archive);
                renderDashboard();
                
            } catch(err) {
                ui.showToast(err.message, "error");
                console.error(err);
            }
            ui.showLoading(false);
        }, 800); // Fake delay for UX
    });
    
    // إعادة ضبط
    document.getElementById('btn-reset').addEventListener('click', () => {
        window.marketSentinel.marketData = null;
        window.lastAnalysis = null;
        document.getElementById('data-summary').textContent = "لم يتم تحميل أي بيانات";
        document.getElementById('btn-run-analysis').disabled = true;
        document.getElementById('tab-details').classList.add('hidden');
        document.getElementById('file-upload').value = '';
        document.getElementById('csv-paste').value = '';
        ui.switchTab('view-dashboard');
        ui.showToast("تم إعادة الضبط", "info");
    });
    
    // الفرز الذكي tab
    if (window.screenerUI && typeof window.screenerUI.init === 'function') {
        window.screenerUI.init();
    }

    // حفظ/تصدير + History
    bindSaveExportButtons();
    renderHistory();

    // اختبار ضغط المحفظة Test
    if (window.portfolioUI && typeof window.portfolioUI.init === 'function') {
        window.portfolioUI.init();
    }

    // تفاصيل السهم Subtabs (داخل التحليل والتفاصيل)
    initStockDetailsSubtabs();

// بروكسي جلب (ياهو via Cloudflare عامل (Worker))
    try {
        const proxyInput = document.getElementById('proxy-url');
        const saveProxyButton = document.getElementById('btn-save-proxy');
        const fetchDataButton = document.getElementById('btn-fetch-data');
        const fetchStatus = document.getElementById('fetch-status');

        if (proxyInput) {
            const saved = (localStorage.getItem('MS_PROXY_URL') || '').trim();
            if (saved) proxyInput.value = saved;
        }

        saveProxyButton && saveProxyButton.addEventListener('click', () => {
            const v = (proxyInput?.value || '').trim().replace(/\/+$/,'');
            if (!v) { ui.showToast("ضع رابط الـ بروكسي أولاً", "error"); return; }
            localStorage.setItem('MS_PROXY_URL', v);
            ui.showToast("تم حفظ رابط الـ بروكسي", "success");
        });

        fetchDataButton && fetchDataButton.addEventListener('click', async () => {
            const symbol = (document.getElementById('fetch-symbol')?.value || '').trim();
            const range = (document.getElementById('fetch-range')?.value || '6mo').trim();
            const interval = (document.getElementById('fetch-interval')?.value || '1d').trim();

            if (fetchStatus) fetchStatus.textContent = "جارِ جلب البيانات...";
            try {
                const chart = await window.fetchEngine.fetchYahooChart({ symbol, range, interval });
                const rows = window.fetchEngine.yahooToRows(chart);

                setMarketData({ symbol, source: `ياهو via بروكسي (${range}/${interval})`, rows });
                ui.showToast("تم جلب البيانات وتحميلها", "success");
                if (fetchStatus) fetchStatus.textContent = `تم ✅ (${rows.length} صف)`;
            } catch (err) {
                console.error(err);
                ui.showToast(err.message || "فشل جلب البيانات", "error");
                if (fetchStatus) fetchStatus.textContent = "فشل الجلب. تحقق من بروكسي URL والرمز.";
            }
        });
    } catch (e) {
        // ignore
    }



    // ✅ لوحة المتابعة Quick حلّل (Universal symbol Box)
    try {
        const goDataButton = document.getElementById('dashboard-btn-go-data');
        const analyzeButton = document.getElementById('dashboard-btn-analyze');
        const symInput = document.getElementById('dashboard-symbol-input');
        const rangeSel = document.getElementById('dashboard-range');

        goDataButton && goDataButton.addEventListener('click', () => ui.switchTab('view-data'));

        const runFromDashboard = async () => {
            const raw = (symInput?.value || '').trim();
            const symbol = normalizeSymbol(raw);
            if (!symbol) { ui.showToast("اكتب symbol أولاً", "error"); return; }

            const proxy = (window.fetchEngine && window.fetchEngine.getProxyUrl) ? window.fetchEngine.getProxyUrl() : '';
            if (!proxy) {
                ui.showToast("لم يتم ضبط بروكسي للجلب. انتقل إلى (البيانات والإعدادات) واضبط بروكسي أو ارفع CSV.", "error");
                ui.switchTab('view-data');
                refreshAllModules(window.lastAnalysis);
                const si = document.getElementById('symbol-input');
                if (si) si.value = symbol;
                return;
            }

            ui.showLoading(true);
            try {
                const range = (rangeSel?.value || '6mo').trim();
                const chart = await window.fetchEngine.fetchYahooChart({ symbol, range, interval: '1d' });
                const rows = window.fetchEngine.yahooToRows(chart);
                setMarketData({ symbol, source: `ياهو via بروكسي (${range}/1d)`, rows });

                // Run analysis immediately
                // تحميل مؤشرات مرجعية للسياق العالمي (اختياري)
                try {
                    const sym = window.marketSentinel.marketData.symbol;
                    const want = (window.crossMarketEngine ? crossMarketEngine.guessBenchmarks(sym) : []);
                    const bmMap = {};
                    for(const bm of want){
                        try {
                            const chart = await window.fetchEngine.fetchYahooChart({ symbol: bm, range: '6mo', interval: '1d' });
                            bmMap[bm] = window.fetchEngine.yahooToRows(chart);
                        } catch(e) {}
                    }
                    if(Object.keys(bmMap).length){
                        window.marketSentinel.marketData.benchmarks = bmMap;
                    }
                } catch(e) {}

                window.lastAnalysis = analysisEngine.run(window.marketSentinel.marketData);
                syncSharedAnalysisState(window.lastAnalysis);
                renderStockDetails(window.lastAnalysis);
                refreshAllModules(window.lastAnalysis);
                document.getElementById('tab-details').classList.remove('hidden');

                // حفظ to archive + refresh dashboard
                const archiveRaw = storage.loadData(storage.keys.ARCHIVE) || [];
                const archive = normalizeArchive(archiveRaw);
                archive.push({ id: `${window.marketSentinel.marketData.symbol}_${Date.now()}`, symbol: window.marketSentinel.marketData.symbol, date: new Date().toISOString(), score: window.lastAnalysis.trust.score });
                storage.saveData(storage.keys.ARCHIVE, archive);
                renderDashboard();

                ui.switchTab('view-details');
                ui.showToast("تم التحليل بنجاح", "success");
            } catch (err) {
                console.error(err);
                ui.showToast(err.message || "فشل التحليل", "error");
            } finally {
                ui.showLoading(false);
            }
        };

        analyzeButton && analyzeButton.addEventListener('click', runFromDashboard);
        symInput && symInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runFromDashboard(); });
    } catch(e) { /* ignore */ }


    renderDashboard();
});


// ===============================
// يدوي Layers UI (Static)
// اتجاه الأرباح + Sector Compare + كاشف الضجيج
// ===============================
document.addEventListener('DOMContentLoaded', () => {
    try {
        const elEarn = document.getElementById('ml-earnings');
        const elSec  = document.getElementById('ml-sector');
        const elDelta= document.getElementById('ml-sector-delta');
        const elHype = document.getElementById('ml-hype');
        const elNews = document.getElementById('ml-news');

        const loadButton = document.getElementById('btn-ml-load');
        const saveButton = document.getElementById('btn-ml-save');
        const clearButton= document.getElementById('btn-ml-clear');

        const currentsymbol = () => {
            const s1 = (document.getElementById('symbol-input')?.value || '').trim();
            const s2 = (window.marketSentinel.marketData?.symbol || '').trim();
            return (s1 || s2 || '').toUpperCase();
        };

        const fillForm = (manual) => {
            const m = manual || {};
            if (elEarn) elEarn.value = String(m?.earnings?.mode || 'unknown');
            if (elSec) elSec.value = String(m?.sector?.name || '');
            if (elDelta) elDelta.value = (m?.sector?.valuation_delta_pct ?? '');
            if (elHype) elHype.value = (m?.sentiment?.hype_score ?? '');
            if (elNews) elNews.value = (m?.sentiment?.news_severity ?? '');
        };

        loadButton && loadButton.addEventListener('click', () => {
            const sym = currentsymbol();
            if (!sym) { ui.showToast('اكتب symbol أولاً', 'error'); return; }
            const manual = storage.loadManual(sym);
            fillForm(manual);
            ui.showToast('تم تحميل القيم (إن وجدت)', 'info');
        });

        saveButton && saveButton.addEventListener('click', () => {
            const sym = currentsymbol();
            if (!sym) { ui.showToast('اكتب symbol أولاً', 'error'); return; }
            const payload = {
                earnings: { mode: String(elEarn?.value || 'unknown') },
                sector: {
                    name: String(elSec?.value || ''),
                    valuation_delta_pct: (elDelta?.value === '' ? null : Number(elDelta?.value))
                },
                sentiment: {
                    hype_score: (elHype?.value === '' ? null : Number(elHype?.value)),
                    news_severity: (elNews?.value === '' ? null : Number(elNews?.value))
                }
            };
            storage.saveManual(sym, payload);
            ui.showToast('تم حفظ الطبقات المتقدمة لهذا السهم', 'success');
        });

        clearButton && clearButton.addEventListener('click', () => {
            const sym = currentsymbol();
            if (!sym) { ui.showToast('اكتب symbol أولاً', 'error'); return; }
            storage.clearManual(sym);
            fillForm(null);
            ui.showToast('تم مسح القيم لهذا السهم', 'success');
        });
    } catch(e) {
        // ignore
    }
});


// Normalize symbol input (US + SA)
// - "2222" => "2222.SR"
// - "tasi:2222" => "2222.SR"
// - keep "AAPL", "2222.SR" as-is
function normalizeSymbol(raw) {
    let s = String(raw || "").trim().toUpperCase();
    s = s.replace(/\s+/g, "");
    if (!s) return "";
    if (s.includes(":")) {
        const parts = s.split(":").filter(Boolean);
        s = parts[parts.length - 1] || s;
    }
    if (/^\d{3,5}$/.test(s)) return `${s}.SR`;
    return s;
}

function setMarketData(data) {
    window.marketSentinel.marketData = data;
    const summary = document.getElementById('data-summary');
    summary.innerHTML = `
        <div class="font-bold text-lg text-gray-800">${data.symbol}</div>
        <div class="text-sm">المصدر: ${data.source}</div>
        <div class="text-sm">عدد الأيام: ${data.rows.length}</div>
        <div class="text-xs mt-2 text-gray-400">من ${data.rows[0].date} إلى ${data.rows[data.rows.length-1].date}</div>
    `;
    document.getElementById('btn-run-analysis').disabled = false;
    document.getElementById('breadcrumb').classList.remove('hidden');
    document.getElementById('breadcrumb').innerHTML = `<b>${data.symbol}</b> &bull; ${data.source} &bull; ${data.rows.length} أيام`;
}

function renderStockDetails(analysis) {
    document.getElementById('detail-symbol').textContent = analysis.symbol;
    document.getElementById('detail-meta').textContent = `${analysis.source} • ${analysis.range} • ${analysis.meta.lastDate}`;
    
    // Trust score
    document.getElementById('trust-score-val').textContent = analysis.trust.score;
    document.getElementById('trust-score-val').className = `text-4xl font-bold ${analysis.trust.score >= 75 ? 'text-success' : analysis.trust.score >= 50 ? 'text-warning' : 'text-danger'}`;
    document.getElementById('trust-light').textContent = analysis.trust.light;
    
    // القرار Support
    const decision = analysis.decision || decisionEngine.getDecision(analysis);
    document.getElementById('decision-label').textContent = decision.label;
    document.getElementById('decision-card').className = `bg-white p-6 rounded-xl shadow-sm border-2 ${decision.colorClass}`;
    
    const reasonsContainer = document.getElementById('decision-reasons');
    reasonsContainer.innerHTML = decision.reasons.map(r => `<div class="flex items-center gap-2"><span class="text-accent">•</span> ${r}</div>`).join('');
    
    // Context & Engines
    document.getElementById('ctx-regime').textContent = analysis.context.regime;
    document.getElementById('liq-grade').textContent = `Grade ${analysis.liquidity.grade}`;
    document.getElementById('sm-state').textContent = analysis.smartMoney.state;

    // Indicators (new)
    try {
        const ind = analysis.indicators || {};
        const rsi = ind.rsi;
        const bbPos = ind.bb && ind.bb.pos != null ? ind.bb.pos : null;
        const macd = ind.macd || {};
        const volRatio = ind.volRatio;
        const mfi = ind.mfi;
        const cmf = ind.cmf;

        const elRsi = document.getElementById("ind-rsi");
        if (elRsi) elRsi.textContent = (rsi == null ? "-" : rsi.toFixed(1));

        const elBb = document.getElementById("ind-bbpos");
        if (elBb) elBb.textContent = (bbPos == null ? "-" : bbPos.toFixed(2));

        const elMacd = document.getElementById("ind-macd");
        if (elMacd) {
            const m = (macd.macd == null ? "-" : macd.macd.toFixed(3));
            const s = (macd.signal == null ? "-" : macd.signal.toFixed(3));
            const h = (macd.hist == null ? "-" : macd.hist.toFixed(3));
            elMacd.textContent = `${m} / ${s} / ${h}`;
        }

        const elVr = document.getElementById("ind-volratio");
        if (elVr) elVr.textContent = (volRatio == null ? "-" : volRatio.toFixed(2));

        const elMfi = document.getElementById("ind-mfi");
        if (elMfi) elMfi.textContent = (mfi == null ? "-" : mfi.toFixed(1));

        const elCmf = document.getElementById("ind-cmf");
        if (elCmf) elCmf.textContent = (cmf == null ? "-" : cmf.toFixed(2));
    } catch(e) {
        // ignore
    }

    
    // التنبيهات
    const alertsContainer = document.getElementById('alerts-container');
    if(analysis.alerts.length === 0) {
        alertsContainer.innerHTML = `<div class="text-success text-sm p-3 bg-green-50 rounded">لا توجد تنبيهات مخاطر عالية الحالية.</div>`;
    } else {
        alertsContainer.innerHTML = analysis.alerts.map(a => `
            <div class="p-3 rounded border-l-4 ${a.level === 'HIGH' ? 'bg-red-50 border-danger text-red-800' : 'bg-yellow-50 border-warning text-yellow-800'}">
                <div class="font-bold text-sm flex justify-between">
                    <span>${a.title}</span>
                    <span class="text-xs bg-white px-2 py-0.5 rounded opacity-80">${a.level}</span>
                </div>
                <div class="text-xs mt-1 opacity-90">${a.why}</div>
            </div>
        `).join('');
    }
    
    // Chart
    chartEngine.render('priceChart', window.marketSentinel.marketData, analysis);

    // Advanced sections
    try { if(window.advancedUI){ advancedUI.renderSmartMoneyPro(analysis); advancedUI.renderRiskControls(analysis); advancedUI.renderLiquidityTrap(analysis); if(advancedUI.renderPortfolioRadar) advancedUI.renderPortfolioRadar(window.analysisResults); } } catch(e){}
}


function normalizeArchive(archive) {
    if(!Array.isArray(archive)) return [];
    let changed = false;
    archive.forEach(item => {
        if(!item) return;
        if(!item.id){
            item.id = `${item.symbol || 'SYM'}_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
            changed = true;
        }
    });
    if(changed){
        try { storage.saveData(storage.keys.ARCHIVE, archive); } catch(e){}
    }
    return archive;
}

function deleteArchiveItemById(id){
    const archiveRaw = storage.loadData(storage.keys.ARCHIVE) || [];
    const archive = normalizeArchive(archiveRaw);
    const filtered = archive.filter(it => (it && it.id) ? it.id !== id : true);
    storage.saveData(storage.keys.ARCHIVE, filtered);
    renderDashboard();
    ui.showToast("تم حذف السهم من لوحة المتابعة", "success");
}

function clearArchiveAll(){
    storage.saveData(storage.keys.ARCHIVE, []);
    renderDashboard();
    ui.showToast("تم مسح جميع الأسهم المحللة", "success");
}

function renderDashboard() {
    const archiveRaw = storage.loadData(storage.keys.ARCHIVE) || [];
    const archive = normalizeArchive(archiveRaw);
    const container = document.getElementById('dashboard-cards');
    
    if(archive.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
                <p class="mb-4">لا توجد بيانات محللة حالياً</p>
                <button class="bg-primary text-white px-4 py-2 rounded-lg" onclick="ui.switchTab('view-data')">ابدأ برفع بيانات</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = archive.reverse().slice(0, 6).map(item => `
        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-center mb-3">
                <div>
                    <h3 class="font-bold text-lg text-gray-800">${item.symbol}</h3>
                    <span class="text-xs text-gray-400">${new Date(item.date).toLocaleDateString()}</span>
                </div>
                <button class="text-gray-400 hover:text-danger text-xl leading-none" title="حذف" onclick="deleteArchiveItemById('${item.id}')">×</button>
            </div>
            <div class="flex items-center gap-3 mt-4">
                <div class="text-2xl font-bold ${item.score >= 75 ? 'text-success' : item.score >= 50 ? 'text-warning' : 'text-danger'}">${item.score}</div>
                <div class="text-sm text-gray-500">درجة الثقة</div>
            </div>
        </div>
    `).join('');
}


// ===============================
// حفظ / تصدير + Analysis History (max 50)
// ===============================
const HISTORY_KEY = "msar_analysis_history_v1";

function getHistory(){
    try{
        const raw = localStorage.getItem(HISTORY_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    }catch(e){
        return [];
    }
}
function setHistory(arr){
    try{
        localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0,50)));
    }catch(e){}
}
function pushHistory(analysis){
    const arr = getHistory();
    const item = {
        id: `${analysis.symbol}_${Date.now()}`,
        ts: Date.now(),
        symbol: analysis.symbol,
        range: analysis.range,
        trust: analysis.trust?.score ?? null,
        light: analysis.trust?.light ?? "",
        data: analysis
    };
    arr.unshift(item);
    setHistory(arr.slice(0,50));
}
function downloadJSON(obj, filename){
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function renderHistory(){
    const container = document.getElementById("analysisHistory");
    if(!container) return;

    const arr = getHistory();
    if(!arr.length){
        container.innerHTML = `<div class="text-sm text-gray-500">لا يوجد سجل محفوظ بعد.</div>`;
        return;
    }

    container.innerHTML = `
      <div class="overflow-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-gray-600">
              <th class="text-right p-2">التاريخ</th>
              <th class="text-right p-2">السهم</th>
              <th class="text-right p-2">Trust</th>
              <th class="text-right p-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${arr.map(item => {
                const d = new Date(item.ts);
                const dt = d.toLocaleString('ar-SA');
                return `
                  <tr class="border-t">
                    <td class="p-2">${dt}</td>
                    <td class="p-2 font-bold" dir="ltr">${item.symbol}</td>
                    <td class="p-2" dir="ltr">${item.trust ?? "-"}</td>
                    <td class="p-2">
                      <button class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200" data-act="load" data-id="${item.id}">فتح</button>
                      <button class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200" data-act="dl" data-id="${item.id}">JSON</button>
                      <button class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200" data-act="del" data-id="${item.id}">حذف</button>
                    </td>
                  </tr>
                `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

    // bind actions
    container.querySelectorAll("button[data-act]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            const act = btn.getAttribute("data-act");
            const id = btn.getAttribute("data-id");
            const arr2 = getHistory();
            const idx = arr2.findIndex(x=>x.id===id);
            if(idx<0) return;

            if(act==="del"){
                arr2.splice(idx,1);
                setHistory(arr2);
                renderHistory();
                ui.showToast("تم الحذف", "success");
            } else if(act==="dl"){
                downloadJSON(arr2[idx].data, `${arr2[idx].symbol}_analysis.json`);
            } else if(act==="load"){
                const a = arr2[idx].data;
                syncSharedAnalysisState(a);
                document.getElementById('tab-details').classList.remove('hidden');
                renderStockDetails(a);
                refreshAllModules(a);
                if (window.marketSentinel.marketData) { chartEngine.render('priceChart', window.marketSentinel.marketData, a); }
                ui.switchTab('view-details');
                ui.showToast("تم فتح التحليل من السجل", "success");
            }
        });
    });
}

function bindSaveExportButtons(){
    const saveButton = document.getElementById("saveAnalysisButton");
    const btnExport = document.getElementById("btnExportAnalysis");
    const clearButton = document.getElementById("btnClearHistory");

    if(saveButton){
        saveButton.addEventListener("click", ()=>{
            if(!window.lastAnalysis){ ui.showToast("لا يوجد تحليل لحفظه", "error"); return; }
            pushHistory(window.lastAnalysis);
            renderHistory();
            ui.showToast("تم حفظ التحليل", "success");
        });
    }
    if(btnExport){
        btnExport.addEventListener("click", ()=>{
            if(!window.lastAnalysis){ ui.showToast("لا يوجد تحليل لتصديره", "error"); return; }
            downloadJSON(window.lastAnalysis, `${window.lastAnalysis.symbol}_analysis.json`);
        });
    }
    if(clearButton){
        clearButton.addEventListener("click", ()=>{
            localStorage.removeItem(HISTORY_KEY);
            renderHistory();
            ui.showToast("تم مسح السجل", "success");
        });
    }
}


function initStockDetailsSubtabs(){
    const bar = document.getElementById("details-subtabs");
    if(!bar) return;

    function show(id){
        document.querySelectorAll(".details-section").forEach(s=>{
            if(s.id === id) s.classList.remove("hidden");
            else s.classList.add("hidden");
        });

        bar.querySelectorAll("button[data-sub]").forEach(b=>{
            const active = b.getAttribute("data-sub") === id;
            b.classList.toggle("bg-gray-900", active);
            b.classList.toggle("text-white", active);
        });
    }

    bar.addEventListener("click", (e)=>{
        const btn = e.target.closest("button[data-sub]");
        if(!btn) return;
        show(btn.getAttribute("data-sub"));
    });

    show("d-decision");
}



// إعادة رسم رادار المحفظة عند فتح الصفحة
try{
  document.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest ? e.target.closest(".tab-btn") : null;
    if(!btn) return;
    const t = btn.getAttribute("data-target");
    if(t === "view-portfolioRadar"){
      setTimeout(()=>{ try{ if(window.advancedUI) advancedUI.renderPortfolioRadar(); } catch(e){} }, 50);
    }
  });
}catch(e){}


// إعادة رسم صفحة إدارة المخاطر عند فتحها
try{
  document.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest ? e.target.closest(".tab-btn") : null;
    if(!btn) return;
    const t = btn.getAttribute("data-target");
    if(t === "view-riskcontrols"){
      setTimeout(()=>{ try{ if(window.advancedUI && window.lastAnalysis) advancedUI.renderRiskControls(window.lastAnalysis); } catch(e){} }, 50);
    }
  });
}catch(e){}

// إعادة رسم صفحة فخ السيولة عند فتحها
try{
  document.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest ? e.target.closest(".tab-btn") : null;
    if(!btn) return;
    const t = btn.getAttribute("data-target");
    if(t === "view-liquiditytrap"){
      setTimeout(()=>{ try{ if(window.advancedUI && window.lastAnalysis) advancedUI.renderLiquidityTrap(window.lastAnalysis); } catch(e){} }, 50);
    }
  });
}catch(e){}


window.appActions = window.appActions || {};

window.appActions.quickAnalyze = async function(symbol){
  const sym = (window.fetchLiveEngine ? fetchLiveEngine.normalizeSymbol(symbol) : String(symbol||"").trim().toUpperCase());
  if(!sym) return;

  try{
    if(window.advancedUI && advancedUI.renderFetchLiveStatus){
      advancedUI.renderFetchLiveStatus(`جارِ جلب بيانات ${sym}...`, "info");
    }

    const rangeEl = document.getElementById("fetchlive-range");
    const intervalEl = document.getElementById("fetchlive-interval");
    const range = rangeEl ? rangeEl.value : "6mo";
    const interval = intervalEl ? intervalEl.value : "1d";

    const chart = await fetchLiveEngine.fetchChart(sym, range, interval);
    const rows = fetchLiveEngine.yahooToRows(chart);

    window.marketData = {
      symbol: sym,
      source: `Yahoo Live (${range}/${interval})`,
      rows,
      meta: { timestamp: new Date().toISOString() }
    };
    window.marketSentinel.marketData = window.marketData;

    const mainSym = document.getElementById("symbol-input");
    if(mainSym) mainSym.value = sym;

    if(window.analysisEngine && typeof analysisEngine.run === "function"){
      window.lastAnalysis = analysisEngine.run(window.marketData);
                refreshAllModules(window.lastAnalysis);

      if(typeof renderStockDetails === "function"){
        renderStockDetails(window.lastAnalysis);
      } else if(typeof renderDetails === "function"){
        renderDetails(window.lastAnalysis);
      } else if(typeof renderStockDetails === "function"){
        renderStockDetails(window.lastAnalysis);
      }

      try{
        const detailTabBtn = document.getElementById("tab-details");
        if(detailTabBtn){
          detailTabBtn.classList.remove("hidden");
          detailTabBtn.click();
        }
      }catch(e){}

      try{
        if(window.advancedUI && advancedUI.renderFetchLiveStatus){
          advancedUI.renderFetchLiveStatus(`تم جلب وتحليل ${sym} بنجاح.`, "success");
        }
      }catch(e){}
    }else{
      throw new Error("محرك التحليل غير متاح");
    }
  }catch(err){
    try{
      if(window.advancedUI && advancedUI.renderFetchLiveStatus){
        advancedUI.renderFetchLiveStatus(`فشل الجلب: ${err.message}`, "error");
      }
    }catch(e){}
    console.error(err);
    alert(`فشل جلب البيانات المباشرة للسهم ${sym}: ${err.message}`);
  }
};

document.addEventListener("DOMContentLoaded", ()=>{
  const btn = document.getElementById("btn-fetch-live");
  if(btn){
    btn.addEventListener("click", async ()=>{
      const inp = document.getElementById("quick-symbol") || document.getElementById("portfolio-symbol") || document.getElementById("symbol-input");
      const sym = inp ? inp.value : "";
      await window.appActions.quickAnalyze(sym);
    });
  }
});
