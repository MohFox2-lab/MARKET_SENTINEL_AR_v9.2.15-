global.window = {};
global.window.marketSentinel = {};
global.window.safeEngine = { wrap: function(n) { return function() {}; } };

global.contextEngine = { analyze: () => ({regime: 'UPTREND'}) };
global.smartMoneyEngine = { analyze: () => ({state: 'ACCUMULATION'}) };
global.liquidityEngine = { analyze: () => ({grade: 'A'}) };
global.alertsEngine = { generate: () => ([]) };
global.indicators = { snapshot: () => ({}) };

const fs = require('fs');
eval(fs.readFileSync('./js/analysisEngine.js', 'utf8'));

try {
  let result = analysisEngine.run({
    symbol: 'AAPL',
    source: 'test',
    rows: [{date: '2023-01-01'}, {date: '2023-01-02'}, {date: '2023-01-03'}]
  });
  console.log("Analysis Engine run successful", result.trust);
} catch (e) {
  console.error("Error running Analysis Engine:", e);
}
