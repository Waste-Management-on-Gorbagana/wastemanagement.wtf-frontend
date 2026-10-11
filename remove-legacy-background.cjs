// Run from the project root: node remove-legacy-background.cjs
// Only removes the obsolete image from asset-pack arrays and editor display lists.
const fs = require('node:fs'), path = require('node:path');
const key = 'wm-background-1';
let changes = 0;
function clean(value) {
  if (!value || typeof value !== 'object') return;
  for (const name of Object.keys(value)) {
    if (name === 'files' && Array.isArray(value[name])) {
      value[name] = value[name].filter(item => !(item && item.key === key));
    }
    if (name === 'displayList' && Array.isArray(value[name])) {
      value[name] = value[name].filter(item => !(item && item.texture && item.texture.key === key));
    }
    if (Array.isArray(value[name])) value[name].forEach(clean);
    else clean(value[name]);
  }
}
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    if (['node_modules','.git','dist','build'].includes(item.name)) continue;
    const file = path.join(dir,item.name);
    if (item.isDirectory()) walk(file);
    else if (/\.(json|scene)$/.test(item.name)) {
      const source = fs.readFileSync(file,'utf8');
      if (!source.includes(key)) continue;
      let data; try { data = JSON.parse(source); } catch { continue; }
      const before=JSON.stringify(data);
      clean(data);
      if (JSON.stringify(data) !== before) {
        if (!fs.existsSync(file+'.before-background-fix')) fs.copyFileSync(file,file+'.before-background-fix');
        fs.writeFileSync(file,JSON.stringify(data,null,4)+'\n');
        console.log('Cleaned '+file); changes++;
      }
    }
  }
}
for (const dir of ['src','public','assets']) walk(dir);
console.log('Updated '+changes+' asset-pack/editor files. Backups preserved.');
