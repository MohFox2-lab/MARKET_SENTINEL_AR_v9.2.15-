const fs = require('fs');
const appJs = fs.readFileSync('workspace_fix/js/app.js', 'utf8');
const indexHtml = fs.readFileSync('workspace_fix/index.html', 'utf8');

const idMatches = appJs.match(/getElementById\(['"]([^'"]+)['"]\)/g);
if (idMatches) {
  const ids = [...new Set(idMatches.map(m => m.replace(/getElementById\(['"]([^'"]+)['"]\)/, '$1')))];
  
  const missing = [];
  for (const id of ids) {
    if (!indexHtml.includes(`id="${id}"`) && !indexHtml.includes(`id='${id}'`)) {
      missing.push(id);
    }
  }
  console.log("Missing IDs:", missing);
}
