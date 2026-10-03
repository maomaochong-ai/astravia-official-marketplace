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

## 12. 改了插件源码但没 bump 版本 — GitHub Release 上 artifact 永远不更新

### 现象

改了插件源码（比如修了 locales 格式），push main 等 CI 跑完，open-astravia 安装后还是老问题。GitHub Release 上对应版本的 `.astraviapkg` 还是旧内容。

### 根因

prepareMarketplace 的判断逻辑：

```js
const existing = releases.find(x => x.version === descriptor.version);
if (!existing || migrate) {
  // 只有"新版本"或"migrate"才 build + pack + upload
  await buildPlugin(source);
  // ...
}
// 旧版本 → 跳过，releases 从 gh-pages 继承
```

**如果 version 没变**，不管你改了多少源码，CI 都认为这是旧版本 → 跳过 build + pack → GitHub Release 上的 artifact 永远是第一次 upload 的那个。

### 解决

**必须 bump 版本号**（x.y.z 单调递增）：

```bash
# 三个文件必须同步改
abilities/plugins/<slug>/plugin.json       version: 0.0.12 → 0.0.13
abilities/plugins/<slug>/ability.json      version: 0.0.12 → 0.0.13
.astravia/marketplace.source.json           version: 0.0.12 → 0.0.13
```

### 为什么这是"追加"而不是"覆盖"

publish-marketplace 是 **append-only** 设计：
- 新版本 → 新 filename（`dbx-pro-0.0.13.astraviapkg`）→ upload 为新 asset
- 旧版本 → GitHub 上不动（`dbx-pro-0.0.12.astraviapkg` 永远留在那）
- gh-pages marketplace.json 的 releases[] 追加新版本，旧版本保留

**好处**：任何已发布版本的 SHA 永远不变，不会再出现 SHA mismatch。
**代价**：GitHub Release 上会积累多个版本的 artifact（正常且可接受）。

### 反模式 ❌

- 不要想"改了 locales 直接重新打包同名 upload 覆盖"——这会破坏 append-only 不变量，gh-pages 上的 SHA 和 GitHub 上的实际 SHA 会再次分叉。
- 不要在 publish-marketplace 里加 delete-asset 覆盖上传逻辑——这正是我们之前 SHA mismatch 的根因之一。

---

## 13. buildPlugin file: refs 残留到 committed package.json

### 现象

`git show HEAD:abilities/plugins/<slug>/package.json` 里 `@astravia-org/plugin-sdk` 显示为 `file:/Users/.../open-astravia/packages/...`，而不是 `^0.3.2`。

### 根因

buildPlugin 有 backup/restore 逻辑：

```js
const backup = changed ? pkgPath + '.bak' : null;
if (changed) { writeFileSync(backup, original); writeFileSync(pkgPath, rewritten); }
try { execFileSync('npm', ['install', ...]); }
finally { if (backup) { writeFileSync(pkgPath, original); execFileSync('rm', [backup]); } }
```

如果 `npm install` 抛异常但 finally 没执行到（进程被 kill、OOM、Ctrl+C），重写后的 file: refs 就留在 package.json 里。下一次 `git add` 就把它 commit 进去了。

### 后果

- 别人 clone 下来 `npm ci` 会因为 file: 路径不存在而失败
- CI 第一次跑 buildPlugin 时，发现 `@astravia-org/plugin-sdk` 已经是 file: 开头的字符串（但不是正确的 file: 路径格式），可能导致路径拼接出错

### 解决

**手动恢复**（一次性）：

```bash
git checkout HEAD~1 -- abilities/plugins/<slug>/package.json
# 或手动把 file: 路径改回 npm 版本号
```

**预防**：在 buildPlugin finally 块里加日志确认还原成功，或者在 CI 跑之前 `grep -r "file:.*open-astravia" abilities/plugins/*/package.json` 做预检。

---

## 14. 关键文件速查

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

---

## 15. 完整发布流程实战演练（从 0→1）

以下为 dbx-pro v0.0.11 → v0.0.12 → v0.0.13 全链路跑通的逐步记录，包含两次 bump 的不同原因和最终解决。

### 第一次 bump：v0.0.11 → v0.0.12（正常发布）

```bash
# 1. 改三个文件
edit abilities/plugins/dbx-pro/plugin.json          # version: "0.0.11" → "0.0.12"
edit abilities/plugins/dbx-pro/ability.json         # version: "0.0.11" → "0.0.12"
edit .astravia/marketplace.source.json              # version: "0.0.11" → "0.0.12"

# 2. 本地检查
node scripts/marketplace.mjs check                  # ✅
git worktree add --detach $TMPDIR/mp origin/gh-pages
node scripts/marketplace.mjs build --previous $TMPDIR/mp   # ✅ Prepared 1 new packages
node --test tests/*.test.mjs                        # ✅ 57/57 pass

# 3. commit + push
git add -A && git commit -m "bump(dbx-pro): 0.0.11 → 0.0.12"
git push origin main

# 4. CI 自动跑
# Build job → prepareMarketplace 遍历 8 个 plugin：
#   feishu, cli-proxy-api, shimo-reader, xiaohongshu, astravia-tihu,
#   build-apple-apps, web-element-picker → existing && !migrate → 跳过
#   dbx-pro → !existing（新版本） → buildPlugin → stage-plugin-release.py → .astraviapkg
# Publish job → Step1 upload GitHub Release plugin-dbx-pro → Step4 push gh-pages
```

### 第二次 bump：v0.0.12 → v0.0.13（locales 格式修复）

**为什么必须再 bump 一次？**

第一次 bump 后发现 dbx-pro 安装后详情页标题显示 `plugin.name`（locale 解析失败）。修复了源码里的 locales 格式后，**version 还是 0.0.12**，CI 跑 prepareMarketplace 时判断 `existing && !migrate` → 跳过 build + pack → GitHub Release 上 0.0.12 的 artifact 还是旧的嵌套对象格式。

```bash
# 1. 修 locales（嵌套对象 → 扁平点号 key）
python3 -c "
import json
def flatten(obj, prefix=''):
    r = {}
    for k, v in obj.items():
        key = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            for sk, sv in v.items(): r[f'{key}.{sk}'] = sv
        else: r[key] = v
    return r
for lc in ['zh', 'en']:
    p = f'abilities/plugins/dbx-pro/locales/{lc}.json'
    d = json.load(open(p))
    json.dump(flatten(d), open(p, 'w'), ensure_ascii=False, indent=2)
"

# 2. 修 package.json（残留 file: refs → npm 版本号）
edit abilities/plugins/dbx-pro/package.json
  # "@astravia-org/plugin-sdk": "file:/Users/.../open-astravia/packages/plugins/plugin-sdk"
  # → "@astravia-org/plugin-sdk": "^0.3.2"

# 3. 删无用 fdir 降级
# scripts/marketplace.mjs 里删掉 npm install fdir@6.0.1

# 4. bump 版本（关键！让 CI 重新 build + pack）
edit abilities/plugins/dbx-pro/plugin.json           # version: "0.0.12" → "0.0.13"
edit abilities/plugins/dbx-pro/ability.json          # version: "0.0.12" → "0.0.13"
edit .astravia/marketplace.source.json               # version: "0.0.12" → "0.0.13"

# 5. 本地验证
rm -rf .marketplace-build
node scripts/marketplace.mjs build --previous $TMPDIR/mp  # ✅ Prepared 1 new packages
node --test tests/*.test.mjs                               # ✅ 57/57 pass
python3 -c "
import zipfile, hashlib
z = zipfile.ZipFile('.marketplace-build/artifacts/dbx-pro-0.0.13.astraviapkg')
d = json.loads(z.read('locales/zh.json'))
assert not any(isinstance(v, dict) for v in d.values()), 'locales 还是嵌套对象！'
assert 'plugin.name' in d, '缺少 plugin.name key'
print('✅ locales 格式正确')
print('SHA:', hashlib.sha256(open('.marketplace-build/artifacts/dbx-pro-0.0.13.astraviapkg','rb').read()).hexdigest())
"

# 6. commit + push
git add -A && git commit -m "bump(dbx-pro): 0.0.12 → 0.0.13 — locales 格式修复后重发"
git push origin main

# 7. CI 自动跑（或手动模拟）
# Step 1: gh release upload plugin-dbx-pro dbx-pro-0.0.13.astraviapkg
#         gh release download → 校验 SHA 和本地一致 ✅
# Step 4: git write-tree → commit-tree → push gh-pages

# 8. 最终验证
gh release view plugin-dbx-pro --jq '[.assets[] | .name]'     # ✅ 有 dbx-pro-0.0.13.astraviapkg
git show origin/gh-pages:.astravia/marketplace.json          # ✅ dbx-pro releases 含 v0.0.13
gh release download plugin-dbx-pro --pattern dbx-pro-0.0.13.astraviapkg
python3 -c "
import zipfile, json
z = zipfile.ZipFile('dbx-pro-0.0.13.astraviapkg')
d = json.loads(z.read('locales/zh.json'))
print('plugin.name =', repr(d.get('plugin.name', 'MISSING')))  # ✅ 'dbx-pro 数据库工作台'
"
```

### 最终状态

```
GitHub Release plugin-dbx-pro assets:
  dbx-pro-0.0.10.astraviapkg   (append-only，不动)
  dbx-pro-0.0.11.astraviapkg   (append-only，不动)
  dbx-pro-0.0.12.astraviapkg   (append-only，不动；locales 旧格式，不再被 gh-pages 引用)
  dbx-pro-0.0.13.astraviapkg   ✅ locales 新格式，当前最新版
  dbx-pro-0.1.0.astraviapkg   (append-only，不动)

gh-pages marketplace.json dbx-pro releases:
  v0.0.11  SHA=cffac654...  ← 继承自首次 publish，GitHub artifact 永远匹配
  v0.0.13  SHA=34a6a2f7...  ← 最新，Python 算的 SHA = GitHub download 验证的 SHA

open-astravia 拉 marketplace → 安装 dbx-pro → 详情页显示 "dbx-pro 数据库工作台" ✅
```

### 教训

| 教训 | 说明 |
|------|------|
| **改源码不等于改发布** | 不 bump 版本 → CI 跳过 build + pack → GitHub 上旧 artifact 永远不变 |
| **append-only 是强制的** | 同名 upload 覆盖 = 破坏 SHA 不变量 = 下次 open-astravia 拉取就 mismatch |
| **三个版本号必须同步** | plugin.json / ability.json / marketplace.source.json 不同步会导致 prepareMarketplace check 阶段抛错 |
| **locales 格式要对齐上游** | 用 `%plugin.name%` 占位符 → locales key 必须是 `"plugin.name"` 点号格式，不能是嵌套对象 |
