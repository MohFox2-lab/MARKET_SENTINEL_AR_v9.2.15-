const fs = require('fs');
const glob = require('fs').readdirSync;
const indexHtml = fs.readFileSync('workspace_fix/index.html', 'utf8');

const jsFiles = [
  'workspace_fix/js/app.js',
  'workspace_fix/js/ui.js',
  'workspace_fix/js/advancedUI.js',
  'workspace_fix/js/v5UI.js',
  'workspace_fix/js/screenerUI.js',
  'workspace_fix/js/portfolioUI.js',
  'workspace_fix/js/portfolioWatch.js'
];

for (const file of jsFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  
  // Find all document.getElementById('id').addEventListener
  const regex = /document\.getElementById\(['"]([^'"]+)['"]\)\.addEventListener/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const id = match[1];
    if (!indexHtml.includes(`id="${id}"`) && !indexHtml.includes(`id='${id}'`)) {
      console.log(`File ${file} has dangerous addEventListener on missing ID: ${id}`);
    }
  }
}
