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

function releaseByTag(gh, repository, tag) {
  // 优先用 gh api — 直接返回 asset id 用于 delete-asset
  try {
    const release = JSON.parse(gh('api', `repos/${repository}/releases/tags/${tag}`));
    return {
      tag_name: release.tag_name,
      draft: release.draft,
      target_commitish: release.target_commitish,
      assets: release.assets.map(asset => ({ name: asset.name, id: asset.id, url: asset.url, browser_download_url: asset.browser_download_url })),
    };
  } catch (error) {
    if (!isMissingRelease(error)) throw error;
  }
  try {
    const release = JSON.parse(gh('release', 'view', tag, '--repo', repository, '--json', 'tagName,isDraft,targetCommitish,assets'));
    return {
      tag_name: release.tagName,
      draft: release.isDraft,
      target_commitish: release.targetCommitish,
      assets: release.assets.map(asset => ({ name: asset.name, id: asset.apiUrl.split('/').pop(), url: asset.apiUrl, browser_download_url: asset.apiUrl })),
    };
  } catch (error) {
    if (!isMissingRelease(error)) throw error;
    return undefined;
  }
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
  // 这些 plugin 本地肯定有 artifact（prepareMarketplace 里 stage-plugin-release.py 打包的）
  // 方向：本地 artifact → SHA → marketplace.json / GitHub Release
  for (const item of publication.packages) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(item.slug) || item.tag !== `plugin-${item.slug}` || item.filename !== `${item.slug}-${item.release.version}.astraviapkg`) throw new Error('Invalid publication package');
    const archive = inside(join(directory, 'artifacts'), item.filename);
    const localBytes = readFileSync(archive);
    const localSha = digest(localBytes);
    // 防御性保证：marketplace.json SHA 必须跟本地 artifact 一致
    if (localSha !== item.release.artifact.sha256) throw new Error(`${item.slug}: marketplace.json SHA 与本地 artifact 不一致，应先修复构建`);

    // 确保 GitHub Release 存在
    let release = releaseByTag(gh, repository, item.tag);
    if (!release) {
      gh('release', 'create', item.tag, archive, '--repo', repository, '--draft', '--target', publication.sourceSha, '--title', `${item.slug} plugin packages`, '--notes', `Append-only Astravia plugin packages for ${item.slug}. The first package was built from ${publication.sourceSha}; version metadata and SHA-256 digests are recorded in the gh-pages marketplace index.`);
      release = releaseByTag(gh, repository, item.tag);
      if (!release) throw new Error(`Created draft release is unavailable: ${item.tag}`);
    }

    // 本地为准：delete + upload 覆盖 GitHub 上同名 asset（不管之前有没有、SHA 一不一样）
    const existingAsset = release.assets.find(x => x.name === item.filename);
    if (existingAsset) {
      gh('release', 'delete-asset', String(existingAsset.id), '--repo', repository);
    }
    gh('release', 'upload', item.tag, archive, '--repo', repository);

    // verify: 从 GitHub 下载确认上传成功
    const download = mkdtempSync(join(tmpdir(), 'astravia-verify-'));
    try {
      gh('release', 'download', item.tag, '--repo', repository, '--pattern', item.filename, '--dir', download);
      assertExistingRelease(item, readFileSync(join(download, item.filename)));
    } finally { rmSync(download, { recursive: true, force: true }); }
    if (release.draft) gh('release', 'edit', item.tag, '--repo', repository, '--draft=false', '--latest=false');
  }

  // ========== Step 2: 遍历 marketplace.json 所有 plugin ==========
  // - 已在 packages 里的：上面处理过了，跳过
  // - 不在 packages 里的（旧版本 plugin，本地可能没有 artifact）：
  //   本地有 → delete+upload 覆盖 GitHub Release（同 Step 1）
  //   本地没有 → 从 GitHub download verify（不改 marketplace.json，只验证没被篡改）
  const handledPackages = new Set(publication.packages.map(p => p.slug));
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
    const url = record?.artifact?.url;
    if (!url) continue;
    const filename = url.split('/').pop();
    const tag = `plugin-${slug}`;

    if (handledPackages.has(slug)) continue; // Step 1 已处理

    const localPath = join(artifactDir, filename);
    if (existsSync(localPath)) {
      // 本地有 artifact 但没进 packages → delete+upload 覆盖 GitHub Release
      const localBytes = readFileSync(localPath);
      const localSha = digest(localBytes);
      if (localSha !== record.artifact.sha256) {
        console.error(`[fix] ${owner}: 本地 artifact SHA=${localSha.slice(0, 16)}... 覆写 marketplace.json=${record.artifact.sha256.slice(0, 16)}...`);
        record.artifact.sha256 = localSha;
      }
      let release = releaseByTag(gh, repository, tag);
      if (!release) {
        gh('release', 'create', tag, localPath, '--repo', repository, '--draft', '--target', publication.sourceSha, '--title', `${slug} plugin packages`, '--notes', `Append-only Astravia plugin packages for ${slug}.`);
        release = releaseByTag(gh, repository, tag);
        if (!release) throw new Error(`Created draft release is unavailable: ${tag}`);
      }
      const existing = release.assets.find(x => x.name === filename);
      if (existing) gh('release', 'delete-asset', String(existing.id), '--repo', repository);
      gh('release', 'upload', tag, localPath, '--repo', repository);
      const verifyTmp = mkdtempSync(join(tmpdir(), 'astravia-pkg-verify-'));
      try {
        gh('release', 'download', tag, '--repo', repository, '--pattern', filename, '--dir', verifyTmp);
        if (digest(readFileSync(join(verifyTmp, filename))) !== record.artifact.sha256) throw new Error(`${owner}: 上传后 GitHub SHA 与 marketplace.json 不一致`);
      } finally { rmSync(verifyTmp, { recursive: true, force: true }); }
      if (release.draft) gh('release', 'edit', tag, '--repo', repository, '--draft=false', '--latest=false');
    } else {
      // 本地没有 artifact → 从 GitHub download verify（不改 marketplace.json，只确认没被篡改）
      const verifyTmp = mkdtempSync(join(tmpdir(), 'astravia-prev-verify-'));
      try {
        gh('release', 'download', tag, '--repo', repository, '--pattern', filename, '--dir', verifyTmp);
        const remoteSha = digest(readFileSync(join(verifyTmp, filename)));
        if (remoteSha !== record.artifact.sha256) {
          throw new Error(`${owner}: GitHub artifact SHA mismatch (GitHub=${remoteSha.slice(0, 16)}... marketplace=${record.artifact.sha256.slice(0, 16)}...) — 本地无 artifact，无法自动修复，需重新构建`);
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
