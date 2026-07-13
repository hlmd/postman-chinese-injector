#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * build-extension.js —— 把汉化打包成 Chrome / Edge (MV3) 浏览器扩展，给 Postman 网页版用
 *
 * 产物（dist/extension/，可直接「加载已解压的扩展程序」）：
 *   ├── manifest.json      # MV3；内容脚本 world:MAIN + run_at:document_start
 *   ├── pm-i18n-data.js    # window.__PM_I18N__ = { <module>: {...中文...} }（由 locales/ 合并）
 *   └── pm-chinese.js      # 与桌面端共用的同一份运行时钩子（唯一真源）
 * 并额外打一个 dist/postman-chinese-injector-extension.zip 方便分发 / 上传商店。
 *
 * 原理与桌面端一致：内容脚本在页面脚本之前（document_start）于 MAIN world 包装 window.fetch /
 * XMLHttpRequest，拦截 .../_ar-assets/locales/<lang>/<module>.json 语言包响应并 deep-merge 中文。
 * 因为同一段钩子既能从全局 __PM_I18N__ 取数据（浏览器），也能从 fs 读 pm-chinese-data.json（桌面），
 * 所以两端复用 pm-chinese.js，无重复逻辑。
 *
 * 用法: node scripts/build-extension.js [lang]   （默认 zh-CN）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const lang = process.argv[2] || 'zh-CN';
const localesDir = path.join(ROOT, 'locales', lang);
const hookSrc = path.join(ROOT, 'pm-chinese.js');
const outDir = path.join(ROOT, 'dist', 'extension');
const zipPath = path.join(ROOT, 'dist', 'postman-chinese-injector-extension.zip');

if (!fs.existsSync(localesDir) || !fs.statSync(localesDir).isDirectory()) {
  console.error(`[错误] 找不到语言目录: ${localesDir}`);
  process.exit(1);
}
if (!fs.existsSync(hookSrc)) {
  console.error(`[错误] 找不到钩子文件: ${hookSrc}`);
  process.exit(1);
}

// 1) 合并 locales/<lang>/*.json -> 扁平 bundle（与 build-data.js 同构）
const bundle = {};
let count = 0;
for (const name of fs.readdirSync(localesDir).sort()) {
  if (!name.endsWith('.json')) continue;
  const mod = name.slice(0, -'.json'.length);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(localesDir, name), 'utf8'));
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
  console.error(`[错误] ${localesDir} 下没有可用的翻译文件`);
  process.exit(1);
}

// 2) 准备干净的输出目录
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 3) 写入数据脚本（先于钩子执行，预置全局）
const dataJs = 'window.__PM_I18N__ = ' + JSON.stringify(bundle) + ';\n';
fs.writeFileSync(path.join(outDir, 'pm-i18n-data.js'), dataJs, 'utf8');

// 4) 复制共用钩子
fs.copyFileSync(hookSrc, path.join(outDir, 'pm-chinese.js'));

// 4b) Scratch Pad DOM 词典 + 钩子（补语言包未覆盖的 UI 文案，让网页版也走整串 DOM 翻译）。
//     浏览器无 fs，故把词典预置成全局 window.__PM_SCRATCHPAD__（先于钩子执行）。词典缺失则告警跳过。
let scratchJs = [];
const spDictPath = path.join(ROOT, 'locales', 'scratchpad', lang + '.json');
const spHookPath = path.join(ROOT, 'pm-scratchpad-cn.js');
if (fs.existsSync(spDictPath) && fs.existsSync(spHookPath)) {
  let spDict = null;
  try {
    spDict = JSON.parse(fs.readFileSync(spDictPath, 'utf8'));
  } catch (e) {
    console.warn(`[跳过] Scratch Pad 词典解析失败: ${e.message}`);
  }
  if (spDict && typeof spDict === 'object' && Object.keys(spDict).length) {
    fs.writeFileSync(
      path.join(outDir, 'pm-scratchpad-data.js'),
      'window.__PM_SCRATCHPAD__ = ' + JSON.stringify(spDict) + ';\n',
      'utf8'
    );
    fs.copyFileSync(spHookPath, path.join(outDir, 'pm-scratchpad-cn.js'));
    scratchJs = ['pm-scratchpad-data.js', 'pm-scratchpad-cn.js'];
    console.log(`[完成] 已附带 Scratch Pad DOM 词典（${Object.keys(spDict).length} 条）`);
  }
} else {
  console.warn('[提示] 未找到 Scratch Pad 词典/钩子，扩展将不含 DOM 翻译（可先跑 build-scratchpad-dict.js）');
}

// 5) 生成 manifest.json（版本号取自 package.json）
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const manifest = {
  manifest_version: 3,
  name: 'Postman 中文注入',
  version: pkg.version || '1.0.0',
  description: '把中文翻译注入 Postman 网页版（go.postman.co 等），界面变中文。',
  content_scripts: [
    {
      matches: ['https://*.postman.co/*', 'https://*.getpostman.com/*', 'https://*.postman.com/*'],
      js: ['pm-i18n-data.js', 'pm-chinese.js'].concat(scratchJs),
      run_at: 'document_start',
      world: 'MAIN',
      all_frames: true
    }
  ]
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const dataKB = (Buffer.byteLength(dataJs) / 1024).toFixed(0);
console.log(`[完成] 扩展已生成: ${path.relative(ROOT, outDir)}（${count} 模块, 数据 ${dataKB} KB）`);

// 6) 打 zip（平台自适应，失败仅告警，不影响未打包目录）
try {
  let r;
  if (process.platform === 'win32') {
    // 用 PowerShell 的 Compress-Archive，把 extension 目录内容放到 zip 根
    r = spawnSync('powershell', [
      '-NoProfile', '-Command',
      `Compress-Archive -Path '${path.join(outDir, '*')}' -DestinationPath '${zipPath}' -Force`
    ], { stdio: 'inherit' });
  } else {
    // 用 zip -r，从目录内部打包，使文件位于 zip 根
    fs.rmSync(zipPath, { force: true });
    r = spawnSync('zip', ['-r', '-q', zipPath, '.'], { cwd: outDir, stdio: 'inherit' });
  }
  if (r.status === 0) {
    console.log(`[完成] 已打包: ${path.relative(ROOT, zipPath)}`);
  } else {
    console.warn('[提示] 自动打 zip 失败（可忽略）。直接用「加载已解压的扩展程序」指向上面的目录即可。');
  }
} catch (e) {
  console.warn('[提示] 未找到打包工具，跳过 zip。直接加载未打包目录即可。', e && e.message);
}

console.log('\n安装方法：Chrome/Edge 打开 chrome://extensions → 开启「开发者模式」→');
console.log(`「加载已解压的扩展程序」→ 选择 ${path.relative(ROOT, outDir)} 目录 → 刷新 Postman 网页版。`);
