# 07 · 门禁与凭证

> 现行文本。归并自 [0004](../0004-offline-entitlement-gate.md)、
> [0017](../0017-review-round-one-global-revision-and-total-verify.md)（凭证解码）与
> [0024](../0024-ui-round-reader-library-covers-and-activation-facts.md)（激活页呈现的事实）。
> 2026-10-31 按 0.4.19 核对。

## 一句话

离线验签决定能不能写，不决定你是谁；它证明「凭证由我方私钥签发过」，不证明「使用者就是购买者」。

## 现行规矩

1. **Ed25519 离线验签，全链 fail-closed**：任何一步不确定都当作未授权（`missing` / `invalid` /
   `expired`）。不联网、不问服务器。
2. **状态来源有优先级**：用户自己激活的凭证 > 随包社区凭证。两者都验不过才是未授权，
   且失败原因是结构化的，激活页据此给不同提示。
3. **时钟回拨容忍 24 小时**（`DEFAULT_SKEW_MS`）：改时区不该掉授权。
4. **门禁只有一个执行点**：`StudioService.requireEntitlement`。`GATED_TOOL_IDS` 是**声明**，
   供测试核对「每个写工具都在名单里」，不是执行点——两处都判必然有一处写错。
5. **读不挡、写全挡**：见 03。
6. **不做反破解**。不混淆、不检测调试器、不写「破解即失效」的暗桩。这类投入对诚实的作者
   是干扰，对不诚实的人也只是延迟。
7. **激活页只说真话**：显示当前状态、凭证来源、签发与到期时间、失败原因。
   不显示「剩余天数」这种需要联网才能算准的数字。

## 代码落点

| 事 | 文件 |
| --- | --- |
| 验签 | `src/entitlement/verify-entitlement.ts` |
| 令牌编解码 | `src/entitlement/credential-token.ts` |
| 门禁与优先级 | `src/entitlement/entitlement-gate.ts` |
| 公钥与社区凭证 | `src/entitlement/trusted-keys.ts`、`default-credential.ts` |
| 凭证落盘 | `entitlement.json`（Plugin Storage） |
| 执行点 | `src/application/studio-service.ts` 的 `requireEntitlement` |

## 代价与边界

- 离线验签不能吊销。真需要吊销时只能靠换公钥 + 抬版本，这是这套方案的固有代价。
- 凭证随包分发（社区凭证）意味着**包里那串东西是公开的**。它被设计成公开：
  它的作用是给试用者一条不折腾的路径，不是防伪。
- 门禁在服务层，界面里任何「预览态」都必须走同一处判断，否则会出现「看得见点不动」
  或「点得动写不进」两种割裂。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
npx vitest run test/entitlement.test.ts
grep -c "requireEntitlement" src/application/studio-service.ts   # 期望 25（1 定义 + 24 调用）
grep -c '"mahua_' src/entitlement/entitlement-gate.ts           # 名单条数
```
