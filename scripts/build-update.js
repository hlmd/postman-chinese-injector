#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * build-update.js —— 生成在线热更新用的数据包 dist/update/pm-update.json.gz（简体）与 pm-update.zh-TW.json.gz（繁體）
 *   （译文 + Scratch Pad 词典 + 主进程词典 + 3 个钩子源码 + 提交时间），
 *   由 .github/workflows/update-data.yml 推到 update-data 分支，注入程序运行时拉取（见 updater.js）。
 *
 * 用法: node scripts/build-update.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { buildData, buildLangPack } = require('./build-data');
const { DATA_SCHEMA, dataFileFor, parseDataBundle } = require('../src/updater');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist', 'update');

function main() {
  const { meta } = buildData('zh-CN');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'generated', f), 'utf8'));
  const bundle = {
    schema: DATA_SCHEMA,
    version: require('../package.json').version,
    commit: meta.commit,
    committedAt: meta.committedAt,
    data: read('pm-chinese-data.json'),
    hook: read('pm-chinese-src.json').src,
    scratchpadDict: read('pm-scratchpad-data.json'),
    scratchpadHook: read('pm-scratchpad-src.json').src,
    mainDict: read('pm-main-data.json'),
    mainHook: read('pm-main-src.json').src,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeBundle(bundle, 'zh-CN', meta);

  // 繁體：同一份钩子源码，换成 zh-TW 译文与词典
  const tw = buildLangPack('zh-TW');
  if (!tw) throw new Error('缺少 locales/zh-TW/，请先运行 node scripts/build-zh-tw.js');
  writeBundle(Object.assign({}, bundle, { lang: 'zh-TW' }, tw), 'zh-TW', meta);
}

function writeBundle(bundle, lang, meta) {
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8'), { level: 9 });
  parseDataBundle(gz, lang); // 自检：确保客户端能解析
  const out = path.join(OUT_DIR, dataFileFor(lang));
  fs.writeFileSync(out, gz);
  console.log(`[完成] 在线数据包（${lang}）-> ${path.relative(ROOT, out)}（${(gz.length / 1024).toFixed(0)} KB，${meta.committedAt}）`);
}

try {
  main();
} catch (e) {
  console.error(`[错误] ${e.message}`);
  process.exit(1);
}
