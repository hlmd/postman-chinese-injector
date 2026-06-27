#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * build-data.js —— 把 locales/<lang>/*.json 合并成单个 pm-chinese-data.json
 *
 * 仅用于「编译单文件二进制」前生成可嵌入的数据快照（bun --compile 会把它静态打进二进制）。
 * 平时用 `node postman-chinese-injector.js` 注入时不需要它——那条路直接从 locales/ 读。
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
