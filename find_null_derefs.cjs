const fs = require('fs');

const appJs = fs.readFileSync('workspace_fix/js/app.js', 'utf8');
const indexHtml = fs.readFileSync('workspace_fix/index.html', 'utf8');

// Find all document.getElementById('id') calls
const regex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
const idsInApp = new Set();
let match;

while ((match = regex.exec(appJs)) !== null) {
    idsInApp.add(match[1]);
}

console.log(`Found ${idsInApp.size} unique IDs in app.js`);

const missing = [];
for (const id of idsInApp) {
    if (!indexHtml.includes(`id="${id}"`) && !indexHtml.includes(`id='${id}'`)) {
        missing.push(id);
    }
}

console.log("IDs missing in index.html:", missing);
