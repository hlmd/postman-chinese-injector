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
 * 性能：xz -9 是 CPU 密集的单线程压缩（~420MB 全量解析），逐个压很慢；这里把各文件「并行」压缩，
 *   多核可缩短到约「单文件耗时 × ceil(文件数/核数)」。压缩率/格式不变，解压侧无感知。
 *
 * 用法: node scripts/compress-dist.js
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
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

// 异步跑一个外部命令；reject 时带上命令信息
function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: DIST,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: env ? { ...process.env, ...env } : process.env,
    });
    child.on('error', (e) => reject(new Error(`无法运行 ${cmd}：${e.message}`)));
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} 退出码 ${code}`)));
  });
}

// 返回该文件的压缩命令（不立即执行）
function planFor(file) {
  if (file === WIN_EXE) {
    const out = file.replace(/\.exe$/, '') + '.zip';
    // bsdtar：-a 按扩展名(.zip)自动选 zip 容器；非 win 回退到 zip 命令
    const job = IS_WIN
      ? run(TAR, ['-a', '-c', '-f', out, file])
      : run('zip', ['-9', '-q', out, file]);
    return { out, job };
  }
  const out = file + '.tar.xz';
  // bsdtar 用 --options 设最高压缩级；GNU tar 不认 --options，改用 XZ_OPT 透传给 xz
  const job = IS_WIN
    ? run(TAR, ['--options', 'xz:compression-level=9', '-cJf', out, file])
    : run(TAR, ['-cJf', out, file], { XZ_OPT: '-9' });
  return { out, job };
}

async function main() {
  if (!fs.existsSync(DIST)) {
    console.error(`找不到 dist/，请先构建（npm run build）`);
    process.exit(1);
  }

  const present = [WIN_EXE, ...UNIX_BINS].filter((f) => {
    const ok = fs.existsSync(path.join(DIST, f));
    if (!ok) console.log(`[跳过] 不存在: ${f}`);
    return ok;
  });
  if (present.length === 0) {
    console.error('dist/ 里没有可压缩的二进制，请先 npm run build');
    process.exit(1);
  }

  // 各文件相互独立，全部并行启动（每个 xz 占一个核，多核同时压）
  console.log(`并行压缩 ${present.length} 个文件（约 ${os.cpus().length} 核可用）…`);
  const results = await Promise.allSettled(
    present.map((file) => {
      const before = sizeMB(path.join(DIST, file));
      const { out, job } = planFor(file);
      return job.then(() => {
        console.log(`[完成] ${file} (${before}) -> ${out} (${sizeMB(path.join(DIST, out))})`);
      });
    })
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    failed.forEach((r) => console.error(`[失败] ${r.reason.message}`));
    process.exit(1);
  }
  console.log('\n压缩包已生成在 dist/（原二进制保留，可继续本地测试）。');
}

main();
