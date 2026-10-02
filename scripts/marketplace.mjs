import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
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
  const python = process.env.ASTRAVIA_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
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
  const vendorDir = join(root, '_vendor/@astravia-org');
  const hasVendor = existsSync(vendorDir);

  function installVendorPackages(directory) {
    if (!hasVendor) return;
    const nmDir = join(directory, 'node_modules/@astravia-org');
    mkdirSync(nmDir, { recursive: true });
    for (const pkg of readdirSync(vendorDir)) {
      const src = join(vendorDir, pkg);
      const dest = join(nmDir, pkg);
      if (!lstatSync(src).isDirectory()) continue;
      if (existsSync(dest)) execFileSync('rm', ['-rf', dest]);
      execFileSync('cp', ['-R', src, dest]);
    }
  }

  // Install vendor packages with all their dependencies into node_modules.
  // Each _vendor package has its own node_modules from `npm install --legacy-peer-deps`.
  // We flatten them into the plugin's node_modules.
  function installVendorPackages(directory) {
    if (!hasVendor) return;
    const nmDir = join(directory, 'node_modules');
    const aoDir = join(nmDir, '@astravia-org');
    mkdirSync(aoDir, { recursive: true });
    // Remove any stale vendored packages first
    for (const pkg of readdirSync(vendorDir)) {
      const dest = join(aoDir, pkg);
      if (existsSync(dest)) execFileSync('rm', ['-rf', dest]);
    }
    for (const pkg of readdirSync(vendorDir)) {
      const src = join(vendorDir, pkg);
      const dest = join(aoDir, pkg);
      if (!lstatSync(src).isDirectory()) continue;
      execFileSync('cp', ['-R', src, dest]);
      // Flatten vendor package's node_modules into plugin's node_modules
      const vendorNm = join(src, 'node_modules');
      if (existsSync(vendorNm)) {
        for (const dep of readdirSync(vendorNm)) {
          const depSrc = join(vendorNm, dep);
          const depDest = join(nmDir, dep);
          if (existsSync(depDest)) continue; // skip if already installed
          if (dep.startsWith('@')) {
            const scopeNm = join(nmDir, dep);
            mkdirSync(scopeNm, { recursive: true });
            for (const sub of readdirSync(depSrc)) {
              const subSrc = join(depSrc, sub);
              const subDest = join(scopeNm, sub);
              if (!existsSync(subDest)) execFileSync('cp', ['-R', subSrc, subDest]);
            }
          } else {
            execFileSync('cp', ['-R', depSrc, depDest]);
          }
        }
      }
    }
  }

  // Create a temporary package.json that removes @astravia-org/* deps
  // so npm install doesn't try to resolve them from the registry.
  function tempPackageJsonForInstall(directory) {
    if (!hasVendor) return null;
    const pkgPath = join(directory, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    let changed = false;
    for (const field of ['dependencies', 'devDependencies']) {
      const deps = pkg[field];
      if (!deps) continue;
      for (const key of Object.keys(deps)) {
        if (key.startsWith('@astravia-org/')) {
          delete deps[key];
          changed = true;
        }
      }
    }
    if (!changed) return null;
    const backup = pkgPath + '.bak';
    writeFileSync(backup, readFileSync(pkgPath, 'utf8'));
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    return backup;
  }

  function restorePackageJson(backup) {
    if (!backup) return;
    const pkgPath = backup.replace(/\.bak$/, '');
    writeFileSync(pkgPath, readFileSync(backup, 'utf8'));
    execFileSync('rm', [backup]);
  }

  const result = await prepareMarketplace({
    root, output, previous: previous && resolve(previous), sourceSha: git('rev-parse', 'HEAD'),
    buildPlugin: directory => {
      const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
      // @astravia-org/* packages are not on npm registry.
      // Temporarily remove them from package.json, npm install remaining deps,
      // then inject vendored packages with their dependencies flattened.
      const backup = tempPackageJsonForInstall(directory);
      try {
        if (process.platform === 'win32') execFileSync(process.execPath, [npmCli, 'install', '--no-package-lock'], { cwd: directory, stdio: 'inherit' });
        else execFileSync('npm', ['install', '--no-package-lock'], { cwd: directory, stdio: 'inherit' });
      } finally {
        installVendorPackages(directory);
        restorePackageJson(backup);
      }
      for (const args of [['run', 'check', '--if-present'], ['test', '--if-present'], ['run', 'build']]) {
        if (process.platform === 'win32') execFileSync(process.execPath, [npmCli, ...args], { cwd: directory, stdio: 'inherit' });
        else execFileSync('npm', args, { cwd: directory, stdio: 'inherit' });
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
