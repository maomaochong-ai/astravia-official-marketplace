import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
export const writeJson = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); };
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
const excluded = new Set(['.git', 'node_modules', '.vite', '__pycache__', 'test', 'tests', 'AGENTS.md', '.DS_Store']);

export function inside(root, path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.includes('\0') || path.split('/').some(x => !x || x === '.' || x === '..') || isAbsolute(path) || /^[A-Za-z]:/.test(path)) throw new Error(`Unsafe path: ${path}`);
  const target = resolve(root, path);
  const rel = relative(resolve(root), target);
  if (!rel || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Unsafe path: ${path}`);
  let cursor = resolve(root);
  for (const part of path.split('/')) {
    cursor = join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error(`Unsafe symlink: ${path}`);
  }
  return target;
}

export function files(root, include = () => true, prefix = '') {
  return readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap(entry => {
    const path = `${prefix}${entry.name}`;
    if (!include(path)) return [];
    if (entry.isSymbolicLink()) throw new Error(`Unsafe symlink: ${entry.name}`);
    if (entry.isDirectory()) return files(join(root, entry.name), include, `${path}/`).map(child => `${entry.name}/${child}`);
    if (!entry.isFile()) throw new Error(`Unsupported file: ${entry.name}`);
    return [entry.name];
  });
}

export function entries(catalog) {
  return catalog.abilities.flatMap(ability => [ability, ...(ability.type === 'bundle' ? ability.config.members.filter(x => x.source) : [])]);
}

// Desktop rejects a package whose plugin.json names a file the archive does not contain.
// Resources come from the plugin SDK's own listing so the check follows the host contract.
export function missingPackagedResources(names, resources) {
  const packaged = new Set(names);
  return resources.filter(({ path, kind }) => {
    const normalized = path.replace(/^\.\//u, '').replace(/\/+$/u, '');
    if (packaged.has(normalized)) return false;
    return kind !== 'file-or-directory' || !names.some(name => name.startsWith(`${normalized}/`));
  });
}

export function sourceCatalog(root) {
  const catalog = readJson(join(root, '.astravia/marketplace.source.json'));
  if (catalog.schemaVersion !== 3 || !slugPattern.test(catalog.name) || !versionPattern.test(catalog.minAppVersion) || !Array.isArray(catalog.abilities) || !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(catalog.repository)) throw new Error('Invalid marketplace source configuration');
  if ('marketplaceVersion' in catalog) throw new Error('marketplaceVersion is generated, not authored');
  const seen = new Map();
  for (const entry of entries(catalog)) {
    if (!slugPattern.test(entry.slug) || !['plugin', 'skill', 'mcp', 'bundle', 'scene'].includes(entry.type) || entry.releases) throw new Error(`Invalid source entry: ${entry.slug}`);
    if (!entry.source && entry.type === 'bundle') continue;
    const directory = inside(root, entry.source?.path);
    const identity = entry.version ? entry : readJson(join(directory, 'ability.json'));
    if (!identity.version || identity.slug !== entry.slug || identity.type !== entry.type) throw new Error(`Identity mismatch: ${entry.slug}`);
    const previous = seen.get(entry.slug);
    if (previous && (previous.type !== entry.type || previous.source.path !== entry.source.path || previous.minAppVersion !== entry.minAppVersion)) throw new Error(`Conflicting identity: ${entry.slug}`);
    seen.set(entry.slug, entry);
    const presentationPath = join(directory, 'ability.json');
    if (existsSync(presentationPath)) {
      const presentation = readJson(presentationPath);
      if (presentation.type !== entry.type || presentation.slug !== entry.slug || presentation.version !== identity.version) throw new Error(`Presentation identity mismatch: ${entry.slug}`);
    }
    if (entry.type === 'plugin') {
      const descriptor = readJson(join(directory, 'plugin.json'));
      if (descriptor.id !== entry.slug || descriptor.version !== identity.version || !versionPattern.test(descriptor.version) || !versionPattern.test(entry.minAppVersion)) throw new Error(`Plugin identity or minAppVersion mismatch: ${entry.slug}`);
      if (compareVersion(entry.minAppVersion, catalog.minAppVersion) < 0) throw new Error(`Plugin minimum is below the catalog reader minimum: ${entry.slug}`);
    } else if (entry.type === 'mcp') {
      const descriptor = readJson(join(directory, 'mcp.json'));
      if (descriptor.slug !== entry.slug || descriptor.version !== identity.version || entry.config) throw new Error(`MCP identity or configuration mismatch: ${entry.slug}`);
    } else if (entry.type === 'skill' || entry.type === 'scene') {
      const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(join(directory, 'SKILL.md'), 'utf8'))?.[1] ?? '';
      const scalar = key => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(header)?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2');
      if (scalar('name') !== entry.slug || scalar('version') !== identity.version || !scalar('description')) throw new Error(`Skill identity mismatch: ${entry.slug}`);
    }
  }
  return catalog;
}

function copyPackage(from, to, presentationOnly) {
  const resources = new Set(['ability.json']);
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && ['path', 'fallback', 'icon', 'src', 'brand_icon_url'].includes(key) && !/^(?:https?:|solar:)/.test(item)) {
        const path = inside(from, item);
        if (!resources.has(item)) {
          resources.add(item);
          if (item.endsWith('.json') && existsSync(path)) inspect(readJson(path));
        }
      } else if (typeof item === 'object') inspect(item);
    }
  };
  if (presentationOnly && existsSync(join(from, 'ability.json'))) inspect(readJson(join(from, 'ability.json')));
  const include = path => {
    const parts = path.split('/');
    if (parts.some(x => excluded.has(x) || x.startsWith('.env'))) return false;
    return !presentationOnly || [...resources].some(item => item === path || item.startsWith(`${path}/`)) || parts[0] === 'assets' || parts[0] === 'locales' || parts.length === 1 && (/^detail.*\.json$/.test(path) || /\.md$/.test(path) || /^LICENSE/.test(path));
  };
  for (const path of files(from, include)) {
    const target = inside(to, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(inside(from, path)));
  }
}

function compareVersion(a, b) {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function publishedPluginArtifact(repository, slug, version) {
  const filename = `${slug}-${version}.astraviapkg`;
  const tag = `plugin-${slug}`;
  return { filename, tag, url: `${repository}/releases/download/${tag}/${filename}` };
}

function needsPluginReleaseMigration(existing, expectedUrl) {
  if (!existing) return false;
  // Private marketplaces publish authenticated asset API URLs, which do not
  // expose their owning release tag. Preserve those opaque URLs here.
  return !existing.artifact.url.startsWith('https://api.github.com/repos/') && existing.artifact.url !== expectedUrl;
}

/** 把插件按当前源码打包到 `output-dir`，返回 release 记录（与发布时同一个打包器）。 */
function stagePackage({ root, slug, minAppVersion, outputDir }) {
  const python = process.env.ASTRAVIA_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const packager = fileURLToPath(new URL('./stage-plugin-release.py', import.meta.url));
  return JSON.parse(execFileSync(python, [packager, slug, '--root', root, '--min-app-version', minAppVersion, '--output-dir', outputDir], { encoding: 'utf8' }));
}

/**
 * 插件目录下哪些改动真的会改变运行内容（也就是会改变 `.astraviapkg` 的字节）。
 *
 * 白名单而不是黑名单：目录里还挤着 README、detail.json、ability.json 与测试，
 * 它们随分发目录更新，不需要（也不应该）因此抬版本。反过来，一旦这些白名单路径
 * 动过而版本号又已经发布过，这次改动就永远不会出现在市场上——因为 `prepareMarketplace`
 * 不会为已发布过的版本重建包。
 */

/**
 * 发布提交信息里记录已审核源码的那一句。它同时是 `bump`/`--strict` 的基线来源：
 * 读端（`marketplace.mjs`）与写端（`publish-marketplace.mjs`）都从这里取，改措辞不会只改一半。
 */
export function reviewedSourceCommitMessage(marketplaceVersion, sourceSha) {
  return `chore(marketplace): 发布 ${marketplaceVersion}\n\n从已审核源码 ${sourceSha} 生成市场索引。`;
}

const REVIEWED_SOURCE_PATTERN = /从已审核源码 ([a-f0-9]{40})/;

/** 从发布提交信息里取回源码 sha；格式对不上就是 `null`（不知道，而不是「都没改」）。 */
export function reviewedSourceSha(message) {
  return REVIEWED_SOURCE_PATTERN.exec(message ?? '')?.[1] ?? null;
}
const RUNTIME_PATTERNS = [
  /^plugin\.json$/,
  /^package\.json$/,
  /^(?:src|agent|cases|locales|assets|scripts)\//,
];
const PRESENTATION_ONLY = [/^src\/test\//, /^docs\//];

export function runtimeSourcesChanged(paths, sourcePath) {
  const prefix = `${sourcePath}/`;
  return paths
    .filter(path => path.startsWith(prefix))
    .map(path => path.slice(prefix.length))
    .filter(path => !PRESENTATION_ONLY.some(pattern => pattern.test(path)))
    .filter(path => RUNTIME_PATTERNS.some(pattern => pattern.test(path)));
}

function treeDigest(root, manifest) {
  const { marketplaceVersion, ...content } = manifest;
  const hash = createHash('sha256').update(JSON.stringify(content));
  for (const path of files(root, path => path !== '.git').filter(x => !x.startsWith('.astravia/') && x !== '.nojekyll')) hash.update(path).update('\0').update(readFileSync(join(root, path)));
  return hash.digest('hex');
}

function nextVersion(current, date) {
  const match = /^(\d{4}\.\d{2}\.\d{2})-(\d+)$/.exec(current ?? '');
  if (!match || date > match[1]) return `${date}-1`;
  return `${match[1]}-${Number(match[2]) + 1}`;
}


/** 版本号只承接三个数字；`level` 就是抬高哪一位。 */
function raiseVersion(version, level) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * 源里的插件版本已经发布过了，但内容变了：算一下该抬到哪一版。
 *
 * 只看「已发布最高版」而不看「源码版本是否落后」，因为分发索引是真相；源码版本低于它时
 * 从已发布版继续抬，抬出来的版本依然单调递增。纯函数，不写盘。
 */
export function planVersionBumps({ root, published, level = 'patch', slugs }) {
  const catalog = sourceCatalog(root);
  const publishedEntries = new Map(published ? entries(published).map(x => [x.slug, x]) : []);
  const bumps = [];
  for (const entry of entries(catalog)) {
    if (entry.type !== 'plugin' || !entry.source) continue;
    if (slugs && !slugs.has(entry.slug)) continue;
    const descriptor = readJson(join(inside(root, entry.source.path), 'plugin.json'));
    const releases = publishedEntries.get(entry.slug)?.releases ?? [];
    const highest = releases.map(x => x.version).sort(compareVersion).at(-1);
    if (!highest || compareVersion(descriptor.version, highest) > 0) continue;
    bumps.push({ slug: entry.slug, from: descriptor.version, published: highest, to: raiseVersion(highest, level) });
  }
  return bumps;
}

/** 把新版本写进五份身份文件；不碰任何运行内容。 */
export function applyVersionBump({ root, slug, to }) {
  const catalogPath = join(root, '.astravia/marketplace.source.json');
  const catalog = readJson(catalogPath);
  // 同一个插件可以既在顶层注册、又被 bundle 以成员路径引用：`entries()` 会把它返回两次。
  // 只改第一份会让另一份留着旧版本，下一次 `sourceCatalog` 直接报身份不一致。
  const matches = entries(catalog).filter(x => x.slug === slug && x.type === 'plugin' && x.source);
  if (!matches.length) throw new Error(`Unknown plugin entry: ${slug}`);
  const directory = inside(root, matches[0].source.path);
  const written = [];
  for (const name of ['plugin.json', 'ability.json', 'package.json']) {
    const path = join(directory, name);
    if (!existsSync(path)) continue;
    const value = readJson(path);
    value.version = to;
    writeJson(path, value);
    written.push(relative(root, path));
  }
  const lockPath = join(directory, 'package-lock.json');
  if (existsSync(lockPath)) {
    const lock = readJson(lockPath);
    lock.version = to;
    if (lock.packages?.['']) lock.packages[''].version = to;
    writeJson(lockPath, lock);
    written.push(relative(root, lockPath));
  }
  for (const match of matches) if ('version' in match) match.version = to;
  writeJson(catalogPath, catalog);
  written.push(relative(root, catalogPath));
  return written.map(x => x.split(sep).join('/'));
}


export async function prepareMarketplace({ root, output, previous, sourceSha, buildPlugin, date = new Date().toISOString().slice(0, 10).replaceAll('-', '.'), strictSlugs }) {
  if (existsSync(output)) throw new Error(`Output already exists: ${output}`);
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('A fixed source commit is required');
  const catalog = sourceCatalog(root);
  const old = previous && existsSync(join(previous, '.astravia/marketplace.json')) ? readJson(join(previous, '.astravia/marketplace.json')) : undefined;
  if (old && old.repository !== catalog.repository) throw new Error('Published repository identity differs');
  const oldEntries = new Map(old ? entries(old).map(x => [x.slug, x]) : []);
  const site = join(output, 'site'), artifacts = join(output, 'artifacts');
  mkdirSync(site, { recursive: true });
  mkdirSync(artifacts, { recursive: true });
  const packages = [], resolved = new Map();
  for (const entry of entries(catalog)) {
    if (!entry.source) continue;
    const source = inside(root, entry.source.path);
    const identity = entry.version ? entry : readJson(join(source, 'ability.json'));
    const oldEntry = oldEntries.get(entry.slug);
    const target = inside(site, entry.source.path);
    if (entry.type === 'plugin') {
      if (resolved.has(entry.slug)) { entry.releases = resolved.get(entry.slug); delete entry.minAppVersion; continue; }
      const descriptor = readJson(join(source, 'plugin.json'));
      const releases = structuredClone(oldEntry?.releases ?? []);
      const existing = releases.find(x => x.version === descriptor.version);
      const artifact = publishedPluginArtifact(catalog.repository, entry.slug, descriptor.version);
      if (existing && (existing.minAppVersion !== entry.minAppVersion || existing.pluginApiVersion !== descriptor.pluginApiVersion || JSON.stringify(existing.permissions) !== JSON.stringify(descriptor.permissions ?? []) || JSON.stringify(existing.commands) !== JSON.stringify(descriptor.commands ?? []))) throw new Error(`Changed release declaration for ${entry.slug}; publish a new version`);
      const migrate = needsPluginReleaseMigration(existing, artifact.url);
      // `strictSlugs`：这些插件的运行内容自上次发布后动过（路径判定见 `runtimeSourcesChanged`）。
      // 版本号还停在已发布的那一版时，这里既不重建也不发布，那笔改动就永远上不了市场，
      // 所以直接在构建阶段拒绝，并指向抬版本的命令。
      // 不用「重打包比摘要」做判据：依赖范围是浮动的，同一份源码重装后字节会变，
      // 那种误报会把无关的发布全部卡住（已在 open-ai-canvas 上实测）。
      if (existing && !migrate && strictSlugs?.has(entry.slug)) {
        throw new Error(`Runtime files changed under published version ${entry.slug} ${descriptor.version}: this change would never reach the marketplace, because a published version is not rebuilt. Run \`node scripts/marketplace.mjs bump --slug ${entry.slug} --apply\` — it rewrites plugin.json, ability.json, package.json, package-lock.json and .astravia/marketplace.source.json — then commit the new version.`);
      }
      if (!existing || migrate) {
        if (!existing && releases.some(x => compareVersion(x.version, descriptor.version) >= 0)) throw new Error(`New version must advance: ${entry.slug}`);
        if (migrate) releases.splice(releases.indexOf(existing), 1);
        await buildPlugin(source);
        const release = stagePackage({ root, slug: entry.slug, minAppVersion: entry.minAppVersion, outputDir: artifacts });
        if (release.artifact.url !== artifact.url) throw new Error(`Unexpected artifact URL for ${entry.slug}`);
        if (migrate && release.artifact.sha256 !== existing.artifact.sha256) throw new Error(`Published bytes differ for ${entry.slug}; use a new version`);
        releases.push(release);
        packages.push({ slug: entry.slug, release, filename: artifact.filename, tag: artifact.tag });
      }
      entry.releases = releases.sort((a, b) => compareVersion(a.version, b.version));
      if (entry.version) entry.version = entry.releases.at(-1).version;
      delete entry.minAppVersion;
      resolved.set(entry.slug, entry.releases);
      copyPackage(source, target, true);
    } else {
      const oldSource = previous && oldEntry?.source && inside(previous, oldEntry.source.path);
      const oldVersion = oldEntry?.version ?? (oldSource && existsSync(join(oldSource, 'ability.json')) ? readJson(join(oldSource, 'ability.json')).version : undefined);
      // Non-plugin runtime content is already installable; preserve its published bytes until a version bump.
      const reuse = oldSource && existsSync(oldSource) && oldVersion === identity.version;
      copyPackage(reuse ? oldSource : source, target, false);
      if (reuse && entry.type === 'bundle') {
        const authored = value => JSON.stringify(value, (key, item) => ['releases', 'minAppVersion'].includes(key) ? undefined : item);
        if (authored(entry.config) !== authored(oldEntry.config)) throw new Error(`Bundle configuration changed: ${entry.slug}; publish a new version`);
      }
    }
  }
  // Bundle references may reuse the same plugin; all occurrences use the resolved immutable history.
  for (const entry of entries(catalog)) if (entry.type === 'plugin' && resolved.has(entry.slug)) entry.releases = resolved.get(entry.slug);
  const contentHash = treeDigest(site, catalog);
  const unchanged = previous && old && contentHash === treeDigest(previous, old);
  catalog.marketplaceVersion = unchanged ? old.marketplaceVersion : nextVersion(old?.marketplaceVersion, date);
  writeJson(join(site, '.astravia/marketplace.json'), catalog);
  writeFileSync(join(site, '.nojekyll'), '');
  const result = { site, artifacts, changed: !unchanged, sourceSha, previousVersion: old?.marketplaceVersion ?? null, packages };
  writeJson(join(output, 'publication.json'), result);
  return result;
}
