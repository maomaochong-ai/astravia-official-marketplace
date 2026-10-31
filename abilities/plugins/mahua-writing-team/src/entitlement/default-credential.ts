/**
 * 随包分发的社区凭证：`plan: community`、权益含 `studio`，有效期到 2031-12-31。
 *
 * 为什么随包带一份：没有它，首次安装的用户必须先有一个签发渠道才能进入工作台。
 * 它由 `mahua-2026-01` 私钥签名，和付费凭证走完全相同的验签路径——
 * 不是"跳过校验的后门"，只是默认已激活。
 *
 * 0.4.23 重新签发过一次（ADR 0033）：旧凭证的 `subject` 是插件改名前的
 * `novelwright-community`，而激活页会把 `subject` 原样当「签发主体」显示，
 * 于是界面上出现了一个本插件已经不再使用的名字。凭证无法就地改写（签名覆盖 claims），
 * 所以换keyId + 换主体 + 重签，并把新公钥加进 `trusted-keys.ts`。
 *
 * 换发方式见 `scripts/issue-credential.mjs`。
 */
export const COMMUNITY_CREDENTIAL =
	"nw1.eyJlbnRpdGxlbWVudHMiOlsiZXhwb3J0Iiwic3R1ZGlvIl0sImV4cGlyZXNBdCI6IjIwMzEtMTItMzFUMjM6NTk6NTkuOTk5WiIsImlzc3VlZEF0IjoiMjAyNi0xMS0wMVQwMDowMDowMC4wMDBaIiwia2V5SWQiOiJtYWh1YS0yMDI2LTAxIiwicGxhbiI6ImNvbW11bml0eSIsInN1YmplY3QiOiJtYWh1YS1jb21tdW5pdHkiLCJ2IjoxfQ._AYY_lrUInGkNll8TT_AWRRxY-G8EtPrYAs6NWsIEFyFcCgsqn2ko0XJbxEHr1IRYbQYHN4lVD5DQ2dhYTnQDg";
