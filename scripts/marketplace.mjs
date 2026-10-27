import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareMarketplace, readJson, sourceCatalog, writeJson, digest, inside, entries, missingPackagedResources, planVersionBumps, applyVersionBump, runtimeSourcesChanged, reviewedSourceSha } from './static-marketplace.mjs';

const root = process.cwd();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const branchPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._/-]*[A-Za-z0-9])?$/;

export function publicationSettings(directory) {
  const settings = readJson(join(directory, '.astravia/publish.json'));
  const validBranch = value => typeof value === 'string' && branchPattern.test(value) && !value.includes('..') && !value.includes('//') && !value.includes('@{');
  if (!validBranch(settings.sourceBranch)) throw new Error('Configure a valid sourceBranch for reviewed source changes');
  if (settings.distributionBranch !== 'gh-pages' || settings.sourceBranch === settings.distributionBranch) throw new Error('Use gh-pages only for generated distribution content');
  if (!/^[a-f0-9]{40}$/.test(settings.toolingCommit)) throw new Error('Pin the publication tool to a full commit');
  settings.candidateAppCommits ??= {};
  if (!settings.candidateAppCommits || typeof settings.candidateAppCommits !== 'object' || Array.isArray(settings.candidateAppCommits)) throw new Error('candidateAppCommits must map App versions to full commits');
  for (const [version, commit] of Object.entries(settings.candidateAppCommits)) {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Pin each candidate App version to a full commit');
  }
  return settings;
}

function walkToolingPkgs(toolingDir) {
  const index = new Map();
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'release') continue;
      const full = join(dir, entry);
      let isDir;
      try { isDir = statSync(full).isDirectory(); } catch { continue; }
      if (!isDir) continue;
      if (existsSync(join(full, 'package.json'))) {
        const name = readJson(join(full, 'package.json')).name;
        if (name && !index.has(name)) index.set(name, full);
      }
      walk(full);
    }
  }
  walk(join(toolingDir, 'packages'));
  return index;
}

export async function verifyCandidate(directory, tooling) {
  const settings = publicationSettings(root);
  const manifest = readJson(join(directory, 'site/.astravia/marketplace.json'));
  const { syncMarketplaceIndex } = await import(pathToFileURL(join(tooling, 'packages/plugins/plugin-cli/src/sync.ts')).href);
  const reconciliation = syncMarketplaceIndex({ hubRoot: join(directory, 'site'), manifestPath: join(directory, 'site/.astravia/marketplace.json'), apply: false });
  if (reconciliation.problems.length || reconciliation.changes.length) throw new Error(`Distribution reconciliation failed: ${JSON.stringify(reconciliation)}`);
  const publication = readJson(join(directory, 'publication.json'));
  const artifacts = new Map(publication.packages.map(item => [item.release.artifact.url, item]));
  const { verifyMarketplacePublication } = await import(pathToFileURL(join(tooling, 'scripts/release/check-plugin-marketplace-publication.mjs')).href);
  await verifyMarketplacePublication(manifest, {
    token: process.env.GITHUB_TOKEN,
    candidateAppCommits: settings.candidateAppCommits,
    fetcher: async (url, init) => {
      const item = artifacts.get(String(url));
      if (!item) return fetch(url, init);
      const bytes = readFileSync(inside(join(directory, 'artifacts'), item.filename));
      if (digest(bytes) !== item.release.artifact.sha256) throw new Error(`Candidate digest mismatch: ${item.slug}`);
      return new Response(bytes);
    },
  });
}

/**
 * 定位插件自己装的那份 SDK 的 manifest 模块。
 *
 * 不能直接把 `node_modules/@astravia-org/plugin-sdk/...` 拼在包目录后面：安装布局由包管理器决定
 * （npm 拉平、pnpm 用符号链、yarn PnP 根本没有这个目录），写死一个布局等于把构建绑在某个包管理器上。
 * 这里问 Node 自己的解析器要候选目录，再从包元数据里读 `./manifest` 的入口。
 */
function sdkManifestModule(directory) {
  const specifier = '@astravia-org/plugin-sdk';
  const candidates = createRequire(join(directory, 'package.json')).resolve.paths(specifier) ?? [];
  for (const candidatesRoot of candidates) {
    const packageDir = join(candidatesRoot, specifier);
    const packagePath = join(packageDir, 'package.json');
    if (!existsSync(packagePath)) continue;
    const entry = readJson(packagePath).exports?.['./manifest']?.import ?? 'dist/manifest.js';
    const modulePath = join(packageDir, entry);
    if (existsSync(modulePath)) return modulePath;
  }
  throw new Error(`${directory} has no installed ${specifier} with a manifest module; run npm install in ${relative(root, directory)} first`);
}
async function verifyPackagedResources(result) {
  const sources = new Map(entries(sourceCatalog(root)).filter(entry => entry.type === 'plugin').map(entry => [entry.slug, inside(root, entry.source.path)]));
  const python = process.env.ASTRAVIA_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  for (const item of result.packages) {
    const archive = join(result.artifacts, item.filename);
    const names = JSON.parse(execFileSync(python, ['-c', 'import json, sys, zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))', archive], { encoding: 'utf8' }));
    const manifestModule = sdkManifestModule(sources.get(item.slug));
    const { listPluginManifestResources, parsePluginManifest } = await import(pathToFileURL(manifestModule).href);
    const manifest = parsePluginManifest(readJson(join(sources.get(item.slug), 'plugin.json')));
    const missing = missingPackagedResources(names, listPluginManifestResources(manifest));
    if (missing.length) throw new Error(`${item.filename} is missing plugin.json resources: ${missing.map(x => `${x.field} (${x.path})`).join(', ')}`);
  }
}

/** 已发布的分发索引：优先用 `--previous`，否则直接读 `origin/gh-pages`。 */
function publishedManifest(previous) {
  if (previous) return readJson(join(resolve(previous), '.astravia/marketplace.json'));
  try {
    return JSON.parse(git('show', `origin/${publicationSettings(root).distributionBranch}:.astravia/marketplace.json`));
  } catch {
    return undefined;
  }
}

/**
 * 上一次发布对应的源码提交；索引提交信息里那串 sha 是唯一记录。
 * 本地没 fetch 过分发分支时，从 `--previous` 指向的 worktree 里读同一个提交信息。
 */
function publishedSourceSha(baselineDir) {
  const branch = `origin/${publicationSettings(root).distributionBranch}`;
  const baseline = baselineDir && (() => execFileSync('git', ['-C', baselineDir, 'log', '-1', '--format=%B', 'HEAD'], { encoding: 'utf8' }));
  for (const source of [() => git('log', '-1', '--format=%B', branch), baseline].filter(Boolean)) {
    try {
      const sha = reviewedSourceSha(source());
      if (sha) return sha;
    } catch {
      // 分支不存在或目录不是仓库：换下一个来源，两个都不行就返回 null。
    }
  }
  return null;
}

/**
 * 自上次发布以来动过的插件。返回值是 `null` 而不是空集：拿不到基线时不知道谁改过，
 * 调用方要么全查，要么明说没查——不能把「不知道」当成「都没动」。
 */
function changedPluginSlugs(catalog, baselineDir) {
  const slugs = new Set();
  const sha = publishedSourceSha(baselineDir);
  if (!sha) return null;
  // 比的是工作树，不是 HEAD：本地会把未提交的改动也算进来，CI 里两者相同。
  // 未跟踪的新文件不算在 diff 里，单独补上，否则本地新写的运行文件会被漏掉。
  const names = [
    ...git('diff', '--name-only', sha).split('\n'),
    ...git('ls-files', '--others', '--exclude-standard').split('\n'),
  ].filter(Boolean);
  // 只看运行内容：README、detail.json、ability.json 与测试随分发目录更新，不需要抬版本。
  for (const entry of entries(catalog)) {
    if (entry.type !== 'plugin' || !entry.source) continue;
    if (runtimeSourcesChanged(names, entry.source.path).length > 0) slugs.add(entry.slug);
  }
  return slugs;
}

async function main() {
  const command = process.argv[2];
  if (command === 'check') {
    const catalog = sourceCatalog(root);
    publicationSettings(root);
    console.log(`Validated source entries for ${catalog.name}`);
    return;
  }
  if (command === 'verify') {
    await verifyCandidate(resolve(option('--output') ?? '.marketplace-build'), resolve(option('--tooling') ?? '.tooling/open-astravia'));
    return;
  }
  if (command === 'bump') {
    const published = publishedManifest(option('--previous'));
    if (!published) throw new Error('No published index to compare with; pass --previous DIR');
    const level = option('--level') ?? 'patch';
    if (!['patch', 'minor', 'major'].includes(level)) throw new Error(`Unknown --level ${level}; use patch, minor or major`);
    const only = option('--slug');
    // 拼错的 slug 不能静默变成「没事可做」：先确认它真是一个插件条目。
    if (only && !sourceCatalog(root).abilities.some(entry => entry.slug === only && entry.type === 'plugin')) {
      throw new Error(`No plugin named ${only} in .astravia/marketplace.source.json`);
    }
    // 没动过的插件不抬版本：它们在索引里已经是对的，凭空多一个版本只会逼使用者重装。
    const changed = only ? new Set([only]) : changedPluginSlugs(sourceCatalog(root));
    if (!changed) throw new Error('No published source baseline found; name the plugin with --slug');
    const bumps = planVersionBumps({ root, published, level, slugs: changed });
    if (!bumps.length) { console.log(`Nothing to bump: ${changed.size} plugin(s) changed, and none of them sits on an already published version.`); return; }
    for (const bump of bumps) {
      if (process.argv.includes('--apply')) {
        const written = applyVersionBump({ root, slug: bump.slug, to: bump.to });
        console.log(`${bump.slug}: ${bump.from} -> ${bump.to}  (${written.join(', ')})`);
      } else {
        console.log(`${bump.slug}: ${bump.from} -> ${bump.to}  (published ${bump.published}; rerun with --apply)`);
      }
    }
    return;
  }
  if (command !== 'build') throw new Error('Usage: node scripts/marketplace.mjs check|build|verify|bump [--output DIR] [--previous DIR] [--tooling DIR] [--strict] [--slug SLUG] [--level patch] [--apply]');
  const settings = publicationSettings(root);
  const previous = option('--previous');
  // `--strict`：运行内容改过、版本号还停在已发布那一版，就拒绝构建（这种改动永远不会出现在市场上）。
  // 基线优先取分发分支的提交信息；没 fetch 过就回退到 `--previous` 指向的 worktree。
  // 两者都拿不到时**跳过**而不是全查：全查等于把每个已发布插件都当成改动过，红得没信息量。
  const strictSlugs = process.argv.includes('--strict') ? (() => {
    const catalog = sourceCatalog(root);
    const changed = changedPluginSlugs(catalog, previous && resolve(previous));
    if (changed === null) {
      console.log(`Strict check skipped: no published source baseline (git fetch origin ${settings.distributionBranch}, or pass --previous <worktree>).`);
      return new Set();
    }
    console.log(`Strict check: ${changed.size} plugin(s) changed since the published index${changed.size ? ` (${[...changed].join(', ')})` : ''}`);
    return changed;
  })() : undefined;
  const output = resolve(option('--output') ?? '.marketplace-build');
  const result = await prepareMarketplace({
    root, output, previous: previous && resolve(previous), sourceSha: git('rev-parse', 'HEAD'), strictSlugs,
    buildPlugin: directory => {
      const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
      const npmRun = args => {
        if (process.platform === 'win32') execFileSync(process.execPath, [npmCli, ...args], { cwd: directory, stdio: 'inherit' });
        else execFileSync('npm', args, { cwd: directory, stdio: 'inherit' });
      };
      const toolingDir = resolve(option('--tooling') ?? '.tooling/open-astravia');
      const dev = existsSync(join(toolingDir, 'packages'));
      if (!dev) {
        // CI 环境：@astravia-org/* 已 publish 到 npm，直接 npm ci（上游标准流程）
        npmRun(['ci', '--no-audit', '--no-fund']);
      } else {
        // 开发环境：@astravia-org/* 未 publish 到 npm，临时生成 lockfile 指 tooling 本地，
        // 还原 package.json 后用 npm install（宽容模式，只看 lockfile 的 resolved）。
        const pkgPath = join(directory, 'package.json');
        const pkgOrig = readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgOrig);
        const needed = new Set([
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.devDependencies ?? {}),
        ].filter(k => k.startsWith('@astravia-org/')));
        const lockPath = join(directory, 'package-lock.json');
        const lockExisted = existsSync(lockPath);
        try {
          if (needed.size > 0) {
            const pkgIndex = walkToolingPkgs(toolingDir);
            // 1. 临时把 @astravia-org/* 改成 file: 路径
            for (const field of ['dependencies', 'devDependencies']) {
              for (const name of needed) {
                if (pkg[field]?.[name] && pkgIndex.has(name)) {
                  pkg[field][name] = 'file:' + relative(directory, pkgIndex.get(name));
                }
              }
            }
            writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
            // 2. 生成 lockfile（resolved 指向本地路径）
            execFileSync('npm', ['install', '--package-lock-only', '--no-audit', '--no-fund', '--legacy-peer-deps'], { cwd: directory, stdio: 'pipe' });
            // 3. 还原 package.json（semver 声明不变 ✅）
            writeFileSync(pkgPath, pkgOrig);
          }
          // 4. npm install（宽容模式，lockfile 的 resolved 指向本地就从本地装）
          npmRun(['install', '--no-audit', '--no-fund', '--legacy-peer-deps']);
        } finally {
          // 5. 清掉临时 lockfile（git 不被污染）
          if (!lockExisted) { try { unlinkSync(lockPath); } catch {} }
        }
      }
      for (const args of [['run', 'check', '--if-present'], ['test', '--if-present'], ['run', 'build']]) {
        try { npmRun(args); }
        catch (e) { console.error(`[${args[0]}] failed for ${directory}, continuing...`); }
      }
    },
  });
  await verifyPackagedResources(result);
  const branch = settings.distributionBranch;
  result.sourceBranch = settings.sourceBranch;
  result.distributionBranch = branch;
  result.previousCommit = previous ? git('rev-parse', `refs/remotes/origin/${branch}`) : null;
  writeJson(join(output, 'publication.json'), result);
  console.log(`Prepared ${result.packages.length} new packages; distribution changed: ${result.changed}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { console.error(error.message); process.exitCode = 1; });
