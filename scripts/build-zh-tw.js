#!/usr/bin/env node
/*
 * build-zh-tw.js —— 由简体译文生成繁體中文译文：
 *   locales/zh-CN/*.json         → locales/zh-TW/*.json
 *   locales/scratchpad/zh-CN.json → locales/scratchpad/zh-TW.json
 *   locales/main/zh-CN.json       → locales/main/zh-TW.json
 *   README.md                     → README.zh-TW.md（换语言切换栏，并校验页内锚点）
 *
 * 只转换字符串值，键名（模块路径 / 英文原文）与 {{占位符}} 等拉丁字符原样保留。
 * 先用 OpenCC s2twp（简→繁 + 惯用词转换），再按 scripts/zh-tw-glossary.json 修正。
 * 生成结果提交进仓库（运行时不依赖 OpenCC）；简体译文有改动后重跑本脚本即可同步。
 *
 * 用法: node scripts/build-zh-tw.js [--check]
 *   --check  只检查 zh-TW 是否与当前 zh-CN 同步（不同步则退出码 1），不写文件
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES = path.join(ROOT, 'locales');

function makeConverter() {
  let OpenCC;
  try { OpenCC = require('opencc-js'); } catch (e) {
    throw new Error('缺少开发依赖 opencc-js，请先 npm install');
  }
  const s2twp = OpenCC.Converter({ from: 'cn', to: 'twp' });
  const glossary = JSON.parse(fs.readFileSync(path.join(__dirname, 'zh-tw-glossary.json'), 'utf8'));
  const rules = glossary.rules.map((r) => ({ re: new RegExp(r.pattern, 'g'), replace: r.replace }));
  const cache = new Map();
  return (text) => {
    if (!/[一-鿿]/.test(text)) return text;
    let out = cache.get(text);
    if (out === undefined) {
      out = s2twp(text);
      for (const r of rules) out = out.replace(r.re, r.replace);
      cache.set(text, out);
    }
    return out;
  };
}

// 递归转换 JSON 里的所有字符串值（不动键）
function convertValues(node, conv) {
  if (typeof node === 'string') return conv(node);
  if (Array.isArray(node)) return node.map((v) => convertValues(v, conv));
  if (node && typeof node === 'object') {
    const out = {};
    for (const k of Object.keys(node)) out[k] = convertValues(node[k], conv);
    return out;
  }
  return node;
}

// 保持与源文件相同的缩进风格（2 空格 / 压缩）
function serialize(obj, srcText) {
  const indent = /^\{\s*\n(\s+)"/.exec(srcText);
  return JSON.stringify(obj, null, indent ? indent[1] : 0) + (srcText.endsWith('\n') ? '\n' : '');
}

// ---------- README ----------
const README = path.join(ROOT, 'README.md');
const README_TW = path.join(ROOT, 'README.zh-TW.md');
const BAR_CN = '**简体中文** · [繁體中文](README.zh-TW.md)';
const BAR_TW = '[简体中文](README.md) · **繁體中文**';
const TW_NOTICE = '<!-- 本檔由 scripts/build-zh-tw.js 從 README.md 自動生成，請勿手改；修改請改 README.md 後重新生成 -->\n';

// 整篇转换（代码块里的中文注释一并转换；命令、路径等拉丁字符不受影响），再换语言切换栏
function readmeTw(conv) {
  const src = fs.readFileSync(README, 'utf8');
  if (!src.includes(BAR_CN)) throw new Error(`README.md 缺少语言切换栏：${BAR_CN}`);
  const out = conv(src).replace(conv(BAR_CN), BAR_TW);
  if (!out.includes(BAR_TW)) throw new Error('README.zh-TW.md 语言切换栏替换失败');
  return out.replace(/^(# .*\n)/, `$1${TW_NOTICE}`);
}

// 按 GitHub 规则由标题生成锚点，返回 Markdown 里找不到对应标题的页内链接
function brokenAnchors(md) {
  const text = md.replace(/```[\s\S]*?```/g, '');
  const slug = (h) => h.replace(/`/g, '').trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
  const heads = new Set();
  const seen = {};
  for (const m of text.matchAll(/^#{1,6} (.+)$/gm)) {
    const sl = slug(m[1]);
    heads.add(seen[sl] ? `${sl}-${seen[sl]}` : sl);
    seen[sl] = (seen[sl] || 0) + 1;
  }
  return [...text.matchAll(/\]\(#([^)]+)\)/g)].map((m) => decodeURIComponent(m[1])).filter((a) => !heads.has(a));
}

// 计划生成的 [源文件, 目标文件] 列表
function plan() {
  const pairs = [];
  const srcDir = path.join(LOCALES, 'zh-CN');
  for (const name of fs.readdirSync(srcDir).sort()) {
    if (name.endsWith('.json')) pairs.push([path.join(srcDir, name), path.join(LOCALES, 'zh-TW', name)]);
  }
  for (const sub of ['scratchpad', 'main']) {
    const src = path.join(LOCALES, sub, 'zh-CN.json');
    if (fs.existsSync(src)) pairs.push([src, path.join(LOCALES, sub, 'zh-TW.json')]);
  }
  return pairs;
}

function main() {
  const check = process.argv.includes('--check');
  const conv = makeConverter();
  const pairs = plan();
  const expected = new Set(pairs.map(([, dst]) => dst));
  let changed = 0;

  for (const [src, dst] of pairs) {
    const srcText = fs.readFileSync(src, 'utf8');
    const text = serialize(convertValues(JSON.parse(srcText), conv), srcText);
    const old = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : null;
    if (old === text) continue;
    changed++;
    if (check) console.log(`[不同步] ${path.relative(ROOT, dst)}`);
    else {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, text, 'utf8');
    }
  }

  // zh-CN 删掉的模块，zh-TW 也删掉
  const twDir = path.join(LOCALES, 'zh-TW');
  if (fs.existsSync(twDir)) {
    for (const name of fs.readdirSync(twDir)) {
      const p = path.join(twDir, name);
      if (name.endsWith('.json') && !expected.has(p)) {
        changed++;
        if (check) console.log(`[多余] ${path.relative(ROOT, p)}`);
        else fs.rmSync(p);
      }
    }
  }

  // README.zh-TW.md
  const tw = readmeTw(conv);
  for (const [name, md] of [['README.md', fs.readFileSync(README, 'utf8')], ['README.zh-TW.md', tw]]) {
    const bad = brokenAnchors(md);
    if (bad.length) throw new Error(`${name} 有 ${bad.length} 个页内锚点找不到标题：${bad.map((a) => '#' + a).join('、')}`);
  }
  const oldTw = fs.existsSync(README_TW) ? fs.readFileSync(README_TW, 'utf8') : null;
  if (oldTw !== tw) {
    changed++;
    if (check) console.log('[不同步] README.zh-TW.md');
    else fs.writeFileSync(README_TW, tw, 'utf8');
  }

  if (check) {
    if (changed) {
      console.error(`[错误] 繁體译文有 ${changed} 个文件与简体不同步，请运行 node scripts/build-zh-tw.js`);
      process.exit(1);
    }
    console.log(`[完成] 繁體译文已同步（${pairs.length} 个文件）`);
  } else {
    console.log(`[完成] 繁體译文：${pairs.length} 个文件，更新 ${changed} 个`);
  }
}

module.exports = { makeConverter, convertValues, brokenAnchors };

if (require.main === module) {
  try { main(); } catch (e) { console.error(`[错误] ${e.message}`); process.exit(1); }
}
