// 极简模板渲染器
// 语法: [[field]] 转义输出 · [[&field]] 原样输出HTML · [[this]] 当前循环项
//       [[#if field]]...[[/if]] · [[#each list]]...[[/each]]
// 用 [[ ]] 而不用 {{ }} 是为了避开页面里 dc-runtime 自带的 {{ }} 模板。

'use strict';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lookup(ctx, key) {
  if (key === 'this') return ctx.this !== undefined ? ctx.this : ctx;
  let cur = ctx;
  for (const part of key.split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  return !!v;
}

function render(template, data) {
  let out = template;

  // 先处理块级标签(if / each),用递归解析嵌套
  out = renderBlocks(out, data);

  // 再处理简单占位符
  out = out.replace(/\[\[(&?)([\w.]+)\]\]/g, (m, raw, key) => {
    const v = lookup(data, key);
    if (v === undefined || v === null) return '';
    return raw ? String(v) : escapeHtml(v);
  });

  return out;
}

function findBlock(str, tag, name, from) {
  // 找到与 [[#tag name]] 匹配的 [[/tag]](支持同名嵌套)
  const open = `[[#${tag} ${name}]]`;
  const openAny = new RegExp(`\\[\\[#${tag} [\\w.]+\\]\\]`, 'g');
  const close = `[[/${tag}]]`;
  const start = str.indexOf(open, from);
  if (start === -1) return null;
  let depth = 1;
  let pos = start + open.length;
  while (depth > 0) {
    const nextClose = str.indexOf(close, pos);
    if (nextClose === -1) return null;
    openAny.lastIndex = pos;
    const nextOpen = openAny.exec(str);
    if (nextOpen && nextOpen.index < nextClose) {
      depth++;
      pos = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      pos = nextClose + close.length;
    }
  }
  return { start, innerStart: start + open.length, innerEnd: pos - close.length, end: pos };
}

function renderBlocks(str, data) {
  // each
  let m;
  const eachRe = /\[\[#each ([\w.]+)\]\]/;
  while ((m = eachRe.exec(str))) {
    const block = findBlock(str, 'each', m[1], m.index);
    if (!block) break;
    const list = lookup(data, m[1]);
    const inner = str.slice(block.innerStart, block.innerEnd);
    let rendered = '';
    if (Array.isArray(list)) {
      for (const item of list) {
        const scope = (item && typeof item === 'object' && !Array.isArray(item))
          ? { ...data, ...item, this: item }
          : { ...data, this: item };
        rendered += render(inner, scope);
      }
    }
    str = str.slice(0, block.start) + rendered + str.slice(block.end);
  }

  // if
  const ifRe = /\[\[#if ([\w.]+)\]\]/;
  while ((m = ifRe.exec(str))) {
    const block = findBlock(str, 'if', m[1], m.index);
    if (!block) break;
    const v = lookup(data, m[1]);
    const inner = str.slice(block.innerStart, block.innerEnd);
    const rendered = truthy(v) ? renderBlocks(inner, data) : '';
    str = str.slice(0, block.start) + rendered + str.slice(block.end);
  }

  return str;
}

module.exports = { render, escapeHtml };
