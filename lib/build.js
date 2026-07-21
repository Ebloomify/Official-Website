// 站点生成:用 data/*.json + site/templates/*.tpl.html 渲染出最终页面
// 被本地构建脚本和管理后台共同使用。
'use strict';
const fs = require('fs');
const path = require('path');
const { render } = require('./render');

function prepareData(content, products) {
  const pub = products
    .filter(p => p.published !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return {
    ...content,
    hero_line1_words: String(content.hero_line1 || '').split(/\s+/).filter(Boolean),
    hero_line2_words: String(content.hero_line2 || '').split(/\s+/).filter(Boolean),
    contact_address_br: escapeBr(content.contact_address || ''),
    news_items: (content.news || []).map(n => ({
      ...n,
      url: n.url || '#',
      icon: n.icon || 'ti-news',
    })),
    products: pub.map(p => ({
      ...p,
      appstore: p.appstore || '',
      googleplay: p.googleplay || '',
      // 卡片展示图:无视频时取前三张图填充卡片空白
      cardImages: (!p.video && Array.isArray(p.images)) ? p.images.slice(0, 3) : [],
    })),
  };
}

function escapeBr(s) {
  const esc = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 逗号后换行(footer 里地址分两行显示)
  const i = esc.indexOf(', ');
  return i === -1 ? esc : esc.slice(0, i) + '<br>' + esc.slice(i + 2);
}

function prepareProductData(product, content, products) {
  const pub = products.filter(p => p.published !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  const images = (product.images || []).filter(Boolean);
  return {
    ...product,
    appstore: product.appstore && product.appstore !== '#' ? product.appstore : '',
    googleplay: product.googleplay && product.googleplay !== '#' ? product.googleplay : '',
    images,
    mainImage: images[0] || '',
    hasMultipleImages: images.length > 1,
    contact_email: content.contact_email || '',
    contact_address: content.contact_address || '',
    footerProducts: pub.map(p => ({ slug: p.slug, name: p.name })),
  };
}

/**
 * 生成整个站点
 * @param {object} opts { dataDir, templatesDir, outDir }
 * @returns {string[]} 生成的文件列表
 */
function buildSite(opts) {
  const { dataDir, templatesDir, outDir } = opts;
  const content = JSON.parse(fs.readFileSync(path.join(dataDir, 'content.json'), 'utf8'));
  const products = JSON.parse(fs.readFileSync(path.join(dataDir, 'products.json'), 'utf8'));
  const indexTpl = fs.readFileSync(path.join(templatesDir, 'index.tpl.html'), 'utf8');
  const productTpl = fs.readFileSync(path.join(templatesDir, 'product.tpl.html'), 'utf8');

  const written = [];

  // 首页
  const indexHtml = render(indexTpl, prepareData(content, products));
  const indexOut = path.join(outDir, 'index.html');
  fs.writeFileSync(indexOut, indexHtml);
  written.push(indexOut);

  // 产品页
  const prodDir = path.join(outDir, 'products');
  fs.mkdirSync(prodDir, { recursive: true });
  const wanted = new Set();
  for (const p of products.filter(p => p.published !== false)) {
    const pageHtml = render(productTpl, prepareProductData(p, content, products));
    const f = path.join(prodDir, p.slug + '.html');
    fs.writeFileSync(f, pageHtml);
    written.push(f);
    wanted.add(p.slug + '.html');
  }
  // 清掉已删除/下架产品的旧页面
  for (const f of fs.readdirSync(prodDir)) {
    if (f.endsWith('.html') && !wanted.has(f)) {
      fs.unlinkSync(path.join(prodDir, f));
    }
  }

  return written;
}

module.exports = { buildSite, prepareData, prepareProductData };
