# 插件市场常见问题与解决方案

本文档汇总了 astravia-official-marketplace 发布链路中最容易踩到的坑、根因分析与解决措施。所有方案均已在真实流水线中验证。

---

## 1. SHA Mismatch — GitHub Release artifact 与 gh-pages marketplace.json 不一致

### 现象

open-astravia 安装插件时报 `SHA mismatch`，GitHub Release 上 artifact 的实际 SHA 和 gh-pages marketplace.json 里记录的 SHA 对不上。

### 根因（3 种可能）

| 根因 | 来源 | 说明 |
|------|------|------|
| vite build 产物不可重现 | 构建阶段 | 同样源码每次 `vite build` 的 chunk hash 不同，导致每次打包的 ZIP 文件 SHA 不同 |
| else 分支让旧版本也 build + pack | prepareMarketplace | 我们之前加的 else 分支让旧版本也走 vite build，每次都产出不同 SHA |
| publish 用 delete-asset 覆盖 upload | publish-marketplace | 每次 publish 强制删旧 artifact 再传新的，GitHub 上 SHA 变了但 gh-pages 没跟上 |

### 解决

**对齐上游，删掉 else 分支和 delete-asset 逻辑**：

```js
// static-marketplace.mjs prepareMarketplace
if (!existing || migrate) {
  // 只有新版本才 build + pack
  await buildPlugin(source);
  const release = JSON.parse(execFileSync(python, stage-plugin-release.py ...));
  releases.push(release);
  packages.push(...);
}
// ← 没有 else 分支！旧版本直接从 gh-pages 继承 releases
```

publish-marketplace 只处理 `publication.packages`（新版本），GitHub Release 上旧 artifact 永远不动。

### 为什么能解决

- vite chunk hash 虽然不可重现，但**旧版本根本不跑 vite build**
- 新版本第一次 build + pack 得到的 SHA = Python stage-plugin-release.py 算的 SHA
- 同一个 ZIP 上传到 GitHub → download verify 拿回来 → SHA 一定匹配
- 旧版本的 artifact 在 GitHub 上是 append-only 的，SHA 和 gh-pages 继承的永远一致

---

## 2. vite build 产物不可重现

### 现象

两次 `vite build`（源码没变）出来的 dist/ 文件名不同：

```
第一次: dist/assets/hostInit-Kih44fBa.js
第二次: dist/assets/hostInit-CiEW-qHO.js   ← hash 完全不同
```

### 根因

vite 的 module federation chunk 名含内容 hash，但内容 hash 受构建并行度、文件系统扫描时序、Node.js 内存布局等非确定性因素影响。

### 这是问题吗？

**对新版本没问题**——新版本只 build 一次，SHA 固定上传。
**对旧版本是问题**——如果让旧版本也重新 build（else 分支），每次产出 SHA 不同。

### 解决

**对齐上游**：旧版本不 build、不 pack、不校验 SHA。删掉 else 分支。

---

## 3. locales 格式错误 — 安装后标题/描述显示为 plugin.name

### 现象

插件在 marketplace 列表页显示正确中文，但安装后详情页标题变成 `plugin.name`、描述变成 `plugin.description`。

### 根因

open-astravia 从 plugin.json 解析 `%plugin.name%` 占位符时，只认**扁平点号 key**，不认嵌套对象：

| 格式 | 正确/错误 |
|------|----------|
| `"plugin.name": "dbx-pro 数据库工作台"` | ✅ open-astravia 能解析 |
| `"plugin": { "name": "dbx-pro 数据库工作台" }` | ❌ 被忽略，fallback 到去掉 % 得到字面量 `plugin.name` |

### 解决

把 locales 嵌套对象拍平成点号 key：

```python
# 一次性修复脚本（对任何嵌套对象 locales 文件）
import json
def flatten(obj, prefix=''):
    result = {}
    for k, v in obj.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            for sk, sv in v.items():
                result[f"{key}.{sk}"] = sv
        else:
            result[key] = v
    return result

for lc in ['zh', 'en']:
    p = f'locales/{lc}.json'
    with open(p) as f:
        d = json.load(f)
    with open(p, 'w') as f:
        json.dump(flatten(d), f, ensure_ascii=False, indent=2)
        f.write('\n')
```

### 所有插件应遵循的 locales 规范

| plugin.json 占位符 | locales key 格式 | 示例 |
|-------------------|-----------------|------|
| `"%name%"` / `"%description%"` | 顶层扁平 key | `"name": "飞书"` |
| `"%plugin.name%"` / `"%plugin.description%"` | 点号连接的扁平 key | `"plugin.name": "dbx-pro 数据库工作台"` |

**参考上游**：feishu/shimo/xiaohongshu 用 `%name%` + 扁平 key；build-apple-apps 用 `%plugin.name%` + 点号 key。两种都对，但**不能用嵌套对象**。

---

## 4. buildPlugin 残留 package.json.bak 文件

### 现象

`git status` 里出现 `abilities/plugins/xxx/package.json.bak`，或者 `.bak` 被不小心 commit 进去。

### 根因

buildPlugin 的 finally 块还原 package.json 时，如果中间 `npm install` 抛异常或进程被 kill，还原逻辑可能没执行。

### 解决

在 CI 流水线里加一行清理，或者在 buildPlugin finally 块里加日志确认还原成功：

```js
finally {
  if (backup) {
    writeFileSync(pkgPath, readFileSync(backup, 'utf8'));
    execFileSync('rm', [backup]);
    // console.log(`[buildPlugin] restored ${directory}/package.json`);
  }
}
```

---

## 5. buildPlugin file: 重写机制

### 为什么需要

上游 vetta 的 `@vetta-org/*` 已经 publish 到 npm，`npm ci` 直接从 registry 拉。我们的 `@astravia-org/*` **不 publish**（永远），所以需要临时重写依赖路径指向本地 tooling 源码。

### 重写逻辑

```
原始 package.json:
  "@astravia-org/plugin-sdk": "^0.3.2"
  "@astravia-org/plugin-vite": "^0.2.1"

buildPlugin 重写后:
  "@astravia-org/plugin-sdk": "file:/.../.tooling/open-astravia/packages/plugins/plugin-sdk"
  "@astravia-org/plugin-vite": "file:/.../.tooling/open-astravia/packages/plugins/plugin-vite"

npm install 执行后（从本地 tooling 拷，不经过 npm registry）

finally 还原:
  "@astravia-org/plugin-sdk": "^0.3.2"   ← 恢复原始版本号
```

### 如果以后发布 npm 包

重写逻辑可以**完全删掉**，buildPlugin 变成和上游一样：
```js
buildPlugin: directory => {
  execFileSync('npm', ['ci']);
  execFileSync('npm', ['run', 'check/test/build']);
}
```

---

## 6. 为什么是 npm install 而不是 npm ci

| 命令 | 要求 | 我们能不能用 |
|------|------|-------------|
| `npm ci` | 必须有 package-lock.json 且和 package.json 严格匹配 | ❌ file: 重写后 lockfile 不匹配 |
| `npm install` | 有 package.json 就行 | ✅ 自动生成/更新 lockfile |

file: 重写会改 package.json 的依赖路径，package-lock.json 里的路径还是旧的，`npm ci` 会直接报错退出。

---

## 7. 为什么删掉了 fdir@6.0.1 降级

### 之前为什么加

早期某次环境下，`npm install` 自然解析出的 fdir 版本和 tinyglobby 的 ESM 导入不兼容，导致 vite build 报 `ERR_MODULE_NOT_FOUND`。所以加了 `npm install fdir@6.0.1 --no-save` 手动锁版本。

### 为什么可以删

实测在当前环境下，`npm install` 自然解析出的 fdir@6.5.0 和 tinyglobby@0.2.17 完全兼容。之前的问题大概率是某次 lockfile 里 tinyglobby 版本不同导致的一次性环境问题。

### 如果以后再出

把这两行加回去：
```js
execFileSync('npm', ['install', 'fdir@6.0.1', '--no-save', '--legacy-peer-deps'], { cwd: directory });
```

---

## 8. 本地 publish-marketplace.mjs fetch failed

### 现象

本地跑 `node scripts/publish-marketplace.mjs` 报错 `fetch failed`，但 CI 里正常。

### 根因

publish-marketplace 内部调 open-astravia 的 `verifyMarketplacePublication` 校验 marketplace.json，这个脚本要 fetch GitHub API 确认 artifact 存在。本地网络不稳定或没 GITHUB_TOKEN 时容易失败。

### 不影响流程

CI runner 网络稳定 + 有 token，这个问题在 CI 里不会出现。本地调试可以跳过 verify 手动走 Step 1 + Step 4。

---

## 9. 新版本 bump 后 sourceSha 不匹配

### 现象

```
Candidate source identity differs
或
Source branch advanced; rerun the latest revision
或
Distribution advanced; rebuild against the latest gh-pages
```

### 根因

publication.json 里的 sourceSha 是 build 时 `git rev-parse HEAD` 记录的。如果 build 后又 commit 了（比如修复 package.json.bak），HEAD 就变了，sourceSha 跟不上。

### 解决

**一个 commit 完成所有改动后再 build**，不要 build 后继续 commit。如果已经发生：

```bash
rm -rf .marketplace-build
git worktree add --detach "$TMPDIR/mp" origin/gh-pages
node scripts/marketplace.mjs build --previous "$TMPDIR/mp"
```

---

## 10. 发布插件标准流程

```
0. 改源码 + bump 版本
   abilities/plugins/<slug>/plugin.json  version 0.0.11 → 0.0.12
   abilities/plugins/<slug>/ability.json  version 同步
   .astravia/marketplace.source.json     version 同步

1. 本地检查
   node scripts/marketplace.mjs check
   node scripts/marketplace.mjs build --previous <gh-pages-worktree>
   node --test tests/*.test.mjs

2. push main → CI 自动触发
   Build job: check → build → test → verify → upload artifact
   Publish job: download artifact → Step1 upload GitHub Release → Step4 push gh-pages

3. 验证
   GitHub Release <tag> 有新 .astraviapkg
   gh-pages marketplace.json 新版本 SHA 和 GitHub artifact SHA 一致 ✅
```

---

## 11. 新增插件 checklist

- [ ] `abilities/plugins/<slug>/plugin.json` — id、version、entry、permissions、defaultLocale
- [ ] `abilities/plugins/<slug>/ability.json` — type、version（和 plugin.json 同步）
- [ ] `abilities/plugins/<slug>/locales/zh.json` — **扁平点号 key**（不是嵌套对象！）
- [ ] `abilities/plugins/<slug>/locales/en.json` — 同上
- [ ] `.astravia/marketplace.source.json` — abilities[] 加一条声明（type、slug、version、source.path）
- [ ] `abilities/plugins/<slug>/package.json` — `@astravia-org/*` 用 npm 版本号（`^0.3.2`），**不要**写死 file: 路径
- [ ] 跑一遍 `node scripts/marketplace.mjs check`

---

## 12. 关键文件速查

| 文件 | 作用 | 谁维护 |
|------|------|--------|
| `.astravia/marketplace.source.json` | 声明式清单（我有哪些能力、版本多少） | **人手动写** |
| `.astravia/publish.json` | CI 配置（sourceBranch、gh-pages、toolingCommit） | **人手动写** |
| `.marketplace-build/publication.json` | build 产出的发布计划（packages 列表、SHA、sourceSha） | **CI 自动生成** |
| `gh-pages:.astravia/marketplace.json` | open-astravia 消费的完整索引（含所有 releases + SHA） | **CI 自动生成** |
| `scripts/static-marketplace.mjs` | prepareMarketplace 主流程（遍历 abilities、buildPlugin、stage-plugin-release） | 对齐上游 + buildPlugin 重写 |
| `scripts/marketplace.mjs` | CLI 入口（check / build / verify） + buildPlugin 实现 | 对齐上游 + file: 重写 |
| `scripts/publish-marketplace.mjs` | publish 主流程（Step1 GitHub Release → Step4 push gh-pages） | **完全对齐上游** |
| `scripts/stage-plugin-release.py` | Python 打包脚本（DEFLATED ZIP + SHA-256） | **完全对齐上游** |
