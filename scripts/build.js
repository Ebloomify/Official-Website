// 本地构建:渲染 site/index.html + site/products/*.html
'use strict';
const path = require('path');
const { buildSite } = require('../lib/build');

const root = path.join(__dirname, '..');
const written = buildSite({
  dataDir: path.join(root, 'data'),
  templatesDir: path.join(root, 'site', 'templates'),
  outDir: path.join(root, 'site'),
});
for (const f of written) console.log('已生成:', path.relative(root, f));
