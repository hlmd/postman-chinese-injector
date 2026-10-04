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
 * Electron 的资源解析顺序是「app.asar 存在则优先用 asar，否则退而加载未打包的 resources/app/」。
 * 本脚本两种安装形态都支持，自动判别：
 *
 *   1. 按平台自动定位 Postman 的 resources 目录（Windows / macOS / Linux）；
 *   2. 把 locales/zh-CN/*.json 合并成扁平 bundle（每个文件一个模块）；
 *
 *   【app.asar 型】
 *   3a. 首次运行时把原始 app.asar 备份为 app.asar.bak（之后始终从备份重新打补丁，
 *       保证幂等、且 Postman 更新后能干净重打）；
 *   4a. 用 @electron/asar 解包备份 -> 临时目录（装了依赖走程序化 API，否则回退 npx）；
 *   5a. 往渲染进程 preload 注入一行 require('./pm-chinese.js')，钩子 + 数据放在 preload 同目录；
 *       preload 路径随版本而异：新版为根目录 preload_desktop.js，老版(10.24)为 preload/desktop/index.js；
 *   6a. 打包临时目录 -> app.asar（覆盖）。
 *
 *   【未打包 app/ 型】（没有 app.asar，只有 resources/app/ 目录）
 *   3b. 首次运行时把渲染进程 preload 备份为 <preload>.bak（始终从备份打补丁）；
 *   4b. 直接往该 preload 注入 require('./pm-chinese.js')，并把 pm-chinese.js +
 *       pm-chinese-data.json 写到 preload 同目录——无需解包/打包。
 *
 * 主窗口 webPreferences 为 contextIsolation=false + nodeIntegration=true，preload 与页面
 * 共享 main world 且先于页面脚本执行，故钩子能直接改 window.fetch 拦截语言包响应。
 *
 * 用法:
 *     node postman-chinese-injector.js                       # 注入简体中文（自动探测 Postman）
 *     node postman-chinese-injector.js --restore             # 还原
 *     node postman-chinese-injector.js --resources <dir>     # 直接指定含 app.asar 或 app/ 的目录
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
const updater = require('./updater');

const BASE_DIR = __dirname;
const HOOK_SRC = path.join(BASE_DIR, 'pm-chinese.js');
const LOCALES_DIR = path.join(BASE_DIR, 'locales');
const DEFAULT_LANG = 'zh-CN';
const DATA_NAME = 'pm-chinese-data.json'; // 注入时在 asar 内生成的 bundle 文件名
const SCRATCH_HOOK_NAME = 'pm-scratchpad-cn.js';
const SCRATCH_HOOK_SRC = path.join(BASE_DIR, SCRATCH_HOOK_NAME);
const SCRATCH_DATA_NAME = 'pm-scratchpad-data.json';
const MAIN_HOOK_NAME = 'pm-main-cn.js';
const MAIN_HOOK_SRC = path.join(BASE_DIR, MAIN_HOOK_NAME);
const MAIN_DATA_NAME = 'pm-main-data.json';
const MAIN_ENTRY = 'main.js'; // 主进程入口（package.json 的 main）

const BAK_SUFFIX = '.bak';
const MARK_START = '// === PM-I18N START ===';
const MARK_END = '// === PM-I18N END ===';
// 钩子按「preload 所在目录」解析：真正的 preload（webPreferences.preload）里 require('./x') 即相对本文件；
// 但 Postman 7.x 的 js/preload.js 是 HTML 用 <script> 加载的，那里 require 相对的是页面目录 html/，
// 故优先用 document.currentScript 定位本脚本所在目录。
const INJECT_BLOCK =
  `\n${MARK_START}\n` +
  '(function () {\n' +
  "  var pmDir = null;\n" +
  "  try {\n" +
  "    var cs = typeof document !== 'undefined' && document.currentScript;\n" +
  "    if (cs && /^file:/.test(cs.src)) pmDir = require('path').dirname(require('url').fileURLToPath(cs.src));\n" +
  "  } catch (e) { /* ignore，回落到相对 require */ }\n" +
  "  function pmRequire(name) { return pmDir ? require(require('path').join(pmDir, name)) : require('./' + name); }\n" +
  "  try { pmRequire('pm-chinese.js'); } catch (e) { console.error('[pm-chinese] load failed', e); }\n" +
  "  try { pmRequire('pm-scratchpad-cn.js'); } catch (e) { console.error('[pm-scratchpad] load failed', e); }\n" +
  '})();\n' +
  `${MARK_END}\n`;
// 主进程入口的注入块：须插在 main.js 最前面，赶在 Postman 建菜单之前包装好 Menu
const MAIN_INJECT_BLOCK =
  `${MARK_START}\n` +
  "try { require('./pm-main-cn.js'); } catch (e) { console.error('[pm-main] load failed', e); }\n" +
  `${MARK_END}\n`;

// ---------- 小工具 ----------
function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}
function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (e) { return false; }
}
// 渲染进程 preload 在不同 Postman 版本里的相对路径（按优先级排序）：
//   新版        -> preload_desktop.js（根目录）
//   老版(10.24) -> preload/desktop/index.js（见 windowManager.js 的 webPreferences.preload）
//   7.x         -> js/preload.js（没有 webPreferences.preload；窗口开 nodeIntegration，各 html 页用 <script> 加载它）
// 注意：根目录还有个主进程用的 preload.js，不能误选，故只匹配这份明确清单。
const PRELOAD_CANDIDATES = ['preload_desktop.js', path.join('preload', 'desktop', 'index.js'), path.join('js', 'preload.js')];
// 在 root（解包后的 staging 或未打包 app/）里定位渲染进程 preload，找不到返回 null。
function findPreloadIn(root) {
  for (const rel of PRELOAD_CANDIDATES) {
    const p = path.join(root, rel);
    if (isFile(p)) return p;
  }
  return null;
}
// 未打包 app/ 型定位 preload：优先现存文件；preload 被删但 .bak 还在时，从 .bak 反推。
function resolveDirPreload(appDir) {
  const found = findPreloadIn(appDir);
  if (found) return found;
  for (const rel of PRELOAD_CANDIDATES) {
    const p = path.join(appDir, rel);
    if (isFile(p + BAK_SUFFIX)) return p;
  }
  return null;
}
// 在 asar 文件清单里定位渲染进程 preload，返回可直接喂给 extractFile 的内部路径，找不到返回 null。
// 注意 @electron/asar 在 Windows 上：listPackage 返回带前导分隔符的原生路径（如 \preload\desktop\index.js），
// 而 extractFile 只认「去掉前导分隔符、保留原生分隔符」的形式（如 preload\desktop\index.js）。
function findPreloadInAsar(files) {
  const key = (s) => s.replace(/\\/g, '/').replace(/^\/+/, ''); // 归一化用于比较
  for (const rel of PRELOAD_CANDIDATES) {
    const want = key(rel);
    for (const f of files) {
      if (key(f) === want) return f.replace(/^[\\/]+/, ''); // 保留原生分隔符，仅去前导
    }
  }
  return null;
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

// ---------- 在线译文数据包（见 updater.js）----------
// 注入前由 prepareRemoteData() 填充；各取数函数的优先级：exe 旁 / 源码旁的本地文件 > 在线数据包 > 内嵌快照。
let remoteData = null;

function loadEmbeddedMeta() {
  try { return require('./pm-build-meta.json'); } catch (e) { return null; }
}

// 身边有 locales/<lang>/（源码模式或 exe 旁手动覆盖）时以本地为准，不联网取译文
function hasLocalLocales(lang) {
  return localeRoots().some((root) => isDir(path.join(root, lang)));
}

async function prepareRemoteData(opts, lang) {
  if (hasLocalLocales(lang)) return;
  const meta = loadEmbeddedMeta();
  remoteData = await updater.resolveDataBundle({ embeddedAt: meta && meta.committedAt, offline: opts.offline });
  if (remoteData) console.log(`[更新] 使用在线译文（来源 ${remoteData.from}，提交于 ${remoteData.committedAt}）`);
}

const REMOTE_FROM = () => `在线数据包（${remoteData.from}）`;

// ---------- 从 locales/<lang>/*.json 构建注入用的扁平 bundle ----------
// 编译成单文件二进制时身边没有 locales/，改用编译期嵌入的 pm-chinese-data.json。
function loadEmbedded() {
  try { return require('./pm-chinese-data.json'); } catch (e) { return null; }
}

// 注入用的钩子源码：编译成单文件二进制时 __dirname 指向编译机路径（如 /home/runner/...），
// 身边没有 pm-chinese.js，改用编译期嵌入的 pm-chinese-src.json。
function loadEmbeddedHook() {
  try { return require('./pm-chinese-src.json').src || null; } catch (e) { return null; }
}

// 取钩子源码（按优先级）：① exe 旁的 pm-chinese.js（允许覆盖内嵌，无需重编译）；
// ② 源码同目录（node 开发模式）；都没有则用编译期内嵌的快照。
function hookSource() {
  const cands = [];
  try { cands.push(path.join(path.dirname(process.execPath), 'pm-chinese.js')); } catch (e) { /* ignore */ }
  cands.push(HOOK_SRC);
  for (const p of cands) {
    if (isFile(p)) return { src: fs.readFileSync(p, 'utf8'), from: p };
  }
  if (remoteData) return { src: remoteData.hook, from: REMOTE_FROM() };
  const emb = loadEmbeddedHook();
  if (emb) return { src: emb, from: '内嵌快照' };
  throw new Error(`缺少钩子源码 pm-chinese.js（已尝试: ${cands.join('、')}，且无内嵌快照）`);
}

// Scratch Pad 钩子源码（编译后取内嵌快照，逻辑同 hookSource）
function loadEmbeddedScratchpadHook() {
  try { return require('./pm-scratchpad-src.json').src || null; } catch (e) { return null; }
}
function scratchpadHookSource() {
  const cands = [];
  try { cands.push(path.join(path.dirname(process.execPath), SCRATCH_HOOK_NAME)); } catch (e) { /* ignore */ }
  cands.push(SCRATCH_HOOK_SRC);
  for (const p of cands) {
    if (isFile(p)) return { src: fs.readFileSync(p, 'utf8'), from: p };
  }
  if (remoteData && remoteData.scratchpadHook) return { src: remoteData.scratchpadHook, from: REMOTE_FROM() };
  const emb = loadEmbeddedScratchpadHook();
  if (emb) return { src: emb, from: '内嵌快照' };
  throw new Error(`缺少 Scratch Pad 钩子源码 ${SCRATCH_HOOK_NAME}（且无内嵌快照）`);
}

// Scratch Pad 词典：① locales/scratchpad/zh-CN.json（exe 旁或源码旁）；② 内嵌快照
function loadEmbeddedScratchpadDict() {
  try { return require('./pm-scratchpad-data.json'); } catch (e) { return null; }
}
function loadScratchpadDict() {
  for (const root of localeRoots()) {
    const p = path.join(root, 'scratchpad', 'zh-CN.json');
    if (isFile(p)) {
      try { return { dict: JSON.parse(fs.readFileSync(p, 'utf8')), from: p }; } catch (e) { /* 坏文件则继续 */ }
    }
  }
  if (remoteData && remoteData.scratchpadDict) return { dict: remoteData.scratchpadDict, from: REMOTE_FROM() };
  const emb = loadEmbeddedScratchpadDict();
  if (emb && typeof emb === 'object' && Object.keys(emb).length) return { dict: emb, from: '内嵌快照' };
  throw new Error('缺少 Scratch Pad 词典（locales/scratchpad/zh-CN.json 或内嵌快照）');
}

// 主进程钩子源码 / 词典（逻辑同 Scratch Pad）
function loadEmbeddedMainHook() {
  try { return require('./pm-main-src.json').src || null; } catch (e) { return null; }
}
function mainHookSource() {
  const cands = [];
  try { cands.push(path.join(path.dirname(process.execPath), MAIN_HOOK_NAME)); } catch (e) { /* ignore */ }
  cands.push(MAIN_HOOK_SRC);
  for (const p of cands) {
    if (isFile(p)) return { src: fs.readFileSync(p, 'utf8'), from: p };
  }
  if (remoteData) return { src: remoteData.mainHook, from: REMOTE_FROM() };
  const emb = loadEmbeddedMainHook();
  if (emb) return { src: emb, from: '内嵌快照' };
  throw new Error(`缺少主进程钩子源码 ${MAIN_HOOK_NAME}（且无内嵌快照）`);
}
function loadEmbeddedMainDict() {
  try { return require('./pm-main-data.json'); } catch (e) { return null; }
}
function loadMainDict() {
  for (const root of localeRoots()) {
    const p = path.join(root, 'main', 'zh-CN.json');
    if (isFile(p)) {
      try { return { dict: JSON.parse(fs.readFileSync(p, 'utf8')), from: p }; } catch (e) { /* 坏文件则继续 */ }
    }
  }
  if (remoteData) return { dict: remoteData.mainDict, from: REMOTE_FROM() };
  const emb = loadEmbeddedMainDict();
  if (emb && typeof emb === 'object' && Object.keys(emb).length) return { dict: emb, from: '内嵌快照' };
  throw new Error('缺少主进程词典（locales/main/zh-CN.json 或内嵌快照）');
}

// 把注入块插到 main.js 最前面（若有 'use strict' 指令则插在其后，免得破坏严格模式）
function injectMainEntry(text) {
  const clean = stripBlock(text);
  const m = /^(\s*(['"])use strict\2;?[ \t]*\r?\n?)/.exec(clean);
  return m ? m[1] + MAIN_INJECT_BLOCK + clean.slice(m[1].length) : MAIN_INJECT_BLOCK + clean;
}

// 在 appRoot 写入注入后的 main.js + 主进程钩子与词典；entrySrc 为干净的 main.js 原文
function writeMainHook(appRoot, mainHook, mainDict, entrySrc) {
  fs.writeFileSync(path.join(appRoot, MAIN_ENTRY), injectMainEntry(entrySrc), 'utf8');
  fs.writeFileSync(path.join(appRoot, MAIN_HOOK_NAME), mainHook.src, 'utf8');
  fs.writeFileSync(path.join(appRoot, MAIN_DATA_NAME), JSON.stringify(mainDict.dict), 'utf8');
  console.log(`[注入] ${MAIN_ENTRY} <- require('./${MAIN_HOOK_NAME}')（原生菜单，${Object.keys(mainDict.dict).length} 条）`);
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
    if (remoteData) return { bundle: remoteData.data, count: Object.keys(remoteData.data).length, source: REMOTE_FROM() };
    const emb = loadEmbedded();
    if (emb && typeof emb === 'object' && Object.keys(emb).length) {
      return { bundle: emb, count: Object.keys(emb).length, source: '内嵌数据' };
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
  return { bundle, count, source: `locales/${lang}/`, dir };
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

// 把一个 resources 目录归类成注入目标：
//   - 'asar' 型：目录里有 app.asar（或其备份）——走解包/打包流程；
//   - 'dir'  型：没有 app.asar，但有未打包的 app/ 目录（Electron 退而加载 resources/app/）——直接改文件。
// app.asar 与 app/ 同时存在时 Electron 优先用 asar，故先判 asar。
function classifyResourceDir(dir) {
  const asar = path.join(dir, 'app.asar');
  const bak = asar + BAK_SUFFIX;
  if (isFile(asar) || isFile(bak)) {
    return { resourcesDir: dir, kind: 'asar', asar, bak };
  }
  const appDir = path.join(dir, 'app');
  const preload = path.join(appDir, 'preload_desktop.js');
  if (isFile(preload) || isFile(preload + BAK_SUFFIX)) {
    return { resourcesDir: dir, kind: 'dir', appDir };
  }
  return null;
}

function resolveTarget(opts) {
  const cands = candidateResourceDirs(opts);
  for (const dir of cands) {
    const t = classifyResourceDir(dir);
    if (t) return t;
  }
  const looked = cands.length ? cands.map((c) => '  - ' + c).join('\n') : '  （无候选，未找到安装）';
  throw new Error(
    `找不到 Postman 的 app.asar 或未打包的 app/ 目录。已尝试:\n${looked}\n` +
    `请用 --resources <含 app.asar 或 app/ 的目录> 或 --postman-dir <安装根目录> 指定。`
  );
}

// ---------- 注入 / 还原 ----------
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripBlock(text) {
  const re = new RegExp(escapeRe(MARK_START) + '[\\s\\S]*?' + escapeRe(MARK_END) + '\\n?', 'g');
  return text.replace(re, '');
}

async function patch(target, lang) {
  return target.kind === 'asar' ? patchAsar(target, lang) : patchDir(target, lang);
}

async function patchAsar(target, lang) {
  const { resourcesDir, asar, bak } = target;
  if (!isFile(asar) && !isFile(bak)) throw new Error(`找不到 app.asar: ${resourcesDir}`);

  // 提前解析钩子源码（二进制内嵌 / 源码同目录），缺失则在改动任何文件前就失败
  const hook = hookSource();
  const spHook = scratchpadHookSource();
  const spDict = loadScratchpadDict();
  const mainHook = mainHookSource();
  const mainDict = loadMainDict();

  // 0) 从 locales/<lang>/ 构建注入数据（二进制无 locales 时用内嵌数据）
  const { bundle, count, source } = buildBundle(lang);
  console.log(`[构建] ${source} -> ${DATA_NAME}（${count} 模块）`);

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

  // 3) 注入 preload + 放入钩子与数据（钩子/数据须与 preload 同目录，
  //    因为注入行 require('./pm-chinese.js') 与钩子内 __dirname 都相对 preload 所在目录解析）
  const preload = findPreloadIn(staging);
  if (!preload) {
    throw new Error(`解包后找不到渲染进程 preload（找过：${PRELOAD_CANDIDATES.join('、')}）`);
  }
  const preloadDir = path.dirname(preload);
  const preloadRel = path.relative(staging, preload).replace(/\\/g, '/');
  let content = stripBlock(fs.readFileSync(preload, 'utf8'));
  content = content.replace(/\n+$/, '') + '\n' + INJECT_BLOCK;
  fs.writeFileSync(preload, content, 'utf8');
  console.log(`[注入] ${preloadRel} <- require('./pm-chinese.js')`);
  fs.writeFileSync(path.join(preloadDir, 'pm-chinese.js'), hook.src, 'utf8');
  fs.writeFileSync(path.join(preloadDir, DATA_NAME), JSON.stringify(bundle), 'utf8');
  console.log(`[写入] pm-chinese.js + ${DATA_NAME}`);
  fs.writeFileSync(path.join(preloadDir, SCRATCH_HOOK_NAME), spHook.src, 'utf8');
  fs.writeFileSync(path.join(preloadDir, SCRATCH_DATA_NAME), JSON.stringify(spDict.dict), 'utf8');
  console.log(`[写入] ${SCRATCH_HOOK_NAME} + ${SCRATCH_DATA_NAME}（${Object.keys(spDict.dict).length} 条）`);

  // 3.5) 主进程入口注入原生菜单钩子（钩子/词典与 main.js 同目录）
  const stagedEntry = path.join(staging, MAIN_ENTRY);
  if (!isFile(stagedEntry)) throw new Error(`解包后找不到主进程入口 ${MAIN_ENTRY}`);
  writeMainHook(staging, mainHook, mainDict, fs.readFileSync(stagedEntry, 'utf8'));

  // 4) 打包回 app.asar
  console.log('[打包] 临时目录 -> app.asar');
  await asarPack(staging, asar);
  fs.rmSync(staging, { recursive: true, force: true });
  console.log('\n[成功] 已重打包 app.asar。完全退出并重启 Postman；');
  console.log('       界面出现中文即生效。');
}

// 未打包（resources/app/）型：没有 asar 可解包/打包，直接改目录里的文件。
// 只改 preload_desktop.js（备份为 .bak，始终从备份打补丁以幂等），并放入钩子与数据。
async function patchDir(target, lang) {
  const { appDir } = target;
  const preload = resolveDirPreload(appDir);
  if (!preload) throw new Error(`找不到渲染进程 preload（找过：${PRELOAD_CANDIDATES.join('、')}）: ${appDir}`);
  const bak = preload + BAK_SUFFIX;
  const preloadDir = path.dirname(preload);
  const preloadRel = path.relative(appDir, preload).replace(/\\/g, '/');

  // 提前解析钩子源码，缺失则在改动任何文件前就失败
  const hook = hookSource();
  const spHook = scratchpadHookSource();
  const spDict = loadScratchpadDict();
  const mainHook = mainHookSource();
  const mainDict = loadMainDict();

  // 0) 构建注入数据
  const { bundle, count, source } = buildBundle(lang);
  console.log(`[构建] ${source} -> ${DATA_NAME}（${count} 模块）`);

  // 1) 确保有 pristine 备份（剥掉可能已存在的注入块，保证备份干净），且始终从备份打补丁
  if (!isFile(bak)) {
    if (!isFile(preload)) throw new Error(`找不到 ${preloadRel}: ${appDir}`);
    fs.writeFileSync(bak, stripBlock(fs.readFileSync(preload, 'utf8')), 'utf8');
    console.log(`[备份] ${preloadRel} -> ${path.basename(bak)}`);
  } else {
    console.log(`[备份] 已存在，使用 ${path.basename(bak)} 作为打补丁源`);
  }

  // 2) 从备份注入到 preload
  let content = stripBlock(fs.readFileSync(bak, 'utf8'));
  content = content.replace(/\n+$/, '') + '\n' + INJECT_BLOCK;
  fs.writeFileSync(preload, content, 'utf8');
  console.log(`[注入] ${preloadRel} <- require('./pm-chinese.js')`);

  // 3) 放入钩子与数据（与 preload 同目录，因 require('./pm-chinese.js') 与 __dirname 都相对 preload 解析）
  fs.writeFileSync(path.join(preloadDir, 'pm-chinese.js'), hook.src, 'utf8');
  fs.writeFileSync(path.join(preloadDir, DATA_NAME), JSON.stringify(bundle), 'utf8');
  console.log(`[写入] pm-chinese.js + ${DATA_NAME}`);
  fs.writeFileSync(path.join(preloadDir, SCRATCH_HOOK_NAME), spHook.src, 'utf8');
  fs.writeFileSync(path.join(preloadDir, SCRATCH_DATA_NAME), JSON.stringify(spDict.dict), 'utf8');
  console.log(`[写入] ${SCRATCH_HOOK_NAME} + ${SCRATCH_DATA_NAME}（${Object.keys(spDict.dict).length} 条）`);

  // 4) 主进程入口：同样备份为 main.js.bak 并始终从备份注入
  const entry = path.join(appDir, MAIN_ENTRY);
  const entryBak = entry + BAK_SUFFIX;
  if (!isFile(entryBak)) {
    if (!isFile(entry)) throw new Error(`找不到主进程入口 ${MAIN_ENTRY}: ${appDir}`);
    fs.writeFileSync(entryBak, stripBlock(fs.readFileSync(entry, 'utf8')), 'utf8');
    console.log(`[备份] ${MAIN_ENTRY} -> ${path.basename(entryBak)}`);
  }
  writeMainHook(appDir, mainHook, mainDict, fs.readFileSync(entryBak, 'utf8'));

  console.log('\n[成功] 已注入未打包的 app/ 目录。完全退出并重启 Postman；');
  console.log('       界面出现中文即生效。');
}

function restore(target) {
  return target.kind === 'asar' ? restoreAsar(target) : restoreDir(target);
}

function restoreAsar(target) {
  const { asar, bak } = target;
  if (!isFile(bak)) {
    console.log('[还原] 找不到备份，无需还原');
    return;
  }
  fs.copyFileSync(bak, asar);
  console.log(`[还原] 已用 ${path.basename(bak)} 覆盖回 app.asar`);
  console.log('       （备份保留；如需彻底清理可手动删除）');
}

function restoreDir(target) {
  const { appDir } = target;
  const preload = resolveDirPreload(appDir) || path.join(appDir, PRELOAD_CANDIDATES[0]);
  const preloadDir = path.dirname(preload);
  const preloadRel = path.relative(appDir, preload).replace(/\\/g, '/');
  const bak = preload + BAK_SUFFIX;
  let did = false;
  if (isFile(bak)) {
    fs.copyFileSync(bak, preload);
    console.log(`[还原] 已用 ${path.basename(bak)} 覆盖回 ${preloadRel}`);
    did = true;
  } else if (isFile(preload)) {
    // 没备份则就地剥掉注入块
    const cleaned = stripBlock(fs.readFileSync(preload, 'utf8'));
    if (cleaned !== fs.readFileSync(preload, 'utf8')) {
      fs.writeFileSync(preload, cleaned, 'utf8');
      console.log(`[还原] 无备份，已就地移除 ${preloadRel} 中的注入块`);
      did = true;
    }
  }
  // 删除注入的钩子与数据文件（与 preload 同目录）
  for (const f of ['pm-chinese.js', DATA_NAME, SCRATCH_HOOK_NAME, SCRATCH_DATA_NAME]) {
    const p = path.join(preloadDir, f);
    if (isFile(p)) { fs.rmSync(p, { force: true }); console.log(`[还原] 删除 ${f}`); did = true; }
  }
  // 主进程入口：用 main.js.bak 覆盖回，并删除主进程钩子与词典
  const entry = path.join(appDir, MAIN_ENTRY);
  if (isFile(entry + BAK_SUFFIX)) {
    fs.copyFileSync(entry + BAK_SUFFIX, entry);
    console.log(`[还原] 已用 ${MAIN_ENTRY}${BAK_SUFFIX} 覆盖回 ${MAIN_ENTRY}`);
    did = true;
  } else if (isFile(entry)) {
    const raw = fs.readFileSync(entry, 'utf8');
    const cleaned = stripBlock(raw);
    if (cleaned !== raw) { fs.writeFileSync(entry, cleaned, 'utf8'); console.log(`[还原] 已移除 ${MAIN_ENTRY} 中的注入块`); did = true; }
  }
  for (const f of [MAIN_HOOK_NAME, MAIN_DATA_NAME]) {
    const p = path.join(appDir, f);
    if (isFile(p)) { fs.rmSync(p, { force: true }); console.log(`[还原] 删除 ${f}`); did = true; }
  }
  if (!did) console.log('[还原] 未发现注入痕迹，无需还原');
  else console.log('       （备份保留；如需彻底清理可手动删除）');
}

// 检查目标是否已被注入，打印结论（只读，不改动）
function status(target) {
  const { resourcesDir } = target;
  console.log(`  类型: ${target.kind === 'asar' ? 'app.asar（已打包）' : '未打包 app/ 目录'}`);
  return target.kind === 'asar' ? statusAsar(target) : statusDir(target);
}

function statusDir(target) {
  const { appDir } = target;
  const preload = resolveDirPreload(appDir) || path.join(appDir, PRELOAD_CANDIDATES[0]);
  const preloadDir = path.dirname(preload);
  const bak = preload + BAK_SUFFIX;
  const hookPath = path.join(preloadDir, 'pm-chinese.js');
  const dataPath = path.join(preloadDir, DATA_NAME);

  console.log(`  备份 ${path.basename(bak)}: ${isFile(bak) ? '有（注入过至少一次）' : '无'}`);

  const hasHook = isFile(hookPath);
  const hasData = isFile(dataPath);
  const hasScratch = isFile(path.join(preloadDir, SCRATCH_HOOK_NAME));
  let count = null, injected = false;
  if (hasData) {
    try { count = Object.keys(JSON.parse(fs.readFileSync(dataPath, 'utf8'))).length; } catch (e) { /* ignore */ }
  }
  try {
    injected = /require\((['"])\.\/pm-chinese\.js\1\)/.test(fs.readFileSync(preload, 'utf8'));
  } catch (e) { /* preload 缺失则视为未注入 */ }

  console.log(`  pm-chinese.js 在 app/ 内: ${hasHook ? '是' : '否'}`);
  console.log(`  pm-chinese-data.json 在 app/ 内: ${hasData ? '是' : '否'}${count != null ? `（${count} 模块）` : ''}`);
  console.log(`  Scratch Pad 钩子在 app/ 内: ${hasScratch ? '是' : '否'}`);
  let mainInjected = false;
  try { mainInjected = fs.readFileSync(path.join(appDir, MAIN_ENTRY), 'utf8').includes(`require('./${MAIN_HOOK_NAME}')`); } catch (e) { /* ignore */ }
  console.log(`  原生菜单钩子（${MAIN_ENTRY}）: ${mainInjected && isFile(path.join(appDir, MAIN_HOOK_NAME)) ? '已注入' : '未注入'}`);
  console.log(`  preload 注入行 require('./pm-chinese.js'): ${injected ? '有' : '无'}`);

  const ok = hasHook && hasData && injected;
  console.log(
    ok
      ? '\n[结论] 已注入 ✓　重启 Postman，界面应变中文；Console 会打印 [pm-chinese] 已注入'
      : '\n[结论] 未注入 ✗　运行（不带参数）即可注入：postman-chinese-injector'
  );
}

function statusAsar(target) {
  const { asar, bak } = target;
  if (!isFile(asar)) {
    console.log('  app.asar: 不存在');
    console.log('\n[结论] 未注入 ✗');
    return;
  }
  console.log(`  备份 ${path.basename(bak)}: ${isFile(bak) ? '有（注入过至少一次）' : '无'}`);

  let hasHook = false, hasData = false, injected = false, count = null, preloadRel = null;
  let hasScratch = false, hasMain = false;
  try {
    const files = asarList(asar);
    hasHook = files.some((f) => /(^|[\\/])pm-chinese\.js$/.test(f));
    hasData = files.some((f) => /(^|[\\/])pm-chinese-data\.json$/.test(f));
    hasScratch = files.some((f) => /(^|[\\/])pm-scratchpad-cn\.js$/.test(f));
    hasMain = files.some((f) => /^[\\/]?pm-main-cn\.js$/.test(f));
    preloadRel = findPreloadInAsar(files);
  } catch (e) {
    console.log('  无法读取 asar 内容:', e.message);
  }
  try {
    if (preloadRel) {
      injected = /require\((['"])\.\/pm-chinese\.js\1\)/.test(asarReadFile(asar, preloadRel));
    }
  } catch (e) { /* preload 缺失则视为未注入 */ }
  if (hasData) {
    try { count = Object.keys(JSON.parse(asarReadFile(asar, 'pm-chinese-data.json'))).length; } catch (e) { /* ignore */ }
  }

  console.log(`  pm-chinese.js 在 asar 内: ${hasHook ? '是' : '否'}`);
  console.log(`  pm-chinese-data.json 在 asar 内: ${hasData ? '是' : '否'}${count != null ? `（${count} 模块）` : ''}`);
  console.log(`  Scratch Pad 钩子在 asar 内: ${hasScratch ? '是' : '否'}`);
  let mainInjected = false;
  try {
    mainInjected = hasMain && asarReadFile(asar, MAIN_ENTRY).includes(`require('./${MAIN_HOOK_NAME}')`);
  } catch (e) { /* ignore */ }
  console.log(`  原生菜单钩子（${MAIN_ENTRY}）: ${mainInjected ? '已注入' : '未注入'}`);
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
  --restore                 还原注入（用备份覆盖回 app.asar / preload）
  --resources <dir>         直接指定含 app.asar 或未打包 app/ 的目录（跳过自动探测）
  --postman-dir <dir>       指定 Postman 安装根目录
  --app-version <v>         Windows 多版本共存时指定 app-<version>（默认最新）
  --offline                 不联网：不检查程序新版本、不拉取在线译文（有本机缓存则用缓存）
  --no-self-update          只拉取最新译文，不自动更新程序本身
  -v, --version             显示本工具版本
  -h, --help                显示帮助

平台默认探测位置:
  Windows  %LOCALAPPDATA%\\Postman\\app-<version>\\resources
  macOS    /Applications/Postman.app/Contents/Resources（及 ~/Applications）
  Linux    /opt/Postman/app/resources 等常见位置

注入/还原前请先完全退出 Postman。macOS / Linux 的系统级安装可能需要 sudo。`);
}

function parseArgs(argv) {
  const opts = { postmanDir: null, resources: null, appVersion: null, restore: false, status: false, offline: false, selfUpdate: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--restore') opts.restore = true;
    else if (a === '--status') opts.status = true;
    else if (a === '--resources') opts.resources = argv[++i];
    else if (a === '--postman-dir') opts.postmanDir = argv[++i];
    else if (a === '--app-version') opts.appVersion = argv[++i];
    else if (a === '--offline') opts.offline = true;
    else if (a === '--no-self-update') opts.selfUpdate = false;
    else if (a === '-v' || a === '--version') { console.log(toolVersion()); process.exit(0); }
    else if (a === '-h' || a === '--help') { printHelp(); process.exit(0); }
    else { console.error(`[错误] 未知参数: ${a}（用 --help 查看用法）`); process.exit(2); }
  }
  return opts;
}

async function main() {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);
  const patching = !opts.status && !opts.restore;
  updater.cleanupOldBinary();
  // 先自更新：新版本可能带来新的探测 / 注入逻辑，更新成功则直接交给新版本跑完并退出
  if (patching && !opts.offline && opts.selfUpdate) {
    const code = await updater.selfUpdate({ currentVersion: toolVersion(), argv });
    if (code !== null) process.exit(code);
  }
  const target = resolveTarget(opts);
  console.log(`[目标] ${target.resourcesDir}（${target.kind === 'asar' ? 'app.asar' : '未打包 app/ 目录'}）`);
  if (opts.status) status(target);
  else if (opts.restore) restore(target);
  else {
    await prepareRemoteData(opts, DEFAULT_LANG);
    await patch(target, DEFAULT_LANG);
  }
}

// 导出供测试用（作为 CLI 运行时不受影响）
module.exports = { findPreloadIn, findPreloadInAsar, resolveDirPreload, PRELOAD_CANDIDATES, scratchpadHookSource, loadScratchpadDict, mainHookSource, loadMainDict, injectMainEntry, stripBlock };

if (require.main === module) {
  main().catch((e) => {
    console.error(`[错误] ${e.message}`);
    if (e && e.code === 'EACCES' && process.platform !== 'win32') {
      console.error('       权限不足——该目录（如 /opt/Postman）通常属 root，需要写权限。');
      console.error('       请在同一条命令前加 sudo 重试，并确保已完全退出 Postman。');
    }
    process.exit(1);
  });
}
