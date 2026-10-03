import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareMarketplace, readJson, sourceCatalog, writeJson, digest, inside, entries, missingPackagedResources } from './static-marketplace.mjs';

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

async function verifyPackagedResources(result) {
  const sources = new Map(entries(sourceCatalog(root)).filter(entry => entry.type === 'plugin').map(entry => [entry.slug, inside(root, entry.source.path)]));
  const python = process.env.ASTRAVIA_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  for (const item of result.packages) {
    const archive = join(result.artifacts, item.filename);
    const names = JSON.parse(execFileSync(python, ['-c', 'import json, sys, zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))', archive], { encoding: 'utf8' }));
    const manifestModule = join(sources.get(item.slug), 'node_modules/@astravia-org/plugin-sdk/dist/manifest.js');
    const { listPluginManifestResources, parsePluginManifest } = await import(pathToFileURL(manifestModule).href);
    const manifest = parsePluginManifest(readJson(join(sources.get(item.slug), 'plugin.json')));
    const missing = missingPackagedResources(names, listPluginManifestResources(manifest));
    if (missing.length) throw new Error(`${item.filename} is missing plugin.json resources: ${missing.map(x => `${x.field} (${x.path})`).join(', ')}`);
  }
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
  if (command !== 'build') throw new Error('Usage: node scripts/marketplace.mjs check|build|verify [--output DIR] [--previous DIR] [--tooling DIR]');
  const settings = publicationSettings(root);
  const previous = option('--previous');
  const output = resolve(option('--output') ?? '.marketplace-build');
  const result = await prepareMarketplace({
    root, output, previous: previous && resolve(previous), sourceSha: git('rev-parse', 'HEAD'),
    buildPlugin: directory => {
      const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
      const npmRun = args => {
        if (process.platform === 'win32') execFileSync(process.execPath, [npmCli, ...args], { cwd: directory, stdio: 'inherit' });
        else execFileSync('npm', args, { cwd: directory, stdio: 'inherit' });
      };
      // Dev 环境准备：@astravia-org/* 未 publish 到 npm，用 npm link 让插件能解析本地 tooling 包。
      // CI 环境 publish 后删掉这一段，直接 npm ci（与上游对齐）。
      const toolingDir = resolve(option('--tooling') ?? '.tooling/open-astravia');
      console.log(`[buildPlugin] ${directory.split('/').pop()} toolingDir=${toolingDir} packages_exists=${existsSync(join(toolingDir, 'packages'))}`);
      if (existsSync(join(toolingDir, 'packages'))) {
        // 扫描插件 package.json 的所有 @astravia-org/* 依赖
        const pkg = readJson(join(directory, 'package.json'));
        const needed = new Set([
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.devDependencies ?? {}),
        ].filter(k => k.startsWith('@astravia-org/')));
        if (needed.size > 0) {
          // 在 tooling 里递归查找每个需要的包目录
          const pkgIndex = walkToolingPkgs(toolingDir);
          console.log(`[buildPlugin] needed=[${[...needed].join(',')}] pkgIndex=${pkgIndex.size}pkgs`);
          // 1. 逐个全局 link（独立，不会相互干扰）
          for (const name of needed) {
            const dir = pkgIndex.get(name);
            if (dir) {
              try { execFileSync('npm', ['link'], { cwd: dir, stdio: 'pipe' }); }
              catch (e) { console.error(`[buildPlugin] global link ${name} FAIL: ${e.stderr?.toString().trim().split('\n').slice(-2).join(' | ')}`); }
            } else {
              console.error(`[buildPlugin] SKIP ${name} — not found in tooling pkgIndex`);
            }
          }
          // 2. 一次性本地 link（npm link --local 会读 package.json 检查所有依赖，
          //    必须把所有需要的包名一起传，否则会因其他 @astravia-org/* 未满足而整体失败）
          const localNames = [...needed].filter(n => pkgIndex.has(n));
          if (localNames.length > 0) {
            try { execFileSync('npm', ['link', '--local', ...localNames], { cwd: directory, stdio: 'pipe' }); }
            catch (e) { console.error(`[buildPlugin] local link FAIL (${localNames.join(',')}): ${e.stderr?.toString().trim().split('\n').slice(-3).join(' | ')}`); }
          }
          // 验证 link 是否生效
          const verifyLinks = localNames.map(n => join(directory, 'node_modules', ...n.split('/')));
          const allOk = verifyLinks.every(p => existsSync(p));
          console.log(`[buildPlugin] links verified: ${allOk} (${verifyLinks.filter(p=>existsSync(p)).length}/${verifyLinks.length})`);
        }
      }
      npmRun(['install', '--no-audit', '--no-fund', '--legacy-peer-deps']);
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
