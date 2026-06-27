#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * postman-chinese-injector.js —— 把汉化钩子注入 Postman 桌面端（跨平台 CLI）
 *
 * Electron 的资源解析顺序是「app.asar 存在则优先用 asar，忽略 app/ 文件夹」。本脚本：
 *
 *   1. 按平台自动定位 Postman 的 resources 目录（Windows / macOS / Linux）；
 *   2. 把 locales/zh-CN/*.json 合并成扁平 bundle（每个文件一个模块）；
 *   3. 首次运行时把原始 app.asar 备份为 app.asar.bak（之后始终从备份重新打补丁，
 *      保证幂等、且 Postman 更新后能干净重打）；
 *   4. 用 @electron/asar 解包备份 -> 临时目录（装了依赖走程序化 API，否则回退 npx）；
 *   5. 往 preload_desktop.js 注入一行 require('./pm-chinese.js')，放入 pm-chinese.js +
 *      生成的 pm-chinese-data.json；
 *   6. 打包临时目录 -> app.asar（覆盖）。
 *
 * 主窗口 webPreferences 为 contextIsolation=false + nodeIntegration=true，preload 与页面
 * 共享 main world 且先于页面脚本执行，故钩子能直接改 window.fetch 拦截语言包响应。
 *
 * 用法:
 *     node postman-chinese-injector.js                       # 注入简体中文（自动探测 Postman）
 *     node postman-chinese-injector.js --restore             # 还原
 *     node postman-chinese-injector.js --resources <dir>     # 直接指定含 app.asar 的目录
 *     node postman-chinese-injector.js --postman-dir <dir>   # 指定 Postman 安装根目录
 *     node postman-chinese-injector.js --app-version 12.16.1 # Windows 多版本时指定 app-<version>
 *
 * 装为全局命令后亦可：postman-chinese-injector [--restore ...]
 * 注入/还原前请先完全退出 Postman。macOS / Linux 的系统级安装可能需要 sudo。
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE_DIR = __dirname;
const HOOK_SRC = path.join(BASE_DIR, 'pm-chinese.js');
const LOCALES_DIR = path.join(BASE_DIR, 'locales');
const DEFAULT_LANG = 'zh-CN';
const DATA_NAME = 'pm-chinese-data.json'; // 注入时在 asar 内生成的 bundle 文件名

const BAK_SUFFIX = '.bak';
const MARK_START = '// === PM-I18N START ===';
const MARK_END = '// === PM-I18N END ===';
const INJECT_BLOCK =
  `\n${MARK_START}\n` +
  "try { require('./pm-chinese.js'); } catch (e) { console.error('[pm-chinese] load failed', e); }\n" +
  `${MARK_END}\n`;

// ---------- 小工具 ----------
function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}
function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (e) { return false; }
}
function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}
function toolVersion() {
  try { return require('./package.json').version; } catch (e) { return '0.0.0'; }
}

// ---------- asar 解包/打包：优先程序化 API，回退 npx ----------
function loadAsar() {
  try { return require('@electron/asar'); } catch (e) { return null; }
}
// 固定 @electron/asar@4（最新主版本，要求 Node >=22.12）。若需兼容更老 Node 可改回 @3。
const ASAR_PKG = '@electron/asar@4';
function runNpxAsar(...args) {
  const quoted = args.map((a) => `"${a}"`).join(' ');
  const res = spawnSync(`npx --yes ${ASAR_PKG} ${quoted}`, { stdio: 'inherit', shell: true });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`@electron/asar ${args[0]} 失败（exit ${res.status}）。请确认已安装 Node.js + npx，或先 npm install`);
  }
}
function asarExtract(archive, dest) {
  const asar = loadAsar();
  if (asar) return asar.extractAll(archive, dest);
  return runNpxAsar('extract', archive, dest);
}
async function asarPack(src, dest) {
  const asar = loadAsar();
  if (asar) return asar.createPackage(src, dest);
  return runNpxAsar('pack', src, dest);
}
// 只读检查用：列文件 / 读单文件（只走程序化 API；二进制内已内置）
function asarList(archive) {
  const asar = loadAsar();
  if (!asar) throw new Error('需要 @electron/asar 才能检查（请先 npm install，或用编译好的二进制）');
  return asar.listPackage(archive);
}
function asarReadFile(archive, name) {
  const asar = loadAsar();
  if (!asar) throw new Error('需要 @electron/asar 才能检查（请先 npm install，或用编译好的二进制）');
  return asar.extractFile(archive, name).toString('utf8');
}

// ---------- 从 locales/<lang>/*.json 构建注入用的扁平 bundle ----------
// 编译成单文件二进制时身边没有 locales/，改用编译期嵌入的 pm-chinese-data.json。
function loadEmbedded() {
  try { return require('./pm-chinese-data.json'); } catch (e) { return null; }
}

// 候选 locales 根目录（按优先级）：① 紧挨真正的可执行文件（允许在 exe 旁放 locales/ 覆盖
// 内嵌译文，无需重新编译）；② 源码同目录（node 开发模式）。都没有则用内嵌数据。
function localeRoots() {
  const roots = [];
  try { roots.push(path.join(path.dirname(process.execPath), 'locales')); } catch (e) { /* ignore */ }
  roots.push(LOCALES_DIR);
  return roots;
}

function buildBundle(lang) {
  let dir = null;
  for (const root of localeRoots()) {
    const d = path.join(root, lang);
    if (isDir(d)) { dir = d; break; }
  }
  if (!dir) {
    const emb = loadEmbedded();
    if (emb && typeof emb === 'object' && Object.keys(emb).length) {
      return { bundle: emb, count: Object.keys(emb).length, embedded: true };
    }
    throw new Error(`找不到语言目录 locales/${lang}/（且无内嵌数据）`);
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
  return { bundle, count, embedded: false, dir };
}

// ---------- 跨平台定位 Postman resources 目录 ----------
function cmpVer(a, b) {
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] - b[i]; }
  return 0;
}
function findLatestAppVersion(postmanDir) {
  if (!isDir(postmanDir)) return null;
  let best = null;
  for (const name of fs.readdirSync(postmanDir)) {
    const m = /^app-(\d+)\.(\d+)\.(\d+)/.exec(name);
    if (m && isDir(path.join(postmanDir, name))) {
      const v = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (best === null || cmpVer(v, best.v) > 0) best = { v, name };
    }
  }
  return best ? best.name : null;
}

// 返回候选 resources 目录列表（按优先级），调用方挑第一个含 app.asar / 备份的。
function candidateResourceDirs(opts) {
  if (opts.resources) return [expandHome(opts.resources)];

  const home = os.homedir();
  if (process.platform === 'win32') {
    const baseDir = expandHome(opts.postmanDir) || path.join(process.env.LOCALAPPDATA || '', 'Postman');
    const appName = opts.appVersion ? `app-${opts.appVersion}` : findLatestAppVersion(baseDir);
    return appName ? [path.join(baseDir, appName, 'resources')] : [];
  }

  if (process.platform === 'darwin') {
    const bases = opts.postmanDir
      ? [expandHome(opts.postmanDir)]
      : ['/Applications/Postman.app', path.join(home, 'Applications/Postman.app')];
    return bases.map((b) => (path.basename(b) === 'Resources' ? b : path.join(b, 'Contents', 'Resources')));
  }

  // linux 及其它
  const bases = opts.postmanDir
    ? [expandHome(opts.postmanDir)]
    : [
        '/opt/Postman/app/resources',
        '/usr/share/postman/resources',
        '/usr/lib/postman/resources',
        path.join(home, '.local/share/Postman/app/resources'),
        path.join(home, 'Postman/app/resources'),
        '/snap/postman/current/usr/share/postman/resources',
      ];
  // 对每个 base 同时尝试它本身、它的 resources / app/resources 子目录
  const out = [];
  for (const b of bases) {
    out.push(b, path.join(b, 'resources'), path.join(b, 'app', 'resources'));
  }
  return out;
}

function resolveResourcesDir(opts) {
  const cands = candidateResourceDirs(opts);
  for (const dir of cands) {
    if (isFile(path.join(dir, 'app.asar')) || isFile(path.join(dir, 'app.asar' + BAK_SUFFIX))) {
      return dir;
    }
  }
  const looked = cands.length ? cands.map((c) => '  - ' + c).join('\n') : '  （无候选，未找到安装）';
  throw new Error(
    `找不到 Postman 的 app.asar。已尝试:\n${looked}\n` +
    `请用 --resources <含 app.asar 的目录> 或 --postman-dir <安装根目录> 指定。`
  );
}

// ---------- 注入 / 还原 ----------
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripBlock(text) {
  const re = new RegExp(escapeRe(MARK_START) + '[\\s\\S]*?' + escapeRe(MARK_END) + '\\n?', 'g');
  return text.replace(re, '');
}

async function patch(resourcesDir, lang) {
  const asar = path.join(resourcesDir, 'app.asar');
  const bak = asar + BAK_SUFFIX;
  if (!isFile(asar) && !isFile(bak)) throw new Error(`找不到 app.asar: ${resourcesDir}`);

  if (!isFile(HOOK_SRC)) throw new Error(`缺少 ${HOOK_SRC}`);

  // 0) 从 locales/<lang>/ 构建注入数据（二进制无 locales 时用内嵌数据）
  const { bundle, count, embedded } = buildBundle(lang);
  console.log(`[构建] ${embedded ? '内嵌数据' : 'locales/' + lang + '/'} -> ${DATA_NAME}（${count} 模块）`);

  // 1) 确保有 pristine 备份，且始终从备份打补丁
  if (!isFile(bak)) {
    fs.copyFileSync(asar, bak);
    console.log(`[备份] app.asar -> ${path.basename(bak)}`);
  } else {
    console.log(`[备份] 已存在，使用 ${path.basename(bak)} 作为打补丁源`);
  }

  // 2) 从备份解包到临时目录
  const staging = path.join(resourcesDir, 'app_pm_chinese_build');
  if (isDir(staging)) fs.rmSync(staging, { recursive: true, force: true });
  console.log(`[解包] ${path.basename(bak)} -> 临时目录`);
  asarExtract(bak, staging);

  // 3) 注入 preload + 放入钩子与数据
  const preload = path.join(staging, 'preload_desktop.js');
  if (!isFile(preload)) throw new Error('解包后找不到 preload_desktop.js');
  let content = stripBlock(fs.readFileSync(preload, 'utf8'));
  content = content.replace(/\n+$/, '') + '\n' + INJECT_BLOCK;
  fs.writeFileSync(preload, content, 'utf8');
  console.log("[注入] preload_desktop.js <- require('./pm-chinese.js')");
  fs.copyFileSync(HOOK_SRC, path.join(staging, 'pm-chinese.js'));
  fs.writeFileSync(path.join(staging, DATA_NAME), JSON.stringify(bundle), 'utf8');
  console.log(`[写入] pm-chinese.js + ${DATA_NAME}`);

  // 4) 打包回 app.asar
  console.log('[打包] 临时目录 -> app.asar');
  await asarPack(staging, asar);
  fs.rmSync(staging, { recursive: true, force: true });
  console.log('\n[成功] 已重打包 app.asar。完全退出并重启 Postman；');
  console.log('       界面出现中文即生效。');
}

function restore(resourcesDir) {
  const asar = path.join(resourcesDir, 'app.asar');
  const bak = asar + BAK_SUFFIX;
  if (!isFile(bak)) {
    console.log('[还原] 找不到备份，无需还原');
    return;
  }
  fs.copyFileSync(bak, asar);
  console.log(`[还原] 已用 ${path.basename(bak)} 覆盖回 app.asar`);
  console.log('       （备份保留；如需彻底清理可手动删除）');
}

// 检查目标 asar 是否已被注入，打印结论（只读，不改动）
function status(resourcesDir) {
  const asar = path.join(resourcesDir, 'app.asar');
  const bak = asar + BAK_SUFFIX;
  if (!isFile(asar)) {
    console.log('  app.asar: 不存在');
    console.log('\n[结论] 未注入 ✗');
    return;
  }
  console.log(`  备份 ${path.basename(bak)}: ${isFile(bak) ? '有（注入过至少一次）' : '无'}`);

  let hasHook = false, hasData = false, injected = false, count = null;
  try {
    const files = asarList(asar);
    hasHook = files.some((f) => /(^|[\\/])pm-chinese\.js$/.test(f));
    hasData = files.some((f) => /(^|[\\/])pm-chinese-data\.json$/.test(f));
  } catch (e) {
    console.log('  无法读取 asar 内容:', e.message);
  }
  try {
    injected = /require\((['"])\.\/pm-chinese\.js\1\)/.test(asarReadFile(asar, 'preload_desktop.js'));
  } catch (e) { /* preload 缺失则视为未注入 */ }
  if (hasData) {
    try { count = Object.keys(JSON.parse(asarReadFile(asar, 'pm-chinese-data.json'))).length; } catch (e) { /* ignore */ }
  }

  console.log(`  pm-chinese.js 在 asar 内: ${hasHook ? '是' : '否'}`);
  console.log(`  pm-chinese-data.json 在 asar 内: ${hasData ? '是' : '否'}${count != null ? `（${count} 模块）` : ''}`);
  console.log(`  preload 注入行 require('./pm-chinese.js'): ${injected ? '有' : '无'}`);

  const ok = hasHook && hasData && injected;
  console.log(
    ok
      ? '\n[结论] 已注入 ✓　重启 Postman，界面应变中文；Console 会打印 [pm-chinese] 已注入'
      : '\n[结论] 未注入 ✗　运行（不带参数）即可注入：postman-chinese-injector'
  );
}

// ---------- CLI ----------
function printHelp() {
  console.log(`postman-chinese-injector —— 把中文注入 Postman 桌面端（跨平台）

用法:
  postman-chinese-injector [选项]   # 或 node postman-chinese-injector.js [选项]

选项:
  --status                  检查目标是否已注入（只读，不改动），打印结论
  --restore                 还原注入（用备份覆盖回 app.asar）
  --resources <dir>         直接指定含 app.asar 的目录（跳过自动探测）
  --postman-dir <dir>       指定 Postman 安装根目录
  --app-version <v>         Windows 多版本共存时指定 app-<version>（默认最新）
  -v, --version             显示本工具版本
  -h, --help                显示帮助

平台默认探测位置:
  Windows  %LOCALAPPDATA%\\Postman\\app-<version>\\resources
  macOS    /Applications/Postman.app/Contents/Resources（及 ~/Applications）
  Linux    /opt/Postman/app/resources 等常见位置

注入/还原前请先完全退出 Postman。macOS / Linux 的系统级安装可能需要 sudo。`);
}

function parseArgs(argv) {
  const opts = { postmanDir: null, resources: null, appVersion: null, restore: false, status: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--restore') opts.restore = true;
    else if (a === '--status') opts.status = true;
    else if (a === '--resources') opts.resources = argv[++i];
    else if (a === '--postman-dir') opts.postmanDir = argv[++i];
    else if (a === '--app-version') opts.appVersion = argv[++i];
    else if (a === '-v' || a === '--version') { console.log(toolVersion()); process.exit(0); }
    else if (a === '-h' || a === '--help') { printHelp(); process.exit(0); }
    else { console.error(`[错误] 未知参数: ${a}（用 --help 查看用法）`); process.exit(2); }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const resourcesDir = resolveResourcesDir(opts);
  console.log(`[目标] ${resourcesDir}`);
  if (opts.status) status(resourcesDir);
  else if (opts.restore) restore(resourcesDir);
  else await patch(resourcesDir, DEFAULT_LANG);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`[错误] ${e.message}`);
    process.exit(1);
  });
}
