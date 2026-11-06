'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const zlib = require('zlib');
const u = require('../src/updater.js');

// 手工拼一个单文件 zip（deflate），验证中央目录解析
function makeZip(name, content) {
  const data = zlib.deflateRawSync(content);
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOffset = local.length + nameBuf.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + nameBuf.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, nameBuf, data, central, nameBuf, eocd]);
}

test('extractSingleFromZip：解出唯一文件', () => {
  const content = Buffer.from('MZ fake exe '.repeat(100));
  const r = u.extractSingleFromZip(makeZip('postman-chinese-injector-win-x64.exe', content));
  assert.strictEqual(r.name, 'postman-chinese-injector-win-x64.exe');
  assert.ok(r.data.equals(content));
});

test('extractSingleFromZip：非 zip 报错', () => {
  assert.throws(() => u.extractSingleFromZip(Buffer.from('not a zip at all, definitely not')));
});

const good = {
  schema: u.DATA_SCHEMA, committedAt: '2026-09-29T15:35:33+08:00',
  data: { home: { a: '甲' } }, hook: '//', mainDict: { File: '文件' }, mainHook: '//',
};

test('parseDataBundle：gzip 与纯 JSON 都能解析', () => {
  const json = Buffer.from(JSON.stringify(good));
  assert.deepStrictEqual(u.parseDataBundle(zlib.gzipSync(json)).data, good.data);
  assert.deepStrictEqual(u.parseDataBundle(json).mainDict, good.mainDict);
});

test('parseDataBundle：格式不兼容 / 缺字段 / 截断 均拒绝', () => {
  assert.throws(() => u.parseDataBundle(Buffer.from(JSON.stringify({ ...good, schema: u.DATA_SCHEMA + 1 }))), /不兼容/);
  assert.throws(() => u.parseDataBundle(Buffer.from(JSON.stringify({ ...good, hook: undefined }))), /缺少/);
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(good)));
  assert.throws(() => u.parseDataBundle(gz.subarray(0, gz.length - 10)));
});

test('assetNameFor：各平台对应 Release 压缩包名', () => {
  assert.strictEqual(u.assetNameFor('win32', 'x64', false), 'postman-chinese-injector-win-x64.zip');
  assert.strictEqual(u.assetNameFor('win32', 'x64', true), 'postman-chinese-injector-win-x64-legacy.zip');
  assert.strictEqual(u.assetNameFor('linux', 'arm64'), 'postman-chinese-injector-linux-arm64.tar.xz');
  assert.strictEqual(u.assetNameFor('darwin', 'arm64'), 'postman-chinese-injector-macos-arm64.tar.xz');
  assert.strictEqual(u.assetNameFor('darwin', 'x64'), 'postman-chinese-injector-macos-x64.tar.xz');
  assert.strictEqual(u.assetNameFor('linux', 'ia32'), null);
});

test('parseSums / cmpVer', () => {
  const h = 'a'.repeat(64);
  assert.deepStrictEqual(u.parseSums(`${h}  foo.zip\n${'b'.repeat(64)} *bar.tar.xz\n`), { 'foo.zip': h, 'bar.tar.xz': 'b'.repeat(64) });
  assert.ok(u.cmpVer('v1.10.0', '1.9.9') > 0);
  assert.strictEqual(u.cmpVer('v1.6.1', '1.6.1'), 0);
  assert.ok(u.cmpVer('1.6.1', 'v1.7.0') < 0);
});

test('managedBy：识别 Scoop / Homebrew 安装与环境变量开关', () => {
  assert.strictEqual(u.managedBy(String.raw`C:\Users\a\scoop\apps\postman-chinese-injector\1.8.5\postman-chinese-injector.exe`, {}), 'scoop');
  assert.strictEqual(u.managedBy(String.raw`D:\Scoop\apps\postman-chinese-injector\current\x.exe`, {}), 'scoop');
  assert.strictEqual(u.managedBy('/opt/homebrew/Cellar/postman-chinese-injector/1.8.5/bin/postman-chinese-injector', {}), 'homebrew');
  assert.strictEqual(u.managedBy('/usr/local/Cellar/postman-chinese-injector/1.8.5/bin/postman-chinese-injector', {}), 'homebrew');
  assert.strictEqual(u.managedBy('/home/linuxbrew/.linuxbrew/bin/postman-chinese-injector', {}), 'homebrew');
  assert.strictEqual(u.managedBy(String.raw`C:\Tools\postman-chinese-injector-win-x64.exe`, {}), null);
  assert.strictEqual(u.managedBy('/usr/local/bin/postman-chinese-injector', {}), null);
  assert.strictEqual(u.managedBy('/usr/local/bin/x', { PMCI_NO_SELF_UPDATE: '1' }), 'env');
});

test('dataFileFor / parseDataBundle：按语言区分数据包', () => {
  assert.strictEqual(u.dataFileFor('zh-CN'), u.DATA_FILE);
  assert.strictEqual(u.dataFileFor('zh-TW'), 'pm-update.zh-TW.json.gz');
  const tw = Buffer.from(JSON.stringify({ ...good, lang: 'zh-TW' }));
  assert.strictEqual(u.parseDataBundle(tw, 'zh-TW').lang, 'zh-TW');
  assert.throws(() => u.parseDataBundle(tw), /语言/);                       // 简体程序拿到繁體包
  assert.throws(() => u.parseDataBundle(Buffer.from(JSON.stringify(good)), 'zh-TW'), /语言/); // 无 lang 视为简体
});
