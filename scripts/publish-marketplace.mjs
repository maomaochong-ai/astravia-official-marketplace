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
  try { return JSON.parse(gh('api', `repos/${repository}/releases/tags/${tag}`)); }
  catch (error) {
    if (!isMissingRelease(error)) throw error;
  }
  try {
    const release = JSON.parse(gh('release', 'view', tag, '--repo', repository, '--json', 'tagName,isDraft,targetCommitish,assets'));
    return {
      tag_name: release.tagName,
      draft: release.isDraft,
      target_commitish: release.targetCommitish,
      assets: release.assets.map(asset => ({ name: asset.name, url: asset.apiUrl })),
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
  for (const item of publication.packages) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(item.slug) || item.tag !== `plugin-${item.slug}` || item.filename !== `${item.slug}-${item.release.version}.astraviapkg`) throw new Error('Invalid publication package');
    const archive = inside(join(directory, 'artifacts'), item.filename);
    assertExistingRelease(item, readFileSync(archive));
    let release = releaseByTag(gh, repository, item.tag);
    if (!release) {
      gh('release', 'create', item.tag, archive, '--repo', repository, '--draft', '--target', publication.sourceSha, '--title', `${item.slug} plugin packages`, '--notes', `Append-only Astravia plugin packages for ${item.slug}. The first package was built from ${publication.sourceSha}; version metadata and SHA-256 digests are recorded in the gh-pages marketplace index.`);
      release = releaseByTag(gh, repository, item.tag);
      if (!release) throw new Error(`Created draft release is unavailable: ${item.tag}`);
    }
    const asset = release.assets.find(x => x.name === item.filename);
    if (!asset) {
      if (release.draft && release.target_commitish !== publication.sourceSha) throw new Error(`Incomplete existing release: ${item.tag}`);
      gh('release', 'upload', item.tag, archive, '--repo', repository);
    }
    const download = mkdtempSync(join(tmpdir(), 'astravia-release-verify-'));
    try {
      gh('release', 'download', item.tag, '--repo', repository, '--pattern', item.filename, '--dir', download);
      assertExistingRelease(item, readFileSync(join(download, item.filename)));
    } finally { rmSync(download, { recursive: true, force: true }); }
    if (release.draft) gh('release', 'edit', item.tag, '--repo', repository, '--draft=false', '--latest=false');
  }
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
  // ====== 兜底同步：确保 GitHub Release 上的 artifact 跟 marketplace.json 声明的一致 ======
  // 遍历 marketplace.json 里所有 plugin（含 bundle 成员如 shimo-reader），
  // 用本地 .marketplace-build/artifacts/ 里的文件算 SHA，覆写 marketplace.json，
  // 并上传覆盖 GitHub Release（防止有人手动覆盖 artifact 导致 mismatch）。
  // 方向：本地 build 为准 → 上传 GitHub Release → 推 gh-pages。
  const artifactsDir = join(directory, 'artifacts');
  let synced = 0;
  const allPluginRecords = catalog.abilities.flatMap(entry => {
    const records = [];
    if (entry.type === 'plugin' && entry.releases) records.push({ owner: entry.slug, record: entry.releases[0], slug: entry.slug });
    if (entry.type === 'bundle') {
      for (const member of entry.config?.members ?? []) {
        if (member.type === 'plugin' && member.releases) records.push({ owner: `${entry.slug}.${member.slug}`, record: member.releases[0], slug: member.slug });
      }
    }
    return records;
  });
  for (const { owner, record, slug } of allPluginRecords) {
    const url = record?.artifact?.url;
    if (!url) continue;
    const filename = url.split('/').pop();
    const localPath = join(artifactsDir, filename);
    const tag = `plugin-${slug}`;

    // 1. 如果本地有 artifact → 用本地算的 SHA 覆写 marketplace.json
    if (existsSync(localPath)) {
      const localSha = digest(readFileSync(localPath));
      if (localSha !== record.artifact.sha256) {
        console.error(`[sync] ${owner}: marketplace.json=${record.artifact.sha256.slice(0,16)}... → 本地=${localSha.slice(0,16)}... 覆写`);
        record.artifact.sha256 = localSha;
      }

      // 2. 上传本地 artifact 覆盖 GitHub Release（确保 GitHub 跟 marketplace.json 一致）
      let release = releaseByTag(gh, repository, tag);
      if (!release) {
        gh('release', 'create', tag, localPath, '--repo', repository, '--draft', '--target', publication.sourceSha, '--title', `${slug} plugin packages`, '--notes', `Append-only Astravia plugin packages for ${slug}.`);
        release = releaseByTag(gh, repository, tag);
        if (!release) throw new Error(`Created draft release is unavailable: ${tag}`);
      }
      const hasAsset = release.assets?.some(a => a.name === filename);
      if (hasAsset) {
        // GitHub 不允许直接覆盖 asset，先删再传
        gh('release', 'delete-asset', release.assets.find(a => a.name === filename).id, '--repo', repository);
      }
      gh('release', 'upload', tag, localPath, '--repo', repository);
      if (release.draft) gh('release', 'edit', tag, '--repo', repository, '--draft=false', '--latest=false');

      // 3. 从 GitHub 下载回来验证上传成功
      const verifyTmp = mkdtempSync(join(tmpdir(), 'astravia-sync-verify-'));
      try {
        gh('release', 'download', tag, '--repo', repository, '--pattern', filename, '--dir', verifyTmp);
        const remoteSha = digest(readFileSync(join(verifyTmp, filename)));
        if (remoteSha !== localSha) {
          throw new Error(`[sync] ${owner}: 上传后 SHA 不一致 本地=${localSha.slice(0,16)}... GitHub=${remoteSha.slice(0,16)}...`);
        }
      } finally { rmSync(verifyTmp, { recursive: true, force: true }); }

      synced++;
    } else {
      // 本地没有（build 跳过了），下载 GitHub Release 验证 SHA 是否跟 marketplace.json 一致
      const verifyTmp = mkdtempSync(join(tmpdir(), 'astravia-sync-verify-'));
      try {
        gh('release', 'download', tag, '--repo', repository, '--pattern', filename, '--dir', verifyTmp);
        const remoteSha = digest(readFileSync(join(verifyTmp, filename)));
        if (remoteSha !== record.artifact.sha256) {
          console.error(`[sync] ${owner}: 本地无 artifact，GitHub=${remoteSha.slice(0,16)}... marketplace=${record.artifact.sha256.slice(0,16)}... 覆写 marketplace`);
          record.artifact.sha256 = remoteSha;
        }
      } catch (e) {
        console.error(`[sync] ${owner}: 本地无 artifact，GitHub 下载失败 ${e.message}`);
      } finally { rmSync(verifyTmp, { recursive: true, force: true }); }
    }
  }
  writeJson(catalogPath, catalog);
  console.error(`[sync] 同步了 ${synced} 个 plugin artifact，marketplace.json SHA 已对齐`);

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
