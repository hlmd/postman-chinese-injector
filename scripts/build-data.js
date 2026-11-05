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
 * 编译脚本 build-bin.js 会在 `bun build` 前调用本模块的 buildData()，确保两份快照都已生成，
 * 避免单独跑 `npm run build:mac` 等漏掉数据步骤、结果编译出「无内嵌快照」的坏二进制。
 *
 * 用法: node scripts/build-data.js [lang]   （默认 zh-CN）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GEN = path.join(ROOT, 'generated');

// 生成两份可嵌入快照（pm-chinese-data.json + pm-chinese-src.json）。出错抛异常，由调用方处理。
function buildData(lang = 'zh-CN') {
  fs.mkdirSync(GEN, { recursive: true });
  const dir = path.join(ROOT, 'locales', lang);
  const out = path.join(GEN, 'pm-chinese-data.json');

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`找不到语言目录: ${dir}`);
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

  if (!count) throw new Error(`${dir} 下没有可用的翻译文件`);

  fs.writeFileSync(out, JSON.stringify(bundle), 'utf8');
  console.log(`[完成] ${lang}: ${count} 模块 -> ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);

  // 钩子源码快照：供编译后的二进制取出 pm-chinese.js 写进 asar（运行时身边无源文件）。
  const hookSrc = path.join(ROOT, 'src', 'hooks', 'pm-chinese.js');
  const hookOut = path.join(GEN, 'pm-chinese-src.json');
  if (!fs.existsSync(hookSrc)) throw new Error(`找不到钩子源码: ${hookSrc}`);
  fs.writeFileSync(hookOut, JSON.stringify({ src: fs.readFileSync(hookSrc, 'utf8') }), 'utf8');
  console.log(`[完成] 钩子源码 -> ${path.relative(ROOT, hookOut)} (${(fs.statSync(hookOut).size / 1024).toFixed(0)} KB)`);

  // Scratch Pad DOM 翻译：词典快照 + 钩子源码快照（供 bun --compile 内嵌）
  const spDict = path.join(ROOT, 'locales', 'scratchpad', 'zh-CN.json');
  if (fs.existsSync(spDict)) {
    const dict = JSON.parse(fs.readFileSync(spDict, 'utf8'));
    const spDataOut = path.join(GEN, 'pm-scratchpad-data.json');
    fs.writeFileSync(spDataOut, JSON.stringify(dict), 'utf8');
    console.log(`[完成] Scratch Pad 词典 -> ${path.relative(ROOT, spDataOut)} (${Object.keys(dict).length} 条)`);

    const spHookSrc = path.join(ROOT, 'src', 'hooks', 'pm-scratchpad-cn.js');
    if (!fs.existsSync(spHookSrc)) throw new Error(`找不到钩子源码: ${spHookSrc}`);
    const spHookOut = path.join(GEN, 'pm-scratchpad-src.json');
    fs.writeFileSync(spHookOut, JSON.stringify({ src: fs.readFileSync(spHookSrc, 'utf8') }), 'utf8');
    console.log(`[完成] Scratch Pad 钩子源码 -> ${path.relative(ROOT, spHookOut)} (${(fs.statSync(spHookOut).size / 1024).toFixed(0)} KB)`);
  } else {
    console.warn(`[警告] 未找到 ${path.relative(ROOT, spDict)}，跳过 Scratch Pad 快照（请先跑 build-scratchpad-dict.js）`);
  }

  // 主进程原生菜单：词典快照 + 钩子源码快照（供 bun --compile 内嵌）
  const mainDict = path.join(ROOT, 'locales', 'main', 'zh-CN.json');
  if (!fs.existsSync(mainDict)) throw new Error(`找不到主进程词典: ${mainDict}`);
  const mDict = JSON.parse(fs.readFileSync(mainDict, 'utf8'));
  const mDataOut = path.join(GEN, 'pm-main-data.json');
  fs.writeFileSync(mDataOut, JSON.stringify(mDict), 'utf8');
  console.log(`[完成] 主进程词典 -> ${path.relative(ROOT, mDataOut)} (${Object.keys(mDict).length} 条)`);
  const mHookSrc = path.join(ROOT, 'src', 'hooks', 'pm-main-cn.js');
  if (!fs.existsSync(mHookSrc)) throw new Error(`找不到钩子源码: ${mHookSrc}`);
  const mHookOut = path.join(GEN, 'pm-main-src.json');
  fs.writeFileSync(mHookOut, JSON.stringify({ src: fs.readFileSync(mHookSrc, 'utf8') }), 'utf8');
  console.log(`[完成] 主进程钩子源码 -> ${path.relative(ROOT, mHookOut)} (${(fs.statSync(mHookOut).size / 1024).toFixed(0)} KB)`);

  // 构建元信息：译文对应的提交时间，供程序判断在线数据包 / 本机缓存是否比内嵌快照新
  const meta = { commit: gitOut(['rev-parse', 'HEAD']), committedAt: gitOut(['log', '-1', '--format=%cI']) || new Date().toISOString() };
  fs.writeFileSync(path.join(GEN, 'pm-build-meta.json'), JSON.stringify(meta), 'utf8');
  console.log(`[完成] 构建元信息 -> generated/pm-build-meta.json（${meta.committedAt}）`);

  return { lang, count, meta };
}

function gitOut(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

module.exports = { buildData };

if (require.main === module) {
  try {
    buildData(process.argv[2] || 'zh-CN');
  } catch (e) {
    console.error(`[错误] ${e.message}`);
    process.exit(1);
  }
}
