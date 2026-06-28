#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * compress-dist.js —— 把 dist/ 里已编译的单文件二进制压缩成发行包
 *
 * 背景：bun --compile 内嵌整个 Bun 运行时，单文件 57~110MB 无法再缩小；本脚本不改动二进制
 *   本身，只在「分发」环节压缩，下载体积约降到 1/4（解压后仍按原大小运行）。
 *
 * 产物（与原二进制并存，不删除原文件，方便本地直接测试）：
 *   - Windows : postman-chinese-injector-win-x64.zip      （双击即可解压）
 *   - 其它平台: *.tar.xz                                   （体积最小，保留可执行位）
 *
 * 依赖：
 *   - Windows: 直接用系统自带的 C:\Windows\System32\tar.exe（bsdtar/libarchive，自带 liblzma），
 *     xz 与 zip 都在内部完成，无需额外安装任何工具（不受 PATH 上其它 tar 影响）。
 *   - Linux/macOS: 用 GNU tar 走 xz（需有 xz）、用 `zip` 命令打 zip——与 CI 一致。
 *
 * 用法: node scripts/compress-dist.js
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const IS_WIN = process.platform === 'win32';
// Windows 上锁定系统自带 bsdtar，避免被 Git 的 GNU tar 抢占（GNU tar 不认 --options）
const TAR = IS_WIN
  ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
  : 'tar';

// Windows 目标压成 zip；其余压成 tar.xz
const WIN_EXE = 'postman-chinese-injector-win-x64.exe';
const UNIX_BINS = [
  'postman-chinese-injector-linux-x64',
  'postman-chinese-injector-linux-arm64',
  'postman-chinese-injector-macos-x64',
  'postman-chinese-injector-macos-arm64',
];

function sizeMB(p) {
  return (fs.statSync(p).size / 1024 / 1024).toFixed(1) + 'MB';
}

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, {
    cwd: DIST,
    stdio: ['ignore', 'pipe', 'inherit'],
    env: env ? { ...process.env, ...env } : process.env,
  });
  if (r.error) throw new Error(`无法运行 ${cmd}：${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 退出码 ${r.status}`);
}

function makeZip(file, out) {
  if (IS_WIN) {
    // bsdtar：-a 按扩展名(.zip)自动选 zip 容器
    run(TAR, ['-a', '-c', '-f', out, file]);
  } else {
    run('zip', ['-9', '-q', out, file]);
  }
}

function makeXz(file, out) {
  if (IS_WIN) {
    // bsdtar 用 --options 设最高压缩级
    run(TAR, ['--options', 'xz:compression-level=9', '-cJf', out, file]);
  } else {
    // GNU tar 不认 --options，改用 XZ_OPT 透传给 xz
    run(TAR, ['-cJf', out, file], { XZ_OPT: '-9' });
  }
}

function compressOne(file) {
  const src = path.join(DIST, file);
  if (!fs.existsSync(src)) {
    console.log(`[跳过] 不存在: ${file}`);
    return;
  }
  const before = sizeMB(src);

  let out;
  if (file === WIN_EXE) {
    out = file.replace(/\.exe$/, '') + '.zip';
    makeZip(file, out);
  } else {
    out = file + '.tar.xz';
    makeXz(file, out);
  }

  console.log(`[完成] ${file} (${before}) -> ${out} (${sizeMB(path.join(DIST, out))})`);
}

if (!fs.existsSync(DIST)) {
  console.error(`找不到 dist/，请先构建（npm run build）`);
  process.exit(1);
}

[WIN_EXE, ...UNIX_BINS].forEach(compressOne);
console.log('\n压缩包已生成在 dist/（原二进制保留，可继续本地测试）。');
