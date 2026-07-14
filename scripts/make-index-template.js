// 一次性脚本:把 site/source.html(拆包后的首页)转换成 site/templates/index.tpl.html
// 替换策略:精确锚点替换,每一处都断言命中,防止悄悄失败。
'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'site', 'source.html');
const out = path.join(__dirname, '..', 'site', 'templates', 'index.tpl.html');
let html = fs.readFileSync(src, 'utf8');

let step = 0;
function replaceOnce(name, find, replacement) {
  step++;
  const i = html.indexOf(find);
  if (i === -1) throw new Error(`[${step}] 锚点未命中: ${name}`);
  if (html.indexOf(find, i + find.length) !== -1) throw new Error(`[${step}] 锚点不唯一: ${name}`);
  html = html.slice(0, i) + replacement + html.slice(i + find.length);
  console.log(`✅ [${step}] ${name}`);
}
function replaceRange(name, startAnchor, endAnchor, replacement) {
  step++;
  const s = html.indexOf(startAnchor);
  if (s === -1) throw new Error(`[${step}] 起始锚点未命中: ${name}`);
  const e = html.indexOf(endAnchor, s);
  if (e === -1) throw new Error(`[${step}] 结束锚点未命中: ${name}`);
  html = html.slice(0, s) + replacement + html.slice(e + endAnchor.length);
  console.log(`✅ [${step}] ${name}`);
}

// ── 1. head: 补 title / meta description / favicon ──
replaceOnce('head 补充 title 等',
  '<meta name="viewport"',
  `<title>eBloomify — Grow, Connect, Thrive.</title>
  <meta name="description" content="[[hero_sub]]">
  <link rel="icon" type="image/png" href="assets/a6.png">
  <meta name="viewport"`);

// ── 2. hero 标题(逐词动画结构保留) ──
replaceOnce('hero 标题',
  `<span class="eb-word"><span>Grow,</span></span> <span class="eb-word"><span>Connect,</span></span> <span class="eb-word"><span>Thrive.</span></span><br><span class="eb-word"><span>Cultivate</span></span> <span class="eb-word"><span>Your</span></span> <span class="eb-word"><span>Green</span></span> <span class="eb-word"><span>World</span></span>`,
  `[[#each hero_line1_words]]<span class="eb-word"><span>[[this]]</span></span> [[/each]]<br>[[#each hero_line2_words]]<span class="eb-word"><span>[[this]]</span></span> [[/each]]`);

// ── 3. hero 副标题 ──
replaceOnce('hero 副标题',
  'eBloomify builds digital spaces where communities can flourish — from our own apps to custom agentic AI we build for businesses.',
  '[[hero_sub]]');

// ── 4. 产品区标题/副标题 ──
replaceOnce('产品区标题', '>Apps that help communities grow</h2>', '>[[products_heading]]</h2>');
replaceOnce('产品区副标题',
  'We design consumer products with the user at their core — nurturing connection, sharing, and the joy of collaboration.',
  '[[products_sub]]');

// ── 5. 产品卡片 → 循环 ──
const CARD_LOOP = `<div data-stagger="" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;">
[[#each products]]
        <div style="background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:30px;display:flex;flex-direction:column;transition:box-shadow .2s,transform .2s;" style-hover="box-shadow:0 18px 40px -24px rgba(20,30,60,0.25);transform:translateY(-3px)">
          <div style="display:flex;align-items:center;gap:13px;margin-bottom:18px;">
            [[#if icon]]<img src="[[icon]]" alt="[[name]]" style="width:52px;height:52px;border-radius:14px;object-fit:cover;flex:none;display:block;">[[/if]]
            <div>
              <p style="font-weight:600;font-size:19px;margin:0;letter-spacing:-0.01em;">[[name]]</p>
              <p style="font-size:13px;color:var(--color-text-tertiary);margin:2px 0 0;">[[tagline]]</p>
            </div>
          </div>
          <p style="font-size:15px;color:var(--color-text-secondary);line-height:1.6;margin:0 0 20px;">[[intro]]</p>
          [[#if tags]]<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px;">
            [[#each tags]]<span style="font-size:12.5px;color:var(--color-text-secondary);background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-pill);padding:5px 12px;">[[this]]</span>[[/each]]
          </div>[[/if]]
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:auto;">
            [[#if appstore]]<a href="[[appstore]]" style="text-decoration:none;display:inline-flex;align-items:center;gap:7px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:8px 14px;color:var(--color-text-primary);transition:background .15s;" style-hover="background:var(--color-background-tertiary)"><i class="ti ti-brand-apple" style="font-size:18px;"></i><span style="font-size:13px;font-weight:600;">App Store</span></a>[[/if]]
            [[#if googleplay]]<a href="[[googleplay]]" style="text-decoration:none;display:inline-flex;align-items:center;gap:7px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:8px 14px;color:var(--color-text-primary);transition:background .15s;" style-hover="background:var(--color-background-tertiary)"><i class="ti ti-brand-google-play" style="font-size:17px;"></i><span style="font-size:13px;font-weight:600;">Google Play</span></a>[[/if]]
            [[#if comingsoon]]<span style="display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--color-text-tertiary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-pill);padding:7px 14px;"><i class="ti ti-clock" style="font-size:16px;"></i>Coming soon</span>[[/if]]
            <a href="products/[[slug]].html" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;color:var(--color-text-info);font-size:13.5px;font-weight:600;margin-left:auto;">Learn more<i class="ti ti-arrow-right" style="font-size:16px;"></i></a>
          </div>
        </div>
[[/each]]
      </div>`;

replaceRange('产品卡片循环',
  '<div data-stagger="" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;">',
  `<span style="display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--color-text-tertiary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-pill);padding:7px 14px;"><i class="ti ti-clock" style="font-size:16px;"></i>Coming soon</span>
        </div>

      </div>`,
  CARD_LOOP);

// ── 6. 新闻列表 → 循环 ──
const NEWS_LOOP = `<div data-stagger="" style="max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:14px;">
[[#each news_items]]
        <a href="[[url]]" style="text-decoration:none;display:flex;align-items:center;gap:18px;background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:22px 24px;transition:box-shadow .2s,transform .2s;" style-hover="box-shadow:0 18px 40px -24px rgba(20,30,60,0.25);transform:translateY(-2px)">
          <div style="width:46px;height:46px;border-radius:var(--border-radius-md);background:var(--color-background-info);display:flex;align-items:center;justify-content:center;flex:none;"><i class="ti [[icon]]" style="font-size:23px;color:var(--color-text-info);"></i></div>
          <div style="flex:1;">
            <p style="font-size:12.5px;color:var(--color-text-tertiary);margin:0 0 4px;font-weight:500;">[[date]]</p>
            <p style="font-size:16px;font-weight:600;color:var(--color-text-primary);margin:0;">[[title]]</p>
          </div>
          <i class="ti ti-arrow-up-right" style="font-size:20px;color:var(--color-text-tertiary);"></i>
        </a>
[[/each]]
      </div>`;

replaceRange('新闻列表循环',
  '<div data-stagger="" style="max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:14px;">',
  `<p style="font-size:16px;font-weight:600;color:var(--color-text-primary);margin:0;">GardeNet is now available on Google Play</p>
          </div>
          <i class="ti ti-arrow-up-right" style="font-size:20px;color:var(--color-text-tertiary);"></i>
        </a>
      </div>`,
  NEWS_LOOP);

// ── 7. About 区 ──
replaceOnce('About 标题', '>Where communities flourish</h2>', '>[[about_heading]]</h2>');
replaceOnce('About 段落1',
  'Founded on the belief that technology should bring people together and enrich their lives, eBloomify stands at the forefront of creating digital spaces where communities can flourish.',
  '[[about_p1]]');
replaceOnce('About 段落2',
  'Our suite of applications is designed with the user at its core, ensuring that every feature nurtures the growth of connections, the sharing of resources and knowledge, and the joy of collaboration.',
  '[[about_p2]]');

// ── 8. Contact 区:标题/副标题 + 加表单 ──
replaceOnce('Contact 标题', ">Let's grow something together</h2>", '>[[contact_heading]]</h2>');
replaceOnce('Contact 副标题',
  "Whether you're exploring an AI agent for your business or want to learn about our products — we'd love to hear from you.",
  '[[contact_sub]]');

const CONTACT_FORM = `<div style="display:inline-flex;flex-wrap:wrap;justify-content:center;gap:14px 28px;color:var(--color-text-secondary);font-size:14.5px;">
        <span style="display:inline-flex;align-items:center;gap:8px;"><i class="ti ti-mail" style="font-size:18px;color:var(--color-text-info);"></i>[[contact_email]]</span>
        <span style="display:inline-flex;align-items:center;gap:8px;"><i class="ti ti-map-pin" style="font-size:18px;color:var(--color-text-info);"></i>[[contact_address]]</span>
      </div>

      <form id="contactForm" style="max-width:560px;margin:44px auto 0;text-align:left;background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:28px;">
        <p style="font-size:16px;font-weight:600;margin:0 0 18px;color:var(--color-text-primary);">Or send us a message</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <input name="name" required maxlength="80" placeholder="Your name" style="font-family:inherit;font-size:14.5px;padding:12px 14px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-primary);outline-color:var(--color-text-info);width:100%;">
          <input name="email" required type="email" maxlength="120" placeholder="Email address" style="font-family:inherit;font-size:14.5px;padding:12px 14px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-primary);outline-color:var(--color-text-info);width:100%;">
        </div>
        <textarea name="message" required maxlength="3000" rows="4" placeholder="How can we help?" style="font-family:inherit;font-size:14.5px;padding:12px 14px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-primary);outline-color:var(--color-text-info);width:100%;resize:vertical;margin-bottom:14px;"></textarea>
        <button type="submit" style="font-family:inherit;background:var(--color-text-info);color:#fff;border:none;cursor:pointer;padding:12px 26px;border-radius:var(--border-radius-md);font-size:14.5px;font-weight:600;transition:filter .15s;" style-hover="filter:brightness(0.92)">Send message</button>
        <p id="contactFormMsg" style="font-size:14px;margin:12px 0 0;display:none;"></p>
      </form>
      <script>
      (function(){
        var f = document.getElementById('contactForm');
        var msg = document.getElementById('contactFormMsg');
        f.addEventListener('submit', function(e){
          e.preventDefault();
          var btn = f.querySelector('button');
          btn.disabled = true; btn.style.opacity = '.6';
          fetch('/api/contact', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
              name: f.name.value.trim(),
              email: f.email.value.trim(),
              message: f.message.value.trim()
            })
          }).then(function(r){ if(!r.ok) throw 0;
            msg.textContent = 'Thanks — your message has been sent. We will get back to you soon!';
            msg.style.color = 'var(--color-success-text)'; msg.style.display = 'block';
            f.reset(); btn.disabled = false; btn.style.opacity = '';
          }).catch(function(){
            msg.textContent = 'Sorry, something went wrong. Please email us instead: [[contact_email]]';
            msg.style.color = 'var(--color-danger-text)'; msg.style.display = 'block';
            btn.disabled = false; btn.style.opacity = '';
          });
        });
      })();
      </script>`;

replaceRange('Contact 联系方式 + 表单',
  '<div style="display:inline-flex;flex-wrap:wrap;justify-content:center;gap:14px 28px;color:var(--color-text-secondary);font-size:14.5px;">',
  '5900 Balcones Drive STE100, Austin, TX 78731</span>\n      </div>',
  CONTACT_FORM);

// ── 9. 页头/页尾邮箱、地址、产品链接 ──
// header mailto
replaceOnce('header 邮箱',
  '<a href="mailto:ebloomifyllc@gmail.com" style="text-decoration:none;color:var(--color-text-secondary);font-size:14.5px;font-weight:500;white-space:nowrap;transition:color .15s;" style-hover="color:var(--color-text-primary)">Contact</a>',
  '<a href="mailto:[[contact_email]]" style="text-decoration:none;color:var(--color-text-secondary);font-size:14.5px;font-weight:500;white-space:nowrap;transition:color .15s;" style-hover="color:var(--color-text-primary)">Contact</a>');
// contact 区 Email us 按钮
replaceOnce('Email us 按钮',
  '<a href="mailto:ebloomifyllc@gmail.com" style="text-decoration:none;background:var(--color-text-info);color:#fff;',
  '<a href="mailto:[[contact_email]]" style="text-decoration:none;background:var(--color-text-info);color:#fff;');
// footer 地址
replaceOnce('footer 地址',
  '5900 Balcones Drive STE100<br>Austin, TX 78731',
  '[[&contact_address_br]]');
// footer 产品链接
replaceOnce('footer 产品链接',
  `<a href="#products" style="text-decoration:none;color:inherit;" style-hover="color:var(--color-text-primary)">GardeNet</a>
            <a href="#products" style="text-decoration:none;color:inherit;" style-hover="color:var(--color-text-primary)">eChicShop</a>`,
  `[[#each products]]<a href="products/[[slug]].html" style="text-decoration:none;color:inherit;" style-hover="color:var(--color-text-primary)">[[name]]</a>
            [[/each]]`);
// footer 邮箱
replaceOnce('footer 邮箱',
  '<a href="mailto:ebloomifyllc@gmail.com" style="text-decoration:none;color:inherit;" style-hover="color:var(--color-text-primary)">ebloomifyllc@gmail.com</a>',
  '<a href="mailto:[[contact_email]]" style="text-decoration:none;color:inherit;" style-hover="color:var(--color-text-primary)">[[contact_email]]</a>');

fs.writeFileSync(out, html);
console.log('\n模板已生成:', out, '(' + (html.length / 1024).toFixed(0) + ' KB)');
