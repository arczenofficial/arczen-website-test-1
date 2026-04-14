import fs from 'fs';
const html = fs.readFileSync('E:/Nobho/Arczen/TempZip/ArcZen/index.html', 'utf8');
const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>', styleStart);
const css = html.substring(styleStart + 7, styleEnd);

// Write to global.css
fs.writeFileSync('E:/Nobho/Arczen/ArcZen/Website/public-site/src/styles/global.css', css);
console.log('CSS extracted.');
