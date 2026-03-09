const fs = require('fs');
const vm = require('vm');

const scripts = [
  'js/version.js',
  'js/storage.js',
  'js/ui.js',
  'js/screenerUI.js',
  'engines/indicators.js',
  'engines/context.js',
  'engines/smartMoney.js',
  'engines/liquidity.js',
  'engines/alerts.js',
  'engines/screener.js',
  'engines/v5.js',
  'engines/offlineLayers.js',
  'engines/crossMarket.js',
  'engines/sectorHeatmap.js',
  'engines/smartMoneyPro.js',
  'engines/iceberg.js',
  'engines/hypeBubble.js',
  'engines/marketRadar.js',
  'engines/patterns.js',
  'engines/riskTimeline.js',
  'engines/portfolioRadar.js',
  'engines/candlesticks.js',
  'engines/compositeSignals.js',
  'engines/decisionRadar.js',
  'engines/watchlistRadar.js',
  'engines/riskControls.js',
  'engines/portfolioGuard.js',
  'engines/liquidityTrap.js',
  'engines/vwapEngine.js',
  'engines/fakeVolumeEngine.js',
  'engines/globalRiskScore.js',
  'js/dataEngine.js',
  'js/decisionEngine.js',
  'js/advancedUI.js',
  'js/analysisEngine.js',
  'charts/chartEngine.js',
  'js/fetchEngine.js',
  'js/v5UI.js',
  'engines/portfolioStress.js',
  'js/portfolioUI.js',
  'engines/fetchLiveEngine.js',
  'js/app.js',
  'js/portfolioWatch.js'
];

const sandbox = {
  window: {},
  document: {
    addEventListener: () => {},
    getElementById: () => ({ addEventListener: () => {}, classList: { add: ()=>{}, remove: ()=>{} }, textContent: '' }),
    querySelectorAll: () => ([]),
  },
  console: console,
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout: setTimeout,
  Date: Date,
  Math: Math,
  Number: Number,
  String: String,
  Array: Array,
  Object: Object,
  JSON: JSON,
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  isFinite: isFinite,
  parseFloat: parseFloat,
  parseInt: parseInt
};
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.document = sandbox.document;

vm.createContext(sandbox);

for (const script of scripts) {
  try {
    const code = fs.readFileSync(`workspace_fix/${script}`, 'utf8');
    vm.runInContext(code, sandbox, { filename: script });
  } catch (err) {
    console.log(`Error in ${script}:`, err.message);
    console.log(err.stack);
  }
}
console.log('Execution test finished.');
