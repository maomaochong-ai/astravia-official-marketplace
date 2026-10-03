import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest, files, inside, readJson, writeJson } from './static-marketplace.mjs';
import { publicationSettings } from './marketplace.mjs';

export function assertExistingRelease(item, bytes) {
  if (digest(bytes) !== item.release.artifact.sha256) throw new Error(`Published bytes differ for ${item.slug}; use a new version`);
}

function isMissingRelease(error) {
  const message = String(error.stderr ?? error.message).toLowerCase();
  return message.includes('404') || message.includes('release not found');
}

function normalizeRelease(raw) {
  return {
    tag_name: raw.tag_name,
    draft: raw.draft,
    target_commitish: raw.target_commitish,
    assets: (raw.assets ?? []).map(asset => ({
      name: asset.name,
      id: asset.id,
      url: asset.url,
      browser_download_url: asset.browser_download_url,
    })),
  };
}

function releaseByTag(gh, repository, tag) {
  // 只用 gh api — 返回完整 asset 对象含 id
  // 如果 gh api 不可用，整个 publish 都不可能工作（后面还要调 N 次 gh api）
  try {
    const release = JSON.parse(gh('api', `repos/${repository}/releases/tags/${tag}`));
    return normalizeRelease(release);
  } catch (error) {
    if (!isMissingRelease(error)) throw error;
    return undefined;
  }
}

/**
 * 确保 tag 对应的 GitHub Release 存在，然后用本地 artifact 覆盖（delete+upload）。
 * 最后 download verify 确认 GitHub 上的 artifact SHA == expectedSha。
 */
function uploadArtifact({ gh, repository, tag, localPath, filename, expectedSha, sourceSha, releaseNotes, releaseTitle }) {
  let release = releaseByTag(gh, repository, tag);
  if (!release) {
    gh('release', 'create', tag, localPath, '--repo', repository, '--draft', '--target', sourceSha, '--title', releaseTitle, '--notes', releaseNotes);
    release = releaseByTag(gh, repository, tag);
    if (!release) throw new Error(`Created draft release is unavailable: ${tag}`);
  }
  // delete + upload 覆盖同名 asset
  const existing = release.assets.find(x => x.name === filename);
  if (existing) {
    gh('release', 'delete-asset', String(existing.id), '--repo', repository);
  }
  gh('release', 'upload', tag, localPath, '--repo', repository);
  // verify: 从 GitHub 下载确认 SHA == expectedSha
  const download = mkdtempSync(join(tmpdir(), 'astravia-verify-'));
  try {
    gh('release', 'download', tag, '--repo', repository, '--pattern', filename, '--dir', download);
    const got = digest(readFileSync(join(download, filename)));
    if (got !== expectedSha) throw new Error(`${filename}: 上传后 GitHub SHA 与 marketplace.json 不一致`);
  } finally { rmSync(download, { recursive: true, force: true }); }
  if (release.draft) gh('release', 'edit', tag, '--repo', repository, '--draft=false', '--latest=false');
}

// All writes are confined to append-only release assets and the generated distribution branch.
export async function publishMarketplace({ root, directory, gh = (...args) => execFileSync('gh', args, { cwd: root, encoding: 'utf8' }).trim(), verify, readRemote, push, refName = process.env.GITHUB_REF_NAME }) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const settings = publicationSettings(root);
  readRemote ??= branch => git('ls-remote', 'origin', `refs/heads/${branch}`).split(/\s/)[0] || null;
  push ??= commit => git('push', 'origin', `${commit}:refs/heads/${settings.distributionBranch}`);
  const publication = readJson(join(directory, 'publication.json'));
  const source = readJson(join(root, '.astravia/marketplace.source.json'));
  const catalogPath = join(directory, 'site/.astravia/marketplace.json');
  const catalog = readJson(catalogPath);
  if (source.repository !== catalog.repository || git('rev-parse', 'HEAD') !== publication.sourceSha || publication.sourceBranch !== settings.sourceBranch || publication.distributionBranch !== settings.distributionBranch) throw new Error('Candidate source identity differs');
  const repository = new URL(source.repository).pathname.slice(1);
  if (refName && refName !== settings.sourceBranch) throw new Error('Publication must run from the configured source branch');
  if (readRemote(settings.sourceBranch) !== publication.sourceSha) throw new Error('Source branch advanced; rerun the latest revision');
  const remote = readRemote(settings.distributionBranch);
  if (remote !== publication.previousCommit) throw new Error('Distribution advanced; rebuild against the latest gh-pages');
  if (!publication.changed) return { published: false };
  await verify(directory);

  // ========== Step 1: 处理 publication.packages ==========
  // 这些 plugin 本地肯定有 artifact（prepareMarketplace 里 buildAstraviaPackage 打包的）
  // 方向：本地 artifact → SHA → marketplace.json / GitHub Release
  for (const item of publication.packages) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(item.slug) || item.tag !== `plugin-${item.slug}` || item.filename !== `${item.slug}-${item.release.version}.astraviapkg`) throw new Error('Invalid publication package');
    const archive = inside(join(directory, 'artifacts'), item.filename);
    const localSha = digest(readFileSync(archive));
    // marketplace.json SHA 必须跟本地 artifact 一致；不一致则覆写（本地为准）
    if (localSha !== item.release.artifact.sha256) {
      console.error(`[fix] ${item.slug}: marketplace.json SHA=${item.release.artifact.sha256.slice(0, 16)}... → 本地=${localSha.slice(0, 16)}... 覆写`);
      item.release.artifact.sha256 = localSha;
    }
    uploadArtifact({
      gh, repository,
      tag: item.tag,
      localPath: archive,
      filename: item.filename,
      expectedSha: item.release.artifact.sha256,
      sourceSha: publication.sourceSha,
      releaseTitle: `${item.slug} plugin packages`,
      releaseNotes: `Append-only Astravia plugin packages for ${item.slug}. The first package was built from ${publication.sourceSha}; version metadata and SHA-256 digests are recorded in the gh-pages marketplace index.`,
    });
  }

  // ========== Step 2: 遍历 marketplace.json 所有 plugin release record ==========
  // - 已在 packages 里的特定 filename：上面处理过了，跳过
  // - 不在 packages 里的：
  //   本地有 artifact → 覆写 marketplace.json SHA + uploadArtifact
  //   本地没有 → 从 GitHub download verify（只读，不改 marketplace.json）
  //
  // 注意：filename 从 release record 的 version 字段拼（slug-version.astraviapkg），
  // 不从 artifact url 解析 —— 因为后面 private repo URL swap 会把 download url 改成 API url，
  // 那时 url.split('/').pop() 会返回 'assets/123' 里的 '123'，不是真正的 filename。
  const handledFilenames = new Set(publication.packages.map(p => p.filename));
  const artifactDir = join(directory, 'artifacts');
  const allPluginRecords = catalog.abilities.flatMap(entry => {
    const records = [];
    if (entry.type === 'plugin') {
      for (const record of entry.releases ?? []) {
        records.push({ owner: entry.slug, record, slug: entry.slug });
      }
    }
    if (entry.type === 'bundle') {
      for (const member of entry.config?.members ?? []) {
        if (member.type === 'plugin') {
          for (const record of member.releases ?? []) {
            records.push({ owner: `${entry.slug}.${member.slug}`, record, slug: member.slug });
          }
        }
      }
    }
    return records;
  });

  for (const { owner, record, slug } of allPluginRecords) {
    const version = record?.version;
    if (!version) continue;
    const filename = `${slug}-${version}.astraviapkg`;
    const tag = `plugin-${slug}`;

    if (handledFilenames.has(filename)) continue; // Step 1 已处理这个特定文件

    const localPath = join(artifactDir, filename);
    if (existsSync(localPath)) {
      // 本地有 artifact 但没进 packages → 本地为准覆写 SHA + uploadArtifact
      const localSha = digest(readFileSync(localPath));
      if (localSha !== record.artifact.sha256) {
        console.error(`[fix] ${owner}: 本地 artifact SHA=${localSha.slice(0, 16)}... 覆写 marketplace.json=${record.artifact.sha256.slice(0, 16)}...`);
        record.artifact.sha256 = localSha;
      }
      uploadArtifact({
        gh, repository, tag, localPath, filename,
        expectedSha: record.artifact.sha256,
        sourceSha: publication.sourceSha,
        releaseTitle: `${slug} plugin packages`,
        releaseNotes: `Append-only Astravia plugin packages for ${slug}.`,
      });
    } else {
      // 本地没有 artifact → 这是历史版本（当前 entry 版本 bump 后，旧版本成了 releases 数组里的历史记录）
      // 只读 verify：从 GitHub download 算 SHA 对比 marketplace.json
      // 不改 marketplace.json — 方向绝不反
      const verifyTmp = mkdtempSync(join(tmpdir(), 'astravia-history-verify-'));
      try {
        gh('release', 'download', tag, '--repo', repository, '--pattern', filename, '--dir', verifyTmp);
        const remoteSha = digest(readFileSync(join(verifyTmp, filename)));
        if (remoteSha !== record.artifact.sha256) {
          throw new Error(`${owner}: GitHub artifact SHA mismatch (GitHub=${remoteSha.slice(0, 16)}... marketplace=${record.artifact.sha256.slice(0, 16)}...) — 本地无历史 artifact，无法自动修复`);
        }
      } finally { rmSync(verifyTmp, { recursive: true, force: true }); }
    }
  }
  writeJson(catalogPath, catalog);

  // Private repositories use authenticated asset API URLs; public repositories keep readable download URLs.
  const isPrivate = JSON.parse(gh('api', `repos/${repository}`)).private;
  if (isPrivate) {
    for (const entry of catalog.abilities.flatMap(x => [x, ...(x.type === 'bundle' ? x.config.members : [])])) {
      for (const record of entry.releases ?? []) {
        if (!record.artifact.url.startsWith(`${source.repository}/releases/download/`)) continue;
        const parts = new URL(record.artifact.url).pathname.split('/');
        const release = JSON.parse(gh('api', `repos/${repository}/releases/tags/${parts.at(-2)}`));
        const asset = release.assets.find(x => x.name === decodeURIComponent(parts.at(-1)));
        if (!asset) throw new Error('Published asset is missing');
        record.artifact.url = asset.url;
      }
    }
    writeJson(catalogPath, catalog);
  }
  // Check the public/authenticated download paths before making the index discoverable.
  await verify(directory, true);
  const site = join(directory, 'site');
  const index = join(mkdtempSync(join(tmpdir(), 'astravia-index-')), 'index');
  const env = { ...process.env, GIT_INDEX_FILE: index };
  const indexedGit = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  indexedGit('read-tree', '--empty');
  for (const path of files(site)) {
    const object = git('hash-object', '-w', '--no-filters', inside(site, path));
    indexedGit('update-index', '--add', '--cacheinfo', '100644', object, path);
  }
  const tree = indexedGit('write-tree');
  const commit = git('commit-tree', tree, ...(remote ? ['-p', remote] : []), '-m', `chore(marketplace): 发布 ${catalog.marketplaceVersion}\n\n从已审核源码 ${publication.sourceSha} 生成市场索引。`);
  try { push(commit); } finally { rmSync(resolve(index, '..'), { recursive: true, force: true }); }
  return { published: true, commit };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = process.cwd(), directory = resolve(process.argv[2] ?? '.marketplace-build');
  const tooling = resolve('.tooling/open-astravia');
  const { verifyCandidate } = await import('./marketplace.mjs');
  const { verifyMarketplacePublication } = await import(pathToFileURL(join(tooling, 'scripts/release/check-plugin-marketplace-publication.mjs')).href);
  const settings = publicationSettings(root);
  publishMarketplace({ root, directory, verify: (dir, remote) => remote
    ? verifyMarketplacePublication(readJson(join(dir, 'site/.astravia/marketplace.json')), {
      token: process.env.GITHUB_TOKEN,
      candidateAppCommits: settings.candidateAppCommits,
    })
    : verifyCandidate(dir, tooling),
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
