const storage = {
    keys: {
        ARCHIVE: "MSAR_DATASETS_ARCHIVE_V1",
        LAST_ANALYSIS: "MSAR_LAST_ANALYSIS",
        CURRENT: "MSAR_CURRENT_DATASET",

        // يدوي / غير متصل advanced layers (Static)
        MANUAL_LAYERS: "MSAR_MANUAL_LAYERS_V1"
    },
    saveData: function(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },
    loadData: function(key) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    },
    clearData: function(key) {
        localStorage.removeItem(key);
    },

    // يدوي layers are stored as: { [SYMBOL]: { earnings, sector, sentiment } }
    loadManual: function(symbol) {
        const s = String(symbol || '').trim().toUpperCase();
        const all = this.loadData(this.keys.MANUAL_LAYERS) || {};
        return (all && typeof all === 'object') ? (all[s] || null) : null;
    },
    saveManual: function(symbol, payload) {
        const s = String(symbol || '').trim().toUpperCase();
        if(!s) return;
        const all = this.loadData(this.keys.MANUAL_LAYERS) || {};
        const safe = (payload && typeof payload === 'object') ? payload : {};
        all[s] = { ...safe, _updated_at: new Date().toISOString() };
        this.saveData(this.keys.MANUAL_LAYERS, all);
    },
    clearManual: function(symbol) {
        const s = String(symbol || '').trim().toUpperCase();
        const all = this.loadData(this.keys.MANUAL_LAYERS) || {};
        if(all && typeof all === 'object' && all[s]) {
            delete all[s];
            this.saveData(this.keys.MANUAL_LAYERS, all);
        }
    }
};


window.storage = storage;
window.marketSentinel.storage = storage;
