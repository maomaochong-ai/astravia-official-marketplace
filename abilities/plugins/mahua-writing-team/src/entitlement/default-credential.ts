/**
 * 随包分发的社区凭证：`plan: community`、权益含 `studio`，有效期到 2029-12-31。
 *
 * 为什么随包带一份：没有它，首次安装的用户必须先有一个签发渠道才能进入工作台（0.0.1
 * 还没有收款链路）。它由 `nw-2026-01` 私钥签名，和付费凭证走完全相同的验签路径——
 * 不是"跳过校验的后门"，只是默认已激活。
 *
 * 换发方式见 `scripts/issue-credential.mjs`。
 */
export const COMMUNITY_CREDENTIAL =
	"nw1.eyJlbnRpdGxlbWVudHMiOlsiZXhwb3J0Iiwic3R1ZGlvIl0sImV4cGlyZXNBdCI6IjIwMjktMTItMzFUMjM6NTk6NTkuOTk5WiIsImlzc3VlZEF0IjoiMjAyNi0xMC0yOVQwMDowMDowMC4wMDBaIiwia2V5SWQiOiJudy0yMDI2LTAxIiwicGxhbiI6ImNvbW11bml0eSIsInN1YmplY3QiOiJub3ZlbHdyaWdodC1jb21tdW5pdHkiLCJ2IjoxfQ.sRXm-q-ooMAZZRaOm2IxDD8bhEzMjf7E006cdkWdqlrvx6vQnbkBQ3ADkEajMeFQjZQA7CIPoRYrOrhV5kerDA";
