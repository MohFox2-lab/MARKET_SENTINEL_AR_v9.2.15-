const MS_VERSION = {
    version: "9.2.11",
    last_update: "2026-03-09",
    build_tag: "SHARED_STATE_REPAIR"
};

window.marketSentinel = window.marketSentinel || {
    marketData: null,
    lastAnalysis: null,
    portfolio: [],
    lastScreenerResult: null
};

Object.defineProperties(window, {
    marketData: {
        configurable: true,
        get() { return window.marketSentinel.marketData; },
        set(value) { window.marketSentinel.marketData = value; }
    },
    lastAnalysis: {
        configurable: true,
        get() { return window.marketSentinel.lastAnalysis; },
        set(value) { window.marketSentinel.lastAnalysis = value; }
    }
});

window.safeEngine = window.safeEngine || {
    wrap(engineName, fallbackValue = { status: "error", message: "Engine failed safely" }) {
        const engine = window[engineName];
        if (!engine || typeof engine !== "object" || engine.__safeWrapped) return engine;

        Object.keys(engine).forEach((key) => {
            const original = engine[key];
            if (typeof original !== "function") return;
            engine[key] = function safeWrappedEngineMethod(...args) {
                try {
                    return original.apply(this, args);
                } catch (error) {
                    console.error(`[${engineName}.${key}]`, error);
                    return { ...fallbackValue };
                }
            };
        });

        Object.defineProperty(engine, "__safeWrapped", {
            value: true,
            enumerable: false,
            configurable: false
        });

        return engine;
    }
};
