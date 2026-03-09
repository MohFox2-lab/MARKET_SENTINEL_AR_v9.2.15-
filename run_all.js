const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('workspace_fix/index.html', 'utf8');

// Extract script sources
const scriptRegex = /<script src="([^"]+)"><\/script>/g;
let match;
const scripts = [];
while ((match = scriptRegex.exec(html)) !== null) {
  scripts.push(match[1]);
}
console.log(scripts);
