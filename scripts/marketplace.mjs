import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
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
