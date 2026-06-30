#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * build-bin.js —— 用 bun --compile 编译单文件二进制（带「本地运行时缓存」优化）
 *
 * 背景：交叉编译某个平台的二进制时，bun 需要先从 GitHub Releases 下载对应平台的 bun 运行时
 *   （如 bun-darwin-x64.zip）。在网络不稳定（GitHub 访问受限）时该下载会被截断，报错
 *   "Failed to extract executable ... The download may be incomplete."
 *
 * 优化：若本机已把目标运行时缓存到 ~/.bun/runtimes/<target>/bun，则用 bun 的
 *   `--compile-executable-path` 直接复用它，跳过下载；否则回退到 bun 默认的「在线下载」行为。
 *   这样：本机有缓存 → 永不触发下载；别人 clone 仓库无缓存 → 行为与原来完全一致（保持可移植）。
 *
 * 缓存可用 `node scripts/fetch-runtimes.js` 预拉取（在能稳定下载时跑一次即可）。
 *
 * 用法: node scripts/build-bin.js <target> <outfile>
 *   例: node scripts/build-bin.js bun-darwin-x64 dist/postman-chinese-injector-macos-x64
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildData } = require('./build-data');

const ROOT = path.join(__dirname, '..');
const ENTRY = path.join(ROOT, 'postman-chinese-injector.js');

const target = process.argv[2];
const outfile = process.argv[3];
if (!target || !outfile) {
  console.error('用法: node scripts/build-bin.js <target> <outfile>');
  process.exit(1);
}

// 编译前务必先生成可嵌入快照（pm-chinese-data.json + pm-chinese-src.json），否则 bun 会把
// try/catch 里的 require 当可选依赖、静默编译出「无内嵌快照」的坏二进制（单独跑 build:mac 等时尤甚）。
try {
  console.log('[build-bin] 生成可嵌入快照…');
  buildData('zh-CN');
} catch (e) {
  console.error(`[build-bin] 生成快照失败: ${e.message}`);
  process.exit(1);
}

// Windows 目标的运行时是 bun.exe，其它平台是 bun
const runtimeName = target.startsWith('bun-windows') ? 'bun.exe' : 'bun';
const runtimePath = path.join(os.homedir(), '.bun', 'runtimes', target, runtimeName);

const args = [
  'build', ENTRY,
  '--compile', '--minify',
  `--target=${target}`,
  '--outfile', outfile,
];

if (fs.existsSync(runtimePath)) {
  args.push(`--compile-executable-path=${runtimePath}`);
  console.log(`[build-bin] 使用本地缓存运行时: ${runtimePath}`);
} else {
  console.log(`[build-bin] 未找到 ${target} 的本地缓存运行时，将由 bun 在线下载` +
    `（若反复失败可运行: node scripts/fetch-runtimes.js）`);
}

// 直接调用 bun.exe / bun，避免 shell 引号问题
const bunCmd = process.platform === 'win32' ? 'bun.exe' : 'bun';
const r = spawnSync(bunCmd, args, { stdio: 'inherit' });
if (r.error) {
  console.error(`[build-bin] 无法启动 bun: ${r.error.message}`);
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
