#!/usr/bin/env node
/*
 * update-pkg-manifests.js —— 按某个 Release 的 SHA256SUMS.txt 生成包管理器清单：
 *   Scoop bucket   → <scoopDir>/bucket/postman-chinese-injector.json
 *   Homebrew tap   → <brewDir>/Formula/postman-chinese-injector.rb
 *
 * 用法：
 *   node scripts/update-pkg-manifests.js --version 1.8.6 --sums dist/SHA256SUMS.txt \
 *        [--scoop ../scoop-bucket] [--brew ../homebrew-tap]
 * 不给 --sums 时从 GitHub Release 下载该版本的 SHA256SUMS.txt。
 * 发版 CI（.github/workflows/release.yml）用它更新 hlmd/scoop-bucket 与 hlmd/homebrew-tap。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { parseSums } = require('../src/updater');

const REPO = 'hlmd/postman-chinese-injector';
const NAME = 'postman-chinese-injector';
const DESC = 'Postman 桌面端非官方汉化工具(与 Postman, Inc. 无关)';
const assetUrl = (v, file) => `https://github.com/${REPO}/releases/download/v${v}/${file}`;

function need(sums, file) {
  const h = sums[file];
  if (!/^[0-9a-f]{64}$/.test(h || '')) throw new Error(`SHA256SUMS.txt 缺少 ${file}`);
  return h;
}

function scoopManifest(v, sums) {
  const zip = `${NAME}-win-x64.zip`;
  return JSON.stringify({
    version: v,
    description: DESC,
    homepage: `https://github.com/${REPO}`,
    license: 'MIT',
    notes: [
      '运行前请完全退出 Postman。',
      `注入: ${NAME}    繁體: ${NAME} --lang zh-TW    还原: ${NAME} restore    帮助: ${NAME} -h`,
      `程序由 Scoop 管理，升级请用：scoop update ${NAME}`,
    ],
    architecture: { '64bit': { url: assetUrl(v, zip), hash: need(sums, zip) } },
    bin: [[`${NAME}-win-x64.exe`, NAME]],
    checkver: 'github',
    autoupdate: {
      architecture: { '64bit': { url: assetUrl('$version', zip) } },
      hash: { url: '$baseurl/SHA256SUMS.txt' },
    },
  }, null, 4) + '\n';
}

function brewFormula(v, sums) {
  const block = (plat, arch) => {
    const file = `${NAME}-${plat}-${arch}.tar.xz`;
    return `      url "${assetUrl(v, file)}"\n      sha256 "${need(sums, file)}"`;
  };
  return `# 由 hlmd/postman-chinese-injector 的 scripts/update-pkg-manifests.js 自动生成,请勿手改
class PostmanChineseInjector < Formula
  desc "${DESC}"
  homepage "https://github.com/${REPO}"
  version "${v}"
  license "MIT"

  on_macos do
    on_arm do
${block('macos', 'arm64')}
    end
    on_intel do
${block('macos', 'x64')}
    end
  end

  on_linux do
    on_arm do
${block('linux', 'arm64')}
    end
    on_intel do
${block('linux', 'x64')}
    end
  end

  def install
    binary = Dir["${NAME}-*"].first
    chmod 0755, binary
    bin.install binary => "${NAME}"
  end

  def caveats
    <<~EOS
      运行前请完全退出 Postman。
      注入: ${NAME}    繁體: ${NAME} --lang zh-TW    还原: ${NAME} restore    帮助: ${NAME} -h
      程序由 Homebrew 管理（已关闭自更新），升级请用：brew upgrade ${NAME}
      Linux 上 Postman 装在 /opt 等系统目录时可能需要 sudo。
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/${NAME} --version")
  end
end
`;
}

async function main() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];
  const v = String(args.version || '').replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error('需要 --version X.Y.Z');
  if (!args.scoop && !args.brew) throw new Error('至少给出 --scoop 或 --brew 之一');

  let text;
  if (args.sums) text = fs.readFileSync(args.sums, 'utf8');
  else {
    const res = await fetch(assetUrl(v, 'SHA256SUMS.txt'));
    if (!res.ok) throw new Error(`下载 SHA256SUMS.txt 失败：HTTP ${res.status}`);
    text = await res.text();
  }
  const sums = parseSums(text);

  const write = (file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    console.log(`[清单] ${file}`);
  };
  if (args.scoop) write(path.join(args.scoop, 'bucket', `${NAME}.json`), scoopManifest(v, sums));
  if (args.brew) write(path.join(args.brew, 'Formula', `${NAME}.rb`), brewFormula(v, sums));
}

module.exports = { scoopManifest, brewFormula };

if (require.main === module) {
  main().catch((e) => { console.error(`[错误] ${e.message}`); process.exit(1); });
}
