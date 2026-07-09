#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * build-bin-legacy.js —— 面向「老 Windows」的单文件二进制（用 pkg / Node 运行时，而非 bun）
 *
 * 为什么单独一条路：
 *   默认的 `build:win`（bun --compile）产物会**静态链接** Windows 的 ConPTY API
 *   `ClosePseudoConsole`（Win10 1809 / Server 2019 起才有）。在更老的系统（如 Windows
 *   Server 2012、Win7）上，加载器找不到该入口点，程序一启动就报
 *   「无法定位程序输入点 ClosePseudoConsole …」而无法运行（见 Issue #4）。
 *   Node 则是用 GetProcAddress **动态探测** ConPTY，在老系统上会优雅降级，故老系统改用
 *   Node 运行时打包（pkg）即可绕开这个坎。
 *
 * 基座选择：
 *   活跃维护的 @yao-pkg/pkg 只提供 node22+ 基座（又要 Win10/Server 2016+，等于没解决），
 *   故这里用已归档但仍可用的 vercel/pkg 5.8.1，默认基座 node16-win-x64：
 *     - node16 覆盖 Windows 8.1 / Server 2012 R2 及以上（绝大多数「老系统」）；
 *     - 若目标更旧（Server 2012 非 R2 / Win7），可传 node12-win-x64 尽力覆盖（Node 官方也不保，
 *       本机无法实测，属尽力而为）。
 *
 * asar：老 Node 基座（<22）不能用 @electron/asar@4（其 engines 要求 Node>=22.12），这里在独立
 *   暂存目录里装 @electron/asar@3（兼容 Node 12+），由 pkg 打进快照；不污染仓库根的 asar@4。
 *
 * 用法: node scripts/build-bin-legacy.js [pkg-target] [outfile]
 *   例: node scripts/build-bin-legacy.js                      # node16-win-x64
 *       node scripts/build-bin-legacy.js node12-win-x64       # 尽力覆盖更老系统
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildData } = require('./build-data');

const ROOT = path.join(__dirname, '..');
const target = process.argv[2] || 'node16-win-x64';
const outfile = path.resolve(ROOT, process.argv[3] || 'dist/postman-chinese-injector-win-x64-legacy.exe');
const ASAR_LEGACY = '@electron/asar@3'; // v4 要 Node>=22；老基座必须用兼容 Node 12+ 的 v3

function run(cmd, args, opts) {
  // Windows 下 npm/npx 是 .cmd，需要 shell
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`\`${cmd} ${args.join(' ')}\` 失败（exit ${r.status}）`);
}

function main() {
  if (!/^node\d+-win-x64$/.test(target)) {
    console.error(`[legacy] 该脚本仅用于老 Windows；target 需形如 nodeXX-win-x64（当前: ${target}）`);
    process.exit(1);
  }

  // 1) 生成可嵌入快照（与 build-bin.js 相同：pm-chinese-data.json + pm-chinese-src.json）
  console.log('[legacy] 生成可嵌入快照…');
  buildData('zh-CN');

  // 2) 建独立暂存目录，隔离 asar@3（不污染仓库根的 asar@4）
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'pmci-legacy-'));
  console.log(`[legacy] 暂存目录: ${stage}`);
  try {
    for (const f of [
      'postman-chinese-injector.js', 'pm-chinese.js', 'pm-chinese-data.json', 'pm-chinese-src.json',
      // Scratch Pad 快照：buildData 已在 ROOT 生成，必须一并带进 staging，否则 pkg 打出的
      // 二进制缺内嵌快照，运行时报「缺少 Scratch Pad 钩子源码 pm-scratchpad-cn.js（且无内嵌快照）」。
      'pm-scratchpad-data.json', 'pm-scratchpad-src.json',
    ]) {
      fs.copyFileSync(path.join(ROOT, f), path.join(stage, f));
    }
    const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
      name: 'postman-chinese-injector',
      version: rootPkg.version,
      bin: 'postman-chinese-injector.js',
      main: 'postman-chinese-injector.js',
      // require() 到的 JSON 快照 pkg 会自动纳入；这里再列进 assets 双保险
      pkg: { targets: [target], assets: [
        'pm-chinese-data.json', 'pm-chinese-src.json',
        'pm-scratchpad-data.json', 'pm-scratchpad-src.json',
      ] },
    }, null, 2));

    // 3) 装 asar@3（供 pkg 打进快照）
    console.log(`[legacy] 安装 ${ASAR_LEGACY} …`);
    run('npm', ['install', ASAR_LEGACY, '--no-audit', '--no-fund', '--loglevel=error'], { cwd: stage });

    // 4) pkg 打包
    fs.mkdirSync(path.dirname(outfile), { recursive: true });
    console.log(`[legacy] pkg 打包 -> ${outfile}（target=${target}，基座首次会联网下载 Node 运行时）`);
    run('npx', ['--yes', 'pkg@5.8.1', '.', '--targets', target, '--output', outfile], { cwd: stage });

    const sizeMB = (fs.statSync(outfile).size / 1024 / 1024).toFixed(0);
    console.log(`[legacy] 完成: ${path.relative(ROOT, outfile)}（${sizeMB} MB，target=${target}）`);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

main();
