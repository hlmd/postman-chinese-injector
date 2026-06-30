#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * build-data.js —— 生成「编译单文件二进制」前需要的可嵌入快照（bun --compile 会把它们静态打进二进制）：
 *   ① pm-chinese-data.json —— 把 locales/<lang>/*.json 合并成单个数据快照；
 *   ② pm-chinese-src.json  —— 钩子源码 pm-chinese.js 的文本快照（二进制运行时身边没有源文件，
 *      靠它取出钩子源码写进 asar；否则会因 __dirname 指向编译机路径而报「缺少 pm-chinese.js」）。
 *
 * 平时用 `node postman-chinese-injector.js` 注入时不需要它们——那条路直接从 locales/ 与本地 pm-chinese.js 读。
 *
 * 用法: node scripts/build-data.js [lang]   （默认 zh-CN）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const lang = process.argv[2] || 'zh-CN';
const dir = path.join(ROOT, 'locales', lang);
const out = path.join(ROOT, 'pm-chinese-data.json');

if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error(`[错误] 找不到语言目录: ${dir}`);
  process.exit(1);
}

const bundle = {};
let count = 0;
for (const name of fs.readdirSync(dir).sort()) {
  if (!name.endsWith('.json')) continue;
  const mod = name.slice(0, -'.json'.length);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  } catch (e) {
    console.error(`[跳过] ${name} 解析失败: ${e.message}`);
    continue;
  }
  if (data && typeof data === 'object' && Object.keys(data).length) {
    bundle[mod] = data;
    count++;
  }
}

if (!count) {
  console.error(`[错误] ${dir} 下没有可用的翻译文件`);
  process.exit(1);
}

fs.writeFileSync(out, JSON.stringify(bundle), 'utf8');
console.log(`[完成] ${lang}: ${count} 模块 -> ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);

// 钩子源码快照：供编译后的二进制取出 pm-chinese.js 写进 asar（运行时身边无源文件）。
const hookSrc = path.join(ROOT, 'pm-chinese.js');
const hookOut = path.join(ROOT, 'pm-chinese-src.json');
if (!fs.existsSync(hookSrc)) {
  console.error(`[错误] 找不到钩子源码: ${hookSrc}`);
  process.exit(1);
}
fs.writeFileSync(hookOut, JSON.stringify({ src: fs.readFileSync(hookSrc, 'utf8') }), 'utf8');
console.log(`[完成] 钩子源码 -> ${path.relative(ROOT, hookOut)} (${(fs.statSync(hookOut).size / 1024).toFixed(0)} KB)`);
