#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * fetch-runtimes.js —— 预拉取交叉编译所需的各平台 bun 运行时，缓存到 ~/.bun/runtimes/<target>/bun
 *
 * 给 scripts/build-bin.js 用：缓存命中后编译就不再依赖「实时从 GitHub 下载运行时」，
 * 避免网络不稳定时报 "Failed to extract executable ... The download may be incomplete."。
 *
 * 在能稳定访问 GitHub 时跑一次即可（带重试）。已存在且非空的目标默认跳过，用 --force 覆盖。
 *
 * 用法: node scripts/fetch-runtimes.js [--force] [target ...]
 *   不带 target 时拉取除当前宿主平台外的全部目标（宿主平台编译时用本机 bun，无需下载）。
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// target（bun --target 的取值） -> GitHub release 资产基名
//   注意：arm64 目标的资产名用的是 aarch64
const ASSET = {
  'bun-darwin-x64': 'bun-darwin-x64',
  'bun-darwin-arm64': 'bun-darwin-aarch64',
  'bun-linux-x64': 'bun-linux-x64',
  'bun-linux-arm64': 'bun-linux-aarch64',
  'bun-windows-x64': 'bun-windows-x64',
};

function hostTarget() {
  const a = process.arch === 'arm64' ? 'arm64' : 'x64';
  if (process.platform === 'win32') return 'bun-windows-x64';
  if (process.platform === 'darwin') return `bun-darwin-${a}`;
  return `bun-linux-${a}`;
}

const argv = process.argv.slice(2);
const force = argv.includes('--force');
let targets = argv.filter((x) => !x.startsWith('--'));
if (targets.length === 0) {
  const host = hostTarget();
  targets = Object.keys(ASSET).filter((t) => t !== host);
}

const ver = spawnSync('bun', ['--version'], { encoding: 'utf8' }).stdout.trim();
if (!ver) {
  console.error('[错误] 无法获取 bun 版本，请确认已安装 bun 并在 PATH 中');
  process.exit(1);
}
const base = `https://github.com/oven-sh/bun/releases/download/bun-v${ver}`;
const runtimesDir = path.join(os.homedir(), '.bun', 'runtimes');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bun-rt-'));

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'buffer' });
}

let failed = 0;
for (const target of targets) {
  const asset = ASSET[target];
  if (!asset) { console.error(`[跳过] 未知 target: ${target}`); failed++; continue; }
  const runtimeName = target.startsWith('bun-windows') ? 'bun.exe' : 'bun';
  const destDir = path.join(runtimesDir, target);
  const destBin = path.join(destDir, runtimeName);
  if (!force && fs.existsSync(destBin) && fs.statSync(destBin).size > 1_000_000) {
    console.log(`[已存在] ${target} -> ${destBin}`);
    continue;
  }

  const url = `${base}/${asset}.zip`;
  const zip = path.join(tmpDir, `${asset}.zip`);
  console.log(`[下载] ${target}  (${url})`);
  // curl 在 Windows 10+/macOS/多数 Linux 自带；--retry 应对截断
  const dl = run('curl', ['-L', '--retry', '5', '--retry-all-errors', '--max-time', '300', '-s', '-o', zip, url]);
  if (dl.status !== 0 || !fs.existsSync(zip) || fs.statSync(zip).size < 1_000_000) {
    const size = fs.existsSync(zip) ? fs.statSync(zip).size : 0;
    console.error(`[失败] 下载 ${asset}.zip 异常（${size} 字节）。可能该平台资产名有变，或网络问题。`);
    failed++;
    continue;
  }

  // 解压：tar -xf 可处理 zip（Windows 10+ 自带 bsdtar / macOS 自带），失败再尝试 unzip
  const exDir = path.join(tmpDir, `x_${target}`);
  fs.mkdirSync(exDir, { recursive: true });
  let ex = run('tar', ['-xf', zip, '-C', exDir]);
  if (ex.status !== 0) ex = run('unzip', ['-o', '-q', zip, '-d', exDir]);
  if (ex.status !== 0) {
    console.error(`[失败] 解压 ${asset}.zip 失败（tar 与 unzip 均不可用？）`);
    failed++;
    continue;
  }

  // 在解压结果里找名为 bun / bun.exe 的可执行文件
  const found = findBin(exDir, runtimeName);
  if (!found) { console.error(`[失败] ${asset}.zip 中未找到 ${runtimeName}`); failed++; continue; }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(found, destBin);
  if (runtimeName === 'bun') { try { fs.chmodSync(destBin, 0o755); } catch (_) {} }
  console.log(`[完成] ${target} -> ${destBin} (${fs.statSync(destBin).size} 字节)`);
}

fs.rmSync(tmpDir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

function findBin(dir, name) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { const r = findBin(p, name); if (r) return r; }
    else if (ent.name === name) return p;
  }
  return null;
}
