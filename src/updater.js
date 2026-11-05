/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * updater.js —— 注入程序的「在线更新」：
 *
 *   ① 译文热更新：CI 在 main 每次改动译文/钩子后，把「译文 + 3 个钩子源码」打成单个
 *      pm-update.json.gz 推到 update-data 分支。注入前并行从 GitHub raw 与 jsDelivr 镜像拉取，
 *      取最新的一份，缓存到本机；离线时用缓存，缓存也没有 / 比内嵌旧则回退二进制内嵌快照。
 *   ② 程序自更新（仅单文件二进制）：对比 GitHub 最新 Release 的版本号，有新版则下载对应平台
 *      压缩包 → 按 SHA256SUMS.txt 校验 → 解压替换自身 → 以原参数重新运行新版本。
 *
 * 任何一步失败都只打印警告，不影响用现有数据完成注入。
 * 兼容 Node 16（legacy 版 pkg 打包）：没有全局 fetch 时回退 https 模块。
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO = 'hlmd/postman-chinese-injector';
const DATA_BRANCH = 'update-data';
const DATA_FILE = 'pm-update.json.gz';
// 数据包格式版本：钩子文件组成 / 数据结构变了就 +1，老程序会忽略新格式的数据包（转而靠自更新）
const DATA_SCHEMA = 1;
const DATA_URLS = [
  `https://raw.githubusercontent.com/${REPO}/${DATA_BRANCH}/${DATA_FILE}`,
  `https://cdn.jsdelivr.net/gh/${REPO}@${DATA_BRANCH}/${DATA_FILE}`,
  `https://fastly.jsdelivr.net/gh/${REPO}@${DATA_BRANCH}/${DATA_FILE}`,
];
const RELEASE_LATEST = `https://github.com/${REPO}/releases/latest`;
const releaseAsset = (tag, name) => `https://github.com/${REPO}/releases/download/${tag}/${name}`;
// 大文件直连 GitHub 常被截断，失败后走加速镜像；下载内容一律按 GitHub 上的 SHA256SUMS 校验
const ASSET_MIRRORS = [(u) => u, (u) => `https://ghfast.top/${u}`];
const UA = 'postman-chinese-injector-updater';
const SELF_UPDATED_ENV = 'PMCI_SELF_UPDATED';

// ---------- HTTP：优先全局 fetch（bun 会遵循 HTTP(S)_PROXY），否则 https 模块 ----------
// timeout 是「空闲超时」：连续这么久没收到任何数据就放弃（大文件慢慢下不会被误杀，卡死的连接能尽快换源）。
// onProgress(已收字节, 总字节或 0) 在每收到一块数据时调用。
async function httpGet(url, { method = 'GET', timeout = 15000, onProgress, signal } = {}) {
  if (typeof fetch !== 'function') return nodeGet(url, { method, timeout, onProgress, signal }, 5);
  const ac = new AbortController();
  if (signal) signal.addEventListener('abort', () => ac.abort(), { once: true });
  let timer;
  const kick = () => { clearTimeout(timer); timer = setTimeout(() => ac.abort(), timeout); };
  kick();
  try {
    const res = await fetch(url, { method, redirect: 'follow', signal: ac.signal, headers: { 'User-Agent': UA } });
    const chunks = [];
    if (method !== 'HEAD' && res.body) {
      const total = parseInt(res.headers.get('content-length'), 10) || 0;
      const reader = res.body.getReader();
      let got = 0;
      for (;;) {
        kick();
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
        got += value.length;
        if (onProgress) onProgress(got, total);
      }
    }
    return { status: res.status, url: res.url || url, body: Buffer.concat(chunks) };
  } catch (e) {
    throw new Error(signal && signal.aborted ? '已取消' : ac.signal.aborted ? `${timeout / 1000}s 内无响应` : e.message);
  } finally {
    clearTimeout(timer);
  }
}

function nodeGet(url, opts, redirects) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: opts.method, headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error('重定向过多'));
        return resolve(nodeGet(new URL(res.headers.location, url).href, opts, redirects - 1));
      }
      const total = parseInt(res.headers['content-length'], 10) || 0;
      const chunks = [];
      let got = 0;
      res.on('data', (c) => {
        chunks.push(c);
        got += c.length;
        if (opts.onProgress) opts.onProgress(got, total);
      });
      res.on('end', () => resolve({ status: res.statusCode, url, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    // socket 空闲超时，语义与 fetch 分支一致
    req.setTimeout(opts.timeout, () => req.destroy(new Error(`${opts.timeout / 1000}s 内无响应`)));
    if (opts.signal) opts.signal.addEventListener('abort', () => req.destroy(new Error('已取消')), { once: true });
    req.on('error', reject);
    req.end();
  });
}

// 下载进度：每 10% 打一行（不用回车符原地刷新，兼容双击运行的控制台与日志重定向）
function progressLogger(log) {
  let last = -1;
  return (got, total) => {
    if (!total) return;
    const pct = Math.floor((got / total) * 10) * 10;
    if (pct > last) {
      last = pct;
      log(`         ${pct}%（${(got / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB）`);
    }
  };
}

async function getOk(url, opts) {
  const res = await httpGet(url, opts);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return res;
}

// ---------- 通用小工具 ----------
function cmpVer(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function cacheDir() {
  const home = os.homedir();
  let base;
  if (process.platform === 'win32') base = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  else if (process.platform === 'darwin') base = path.join(home, 'Library', 'Caches');
  else base = process.env.XDG_CACHE_HOME || path.join(home, '.cache');
  return path.join(base, 'postman-chinese-injector');
}

// ---------- ① 译文数据包 ----------
// 解析并校验数据包；gzip 或纯 JSON 都认（镜像可能透明解压）。不合格抛异常。
function parseDataBundle(buf) {
  const raw = buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf;
  const b = JSON.parse(raw.toString('utf8'));
  if (!b || typeof b !== 'object') throw new Error('数据包不是对象');
  if (b.schema !== DATA_SCHEMA) throw new Error(`数据包格式 ${b.schema} 与本程序（${DATA_SCHEMA}）不兼容`);
  const isObj = (o) => o && typeof o === 'object' && Object.keys(o).length > 0;
  if (!isObj(b.data) || !isObj(b.mainDict) || typeof b.hook !== 'string' || typeof b.mainHook !== 'string') {
    throw new Error('数据包缺少必需字段');
  }
  if (typeof b.committedAt !== 'string' || isNaN(Date.parse(b.committedAt))) throw new Error('数据包缺少时间戳');
  return b;
}

const newer = (a, b) => Date.parse(a.committedAt) > Date.parse(b.committedAt);

// 并行拉取所有数据源，取 committedAt 最新的一份（jsDelivr 对分支有最长 12h 缓存，raw 通常最新）
async function fetchLatestData(log) {
  const results = await Promise.allSettled(DATA_URLS.map(async (u) => {
    const { body } = await getOk(u, { timeout: 12000 });
    return { buf: body, bundle: parseDataBundle(body), url: u };
  }));
  let best = null;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      if (!best || newer(r.value.bundle, best.bundle)) best = r.value;
    } else {
      log(`[更新] ${new URL(DATA_URLS[i]).host} 拉取失败: ${r.reason && r.reason.message}`);
    }
  });
  return best;
}

function readCachedData() {
  const p = path.join(cacheDir(), DATA_FILE);
  try { return parseDataBundle(fs.readFileSync(p)); } catch (e) { return null; }
}

function writeCachedData(buf) {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(path.join(cacheDir(), DATA_FILE), buf);
  } catch (e) { /* 缓存写不进去不影响本次注入 */ }
}

/**
 * 取可用的最新译文数据包。embeddedAt 为二进制内嵌快照的提交时间（ISO，未知可为 null）。
 * 返回比内嵌更新的数据包（含 from 字段说明来源），否则 null（调用方回退内嵌快照）。
 */
async function resolveDataBundle({ embeddedAt, offline, log = console.log } = {}) {
  let cand = null;
  if (!offline) {
    log('[更新] 正在检查最新译文…');
    const got = await fetchLatestData(log);
    if (got) {
      writeCachedData(got.buf);
      cand = Object.assign(got.bundle, { from: new URL(got.url).host });
    }
  }
  if (!cand) {
    const cached = readCachedData();
    if (cached) cand = Object.assign(cached, { from: '本机缓存' });
  }
  if (!cand) return null;
  if (embeddedAt && !newer(cand, { committedAt: embeddedAt })) {
    log(`[更新] 内嵌译文已是最新（${embeddedAt}）`);
    return null;
  }
  return cand;
}

// ---------- ② 程序自更新 ----------
// 是否为单文件二进制（bun --compile 或 pkg）；用 node/bun 直接跑源码时不自更新
function isStandaloneBinary() {
  if (process.pkg) return true;
  if (!process.versions.bun) return false;
  return !/^(bun|node)(\.exe)?$/i.test(path.basename(process.execPath));
}

// 当前平台对应的 Release 压缩包名（与 scripts/compress-dist.js 的产物一致）
function assetNameFor(platform = process.platform, arch = process.arch, legacy = !!process.pkg) {
  const P = 'postman-chinese-injector';
  if (platform === 'win32') return `${P}-win-x64${legacy ? '-legacy' : ''}.zip`; // arm64 Windows 走 x64 模拟
  if (platform === 'linux' && (arch === 'x64' || arch === 'arm64')) return `${P}-linux-${arch}.tar.xz`;
  if (platform === 'darwin') return `${P}-macos-${arch === 'arm64' ? 'arm64' : 'x64'}.tar.xz`;
  return null;
}

// 最新 Release 的 tag：跟随 /releases/latest 的重定向，从最终 URL 取（不占 API 限额）
async function latestReleaseTag() {
  const res = await httpGet(RELEASE_LATEST, { method: 'HEAD', timeout: 10000 });
  const m = /\/releases\/tag\/([^/?#]+)/.exec(res.url);
  if (!m) throw new Error(`无法从 ${res.url} 解析最新版本（HTTP ${res.status}）`);
  return decodeURIComponent(m[1]);
}

function parseSums(text) {
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (m) map[m[2].trim()] = m[1].toLowerCase();
  }
  return map;
}

// 从 zip 取出唯一的文件（读中央目录，支持 stored / deflate；Release 的 Windows 包只含一个 exe）
function extractSingleFromZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 zip');
  let p = buf.readUInt32LE(eocd + 16);
  const entries = buf.readUInt16LE(eocd + 10);
  for (let n = 0; n < entries; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip 中央目录损坏');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('zip 本地头损坏');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    if (method === 0) return { name, data: Buffer.from(data) };
    if (method === 8) return { name, data: zlib.inflateRawSync(data) };
    throw new Error(`不支持的 zip 压缩方式 ${method}`);
  }
  throw new Error('zip 里没有文件');
}

// tar.xz 交给系统 tar（macOS 自带 bsdtar、Linux GNU tar + xz 都支持 -J）
function extractTarXz(archive, destDir) {
  const r = spawnSync('tar', ['-xJf', archive, '-C', destDir], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.error || r.status !== 0) {
    throw new Error(`解压失败（需要系统 tar 支持 xz）：${r.error ? r.error.message : String(r.stderr).trim()}`);
  }
  const files = fs.readdirSync(destDir).filter((f) => f.startsWith('postman-chinese-injector'));
  if (files.length !== 1) throw new Error('压缩包内容不符合预期');
  return path.join(destDir, files[0]);
}

// 校验和文件很小，优先直连 GitHub（多试几次，国内偶发 TLS 中断）；都失败再走镜像。
// 走镜像时校验和与压缩包同源，只能防下载截断、不能防镜像篡改，故打印提示。
async function fetchSums(tag) {
  const url = releaseAsset(tag, 'SHA256SUMS.txt');
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try { return (await getOk(url, { timeout: 15000 })).body; } catch (e) { lastErr = e; }
  }
  for (const mirror of ASSET_MIRRORS.slice(1)) {
    try {
      const { body } = await getOk(mirror(url), { timeout: 15000 });
      console.log('[自更新] 直连 GitHub 取校验和失败，已改用镜像获取');
      return body;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`获取 SHA256SUMS.txt 失败: ${lastErr && lastErr.message}`);
}

// 所有源同时下载，第一个下完且 SHA256 校验通过的胜出，其余立即取消。
// 直连 GitHub 在国内常是「不断但极慢」的涓流，串行重试会卡很久；并发则总能拿到最快那条。
async function downloadAsset(tag, name, expectSha, log) {
  const ac = new AbortController();
  const urls = ASSET_MIRRORS.map((m) => m(releaseAsset(tag, name)));
  const progress = progressLogger(log);
  const sofar = urls.map(() => 0);
  log(`[自更新] 并行下载 ${name}（${urls.map((u) => new URL(u).host).join(' / ')}）`);
  try {
    return await Promise.any(urls.map(async (url, i) => {
      try {
        const { body } = await getOk(url, {
          timeout: 20000, signal: ac.signal,
          onProgress: (got, total) => { sofar[i] = got; progress(Math.max(...sofar), total); },
        });
        const sha = crypto.createHash('sha256').update(body).digest('hex');
        if (sha !== expectSha) throw new Error('SHA256 校验不符（下载不完整或被篡改）');
        ac.abort();
        log(`[自更新] 已从 ${new URL(url).host} 下载完成，校验通过`);
        return body;
      } catch (e) {
        if (!ac.signal.aborted) log(`[自更新] ${new URL(url).host} 失败: ${e.message}`);
        throw e;
      }
    }));
  } catch (e) {
    throw new Error('所有下载源均失败');
  }
}

// 用新二进制替换当前可执行文件。Windows 不能覆盖运行中的 exe，但可以改名：exe → exe.old
function replaceSelf(newBin) {
  const exe = process.execPath;
  if (process.platform === 'win32') {
    const old = exe + '.old';
    try { fs.unlinkSync(old); } catch (e) { /* 不存在或仍被占用 */ }
    fs.renameSync(exe, old);
    try { fs.renameSync(newBin, exe); } catch (e) { fs.renameSync(old, exe); throw e; }
    return;
  }
  fs.chmodSync(newBin, 0o755);
  if (process.platform === 'darwin') {
    // CI 在 Linux 交叉编译，产物无签名；Apple Silicon 要求至少 ad-hoc 签名，否则启动即被杀
    spawnSync('codesign', ['--force', '--sign', '-', newBin], { stdio: 'ignore' });
  }
  fs.renameSync(newBin, exe); // 同目录 rename 原子替换，新 inode，运行中的旧进程不受影响
}

// 上次在 Windows 上自更新留下的 exe.old，下次启动时顺手清掉
function cleanupOldBinary() {
  if (process.platform !== 'win32' || !isStandaloneBinary()) return;
  try { fs.unlinkSync(process.execPath + '.old'); } catch (e) { /* 不存在或仍被占用 */ }
}

/**
 * 检查并执行程序自更新。已更新则以原参数运行新版本并返回其退出码；否则返回 null 继续当前流程。
 */
async function selfUpdate({ currentVersion, argv, log = console.log } = {}) {
  if (!isStandaloneBinary() || process.env[SELF_UPDATED_ENV]) return null;
  const name = assetNameFor();
  if (!name) return null;

  let tag;
  try {
    tag = await latestReleaseTag();
  } catch (e) {
    log(`[自更新] 检查新版本失败，跳过: ${e.message}`);
    return null;
  }
  if (cmpVer(tag, currentVersion) <= 0) {
    log(`[自更新] 已是最新版本 v${currentVersion}`);
    return null;
  }
  log(`[自更新] 发现新版本 ${tag}（当前 v${currentVersion}），开始更新…`);

  let work = null;
  try {
    // 临时目录放在 exe 同目录，保证最后的 rename 不跨文件系统
    work = fs.mkdtempSync(path.join(path.dirname(process.execPath), '.pmci-update-'));
    const sumsBuf = await fetchSums(tag);
    const expect = parseSums(sumsBuf.toString('utf8'))[name];
    if (!expect) throw new Error(`SHA256SUMS.txt 里没有 ${name}`);
    const archive = await downloadAsset(tag, name, expect, log);

    let newBin;
    if (name.endsWith('.zip')) {
      newBin = path.join(work, 'new.exe');
      fs.writeFileSync(newBin, extractSingleFromZip(archive).data);
    } else {
      const archivePath = path.join(work, name);
      fs.writeFileSync(archivePath, archive);
      newBin = extractTarXz(archivePath, work);
    }
    replaceSelf(newBin);
  } catch (e) {
    log(`[自更新] 更新失败，继续使用当前版本: ${e.message}`);
    log(`         可手动下载：https://github.com/${REPO}/releases/latest`);
    if (e.code === 'EACCES' || e.code === 'EPERM') log('         （程序所在目录无写权限，可移到有权限的目录或用 sudo 运行）');
    return null;
  } finally {
    if (work) try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }

  log(`[自更新] 已更新到 ${tag}，重新运行新版本…\n`);
  const r = spawnSync(process.execPath, argv, {
    stdio: 'inherit',
    env: Object.assign({}, process.env, { [SELF_UPDATED_ENV]: '1' }),
  });
  if (r.error) {
    log(`[自更新] 启动新版本失败: ${r.error.message}；请手动重新运行`);
    return 1;
  }
  return r.status === null ? 1 : r.status;
}

module.exports = {
  resolveDataBundle, selfUpdate, cleanupOldBinary,
  // 以下导出供测试 / 构建脚本用
  DATA_SCHEMA, DATA_FILE, parseDataBundle, assetNameFor, parseSums, extractSingleFromZip, cmpVer,
};
