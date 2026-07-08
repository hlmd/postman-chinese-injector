#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * build-scratchpad-dict.js —— 从归档项目 Postman-cn 的 php/lang/js/scratchpad/** 提取
 *   「英文→中文」纯可见文本词典，产出 locales/scratchpad/zh-CN.json（内置进本仓库）。
 *   词条格式为 PHP 数组 '"English"' => '"中文"'（或单引号）；跳过占位符 ______、含 ${} 或
 *   反引号的模板、以及形如 title:"X" 的带代码上下文条目。仅为 dev 工具，用于再生成词典。
 *
 * 用法: node scripts/build-scratchpad-dict.js [--src <Postman-cn 的 scratchpad lang 目录>]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_SRC = process.env.POSTMAN_CN_LANG ||
  'D:/Sinicization/Postman/Postman-cn/php/lang/js/scratchpad';
const OUT = path.join(ROOT, 'locales', 'scratchpad', 'zh-CN.json');

// 一行形如：  'X' => 'Y',   或   "X" => "Y"
const PAIR_RE = /^\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*=>\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*,?\s*$/;

// 去掉最外层 PHP 引号并还原 \' \" \\ 转义；非带引号串返回 null
function unwrapPhp(s) {
  s = s.trim();
  const q = s[0];
  if ((q === '"' || q === "'") && s[s.length - 1] === q && s.length >= 2) {
    return s.slice(1, -1).replace(/\\(['"\\])/g, '$1');
  }
  return null;
}

// 去掉内层 JS 引号得可见文本；非带引号串（如 title:"X"）返回 null
function unwrapJs(s) {
  const q = s[0];
  if ((q === '"' || q === "'") && s[s.length - 1] === q && s.length >= 2) {
    return s.slice(1, -1);
  }
  return null;
}

// 从一段 PHP lang 文本提取纯可见 EN->ZH 对写入 map（先到先得）
function extractInto(text, map) {
  for (const line of String(text).split(/\r?\n/)) {
    const m = PAIR_RE.exec(line);
    if (!m) continue;
    const en = unwrapPhp(m[1]);
    const zh = unwrapPhp(m[2]);
    if (en == null || zh == null) continue;
    if (en.includes('______') || zh.includes('______')) continue; // 占位
    if (en.includes('${') || en.startsWith('`')) continue;          // 模板
    const enPlain = unwrapJs(en);
    const zhPlain = unwrapJs(zh);
    if (enPlain == null || zhPlain == null) continue;               // 带代码上下文
    if (!enPlain.trim()) continue;
    if (!map.has(enPlain)) map.set(enPlain, zhPlain);
  }
  return map;
}

function walkPhp(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkPhp(p, out);
    else if (e.name.endsWith('.php')) out.push(p);
  }
  return out;
}

function build(srcDir) {
  const src = srcDir || DEFAULT_SRC;
  if (!fs.existsSync(src)) throw new Error(`找不到词典源目录: ${src}`);
  const map = new Map();
  for (const f of walkPhp(src, [])) extractInto(fs.readFileSync(f, 'utf8'), map);
  const obj = {};
  for (const [k, v] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) obj[k] = v;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(obj), 'utf8');
  return { count: map.size, out: OUT };
}

module.exports = { extractInto, unwrapPhp, unwrapJs, build };

if (require.main === module) {
  try {
    const i = process.argv.indexOf('--src');
    const { count, out } = build(i >= 0 ? process.argv[i + 1] : undefined);
    console.log(`[完成] 提取 ${count} 条 -> ${path.relative(ROOT, out)}`);
  } catch (e) {
    console.error(`[错误] ${e.message}`);
    process.exit(1);
  }
}
