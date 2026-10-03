import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { deflateSync } from 'node:zlib';

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

// ─── Node.js 原生 .astraviapkg 打包（替代 stage-plugin-release.py）─────────
// ZIP DEFLATED level 9，固定时间戳 1980-01-01 —— 与 Python zipfile 输出完全一致

const RUNTIME_FILES = new Set(['plugin.json', 'package.json', 'README.md', 'LICENSE', 'runtime-lock.json', 'upstream.json']);
const RUNTIME_DIRS = ['dist', 'locales', 'agent', 'assets', 'service'];
const SKIP_DIRS = new Set(['node_modules', 'src', 'test', 'tests', 'release', '.git', '.vite']);
const MAX_BYTES = 50 * 1024 * 1024;

// CRC32 查表（open-astravia pack.ts 同款）
const CRC_TABLE = new Uint32Array(256);
{
  for (let i = 0; i < 256; i += 1) {
    let v = i;
    for (let bit = 0; bit < 8; bit += 1) v = (v & 1) ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    CRC_TABLE[i] = v >>> 0;
  }
}
function crc32(buf) {
  let v = 0xffffffff;
  for (const byte of buf) v = CRC_TABLE[(v ^ byte) & 0xff] ^ (v >>> 8);
  return (v ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(buf, off, val) { buf.writeUInt16LE(val, off); return off + 2; }
function writeUInt32LE(buf, off, val) { buf.writeUInt32LE(val >>> 0, off); return off + 4; }

/** 遍历 plugin 目录，筛选运行时文件 —— 与 Python regular_files() 一致 */
function regularFiles(directory) {
  const result = [];
  for (const name of [...RUNTIME_FILES].sort()) {
    const p = join(directory, name);
    if (existsSync(p)) result.push(p);
  }
  for (const name of RUNTIME_DIRS.sort()) {
    const parent = join(directory, name);
    if (!existsSync(parent)) continue;
    if (lstatSync(parent).isSymbolicLink()) throw new Error(`Plugin contains a symlink: ${parent}`);
    const walk = (current) => {
      for (const dirname of readdirSync(current, { withFileTypes: true }).filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))) {
        const child = join(current, dirname.name);
        if (lstatSync(child).isSymbolicLink()) throw new Error(`Plugin contains a symlink: ${child}`);
        walk(child);
      }
      for (const filename of readdirSync(current, { withFileTypes: true }).filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        result.push(join(current, filename.name));
      }
    };
    walk(parent);
  }
  for (const p of result) {
    if (lstatSync(p).isSymbolicLink() || !lstatSync(p).isFile()) throw new Error(`Plugin contains a symlink or unsupported file: ${p}`);
  }
  return result.sort((a, b) => relative(directory, a).localeCompare(relative(directory, b), 'en'));
}

/** 特殊处理 dist/mf-stats.json（sorted buildOutput + sorted JSON）—— 与 Python packaged_bytes() 一致 */
function packagedBytes(path, relativePosix) {
  const data = readFileSync(path);
  if (relativePosix !== 'dist/mf-stats.json') return data;
  const stats = JSON.parse(data.toString('utf8'));
  if (Array.isArray(stats.buildOutput)) {
    stats.buildOutput.sort((a, b) => {
      const af = typeof a === 'object' && a ? a.fileName ?? '' : '';
      const at = typeof a === 'object' && a ? a.type ?? '' : '';
      const bf = typeof b === 'object' && b ? b.fileName ?? '' : '';
      const bt = typeof b === 'object' && b ? b.type ?? '' : '';
      return af.localeCompare(bf) || at.localeCompare(bt);
    });
  }
  return Buffer.from(JSON.stringify(stats, null, 2).replace(/\n/g, '').replace(/ /g, ''));
}

/**
 * 打 ZIP 包 —— 与 Python zipfile.ZipFile 输出完全一致：
 * DEFLATED level 9、固定时间戳 1980-01-01、create_system=3 (Unix)、external_attr=0o100644 << 16
 */
function createDeflatedZip(fileEntries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of fileEntries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = entry.data;
    const compressed = deflateSync(raw, { level: 9 });
    const crc = crc32(raw);

    // Local File Header — 30 bytes + filename
    const local = Buffer.alloc(30 + name.length);
    let o = 0;
    o = writeUInt32LE(local, o, 0x04034b50);       // signature
    o = writeUInt16LE(local, o, 20);               // version needed (2.0)
    o = writeUInt16LE(local, o, 0);                // flags
    o = writeUInt16LE(local, o, 8);                // compression: DEFLATED
    o = writeUInt16LE(local, o, 0);                // mod time: 00:00:00
    o = writeUInt16LE(local, o, 33);               // mod date: 1980-01-01 (year=0, month=1, day=1 → 1<<9 | 1<<5 | 1 = 33)
    o = writeUInt32LE(local, o, crc);              // CRC-32
    o = writeUInt32LE(local, o, compressed.length); // compressed size
    o = writeUInt32LE(local, o, raw.length);        // uncompressed size
    o = writeUInt16LE(local, o, name.length);       // filename length
    o = writeUInt16LE(local, o, 0);                 // extra length
    name.copy(local, o);
    localParts.push(local, compressed);

    // Central Directory Entry — 46 bytes + filename
    const central = Buffer.alloc(46 + name.length);
    o = 0;
    o = writeUInt32LE(central, o, 0x02014b50);      // signature
    o = writeUInt16LE(central, o, 20);              // version made by
    o = writeUInt16LE(central, o, 20);              // version needed
    o = writeUInt16LE(central, o, 0);               // flags
    o = writeUInt16LE(central, o, 8);                // compression
    o = writeUInt16LE(central, o, 0);                // mod time
    o = writeUInt16LE(central, o, 33);              // mod date
    o = writeUInt32LE(central, o, crc);             // CRC-32
    o = writeUInt32LE(central, o, compressed.length); // compressed size
    o = writeUInt32LE(central, o, raw.length);        // uncompressed size
    o = writeUInt16LE(central, o, name.length);       // filename length
    o = writeUInt16LE(central, o, 0);                 // extra length
    o = writeUInt16LE(central, o, 0);                 // comment length
    o = writeUInt16LE(central, o, 0);                 // disk number
    o = writeUInt16LE(central, o, 0);                 // internal attributes
    o = writeUInt32LE(central, o, 0o100644 << 16);   // external attributes (Unix regular file, 0644)
    o = writeUInt32LE(central, o, offset);            // local header offset
    name.copy(central, o);
    centralParts.push(central);

    offset += local.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  // End of Central Directory — 22 bytes
  const eocd = Buffer.alloc(22);
  let o = 0;
  o = writeUInt32LE(eocd, o, 0x06054b50);    // signature
  o = writeUInt16LE(eocd, o, 0);             // disk number
  o = writeUInt16LE(eocd, o, 0);             // disk with central dir
  o = writeUInt16LE(eocd, o, fileEntries.length); // entries on this disk
  o = writeUInt16LE(eocd, o, fileEntries.length); // total entries
  o = writeUInt32LE(eocd, o, centralDir.length);  // central dir size
  o = writeUInt32LE(eocd, o, offset);             // central dir offset
  o = writeUInt16LE(eocd, o, 0);                  // comment length

  return Buffer.concat([...localParts, centralDir, eocd]);
}

/** Node.js 版 stage-plugin-release.py 的 build() —— 返回 release JSON + 写包到 output_dir */
function buildAstraviaPackage({ slug, directory, outputDir, minAppVersion, repository }) {
  if (!/^\d+\.\d+\.\d+$/.test(minAppVersion)) throw new Error('--min-app-version must be a stable x.y.z version');
  const plugin = readJson(join(directory, 'plugin.json'));
  if (plugin.id !== slug) throw new Error(`Plugin identity differs from catalog: ${slug}`);
  if (!resolve(directory).startsWith(resolve(join(directory, '..')))) throw new Error(`Unsafe or missing plugin directory: ${slug}`);

  const files = regularFiles(directory);
  const paths = new Set(files.map(p => relative(directory, p).replace(/\\/g, '/')));
  for (const required of ['plugin.json', plugin.entry, ...(plugin.styles ?? [])]) {
    if (!paths.has(required)) throw new Error(`Missing packaged plugin file: ${slug}/${required}`);
  }

  const filename = `${slug}-${plugin.version}.astraviapkg`;
  mkdirSync(outputDir, { recursive: true });
  const target = join(outputDir, filename);

  try {
    const entries = files.map(p => ({
      name: relative(directory, p).replace(/\\/g, '/'),
      data: packagedBytes(p, relative(directory, p).replace(/\\/g, '/')),
    }));
    const zip = createDeflatedZip(entries);
    if (zip.length > MAX_BYTES) throw new Error(`Plugin package exceeds the 50 MB Desktop limit: ${slug}`);
    writeFileSync(target, zip);
  } catch (err) {
    rmSync(target, { force: true });
    throw err;
  }

  const data = readFileSync(target);
  const release = {
    version: plugin.version,
    minAppVersion,
    pluginApiVersion: plugin.pluginApiVersion,
    permissions: plugin.permissions ?? [],
    commands: plugin.commands ?? [],
    artifact: {
      url: `${repository}/releases/download/plugin-${slug}/${filename}`,
      sha256: digest(data),
    },
  };
  return { release, filename };
}

/** 从 .astraviapkg 的中央目录读出所有文件名 —— 替代 python zipfile.ZipFile().namelist() */
export function zipNamelist(buf) {
  const data = Buffer.isBuffer(buf) ? buf : readFileSync(buf);
  // 从末尾向前找 EOCD signature：0x06054b50
  let eocdOff = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i -= 1) {
    if (data.readUInt32LE(i) === 0x06054b50) { eocdOff = i; break; }
  }
  if (eocdOff < 0) throw new Error('Not a valid ZIP file');
  const centralSize = data.readUInt32LE(eocdOff + 12);
  const centralOff = data.readUInt32LE(eocdOff + 16);
  const names = [];
  let o = centralOff;
  while (o < centralOff + centralSize) {
    if (data.readUInt32LE(o) !== 0x02014b50) throw new Error('Corrupted central directory');
    const nameLen = data.readUInt16LE(o + 28);
    const extraLen = data.readUInt16LE(o + 30);
    const commentLen = data.readUInt16LE(o + 32);
    names.push(data.slice(o + 46, o + 46 + nameLen).toString('utf8'));
    o += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

export async function prepareMarketplace({ root, output, previous, sourceSha, buildPlugin, date = new Date().toISOString().slice(0, 10).replaceAll('-', '.') }) {
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
      if (!existing || migrate) {
        if (!existing && releases.some(x => compareVersion(x.version, descriptor.version) >= 0)) throw new Error(`New version must advance: ${entry.slug}`);
        if (migrate) releases.splice(releases.indexOf(existing), 1);
        await buildPlugin(source);
        const { release } = buildAstraviaPackage({ slug: entry.slug, directory: source, outputDir: artifacts, minAppVersion: entry.minAppVersion, repository: catalog.repository });
        if (release.artifact.url !== artifact.url) throw new Error(`Unexpected artifact URL for ${entry.slug}`);
        if (migrate && release.artifact.sha256 !== existing.artifact.sha256) throw new Error(`Published bytes differ for ${entry.slug}; use a new version`);
        releases.push(release);
        packages.push({ slug: entry.slug, release, filename: artifact.filename, tag: artifact.tag });
      } else {
        // 旧版本也要 build + 打包进 artifacts/ — publish 时本地必须有 artifact（方向绝不反）
        // 校验 release declaration 没变（runtime contract）；SHA 允许变（vite chunk hash 不可重现）
        await buildPlugin(source);
        const { release } = buildAstraviaPackage({ slug: entry.slug, directory: source, outputDir: artifacts, minAppVersion: entry.minAppVersion, repository: catalog.repository });
        // 注意：这里不校验 SHA。原因：vite 每次 build 的 chunk hash 不可重现（hostInit-Kih44fBa.js vs hostInit-CiEW-qHO.js），
        // 同样源码每次 build SHA 不同。else 分支只做 build+pack 确保 artifacts/ 有东西，
        // 真正的 SHA 权威来自 publish 时的 GitHub Release 已有 artifact。
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
