import art01 from "../../../assets/covers/01.jpg?inline";
import art02 from "../../../assets/covers/02.jpg?inline";
import art03 from "../../../assets/covers/03.jpg?inline";
import art04 from "../../../assets/covers/04.jpg?inline";

/**
 * 封面的纸纹底片。
 *
 * 四张 360×540 的灰度影像，职责只有一个：给纸一点纤维感。它们以低透明度叠在
 * `.mahua-cover` 的纸底色上并 multiply，所以题材被压成同一种旧纸，不冒充"封面插画"。
 * 来源与许可见 `assets/covers/SOURCE.md`；想换观感直接替换那四个文件即可，不用改代码。
 *
 * `?inline` 是刻意的：Module Federation 的远程包对静态资源路径没有保证，一个 404 就会让
 * 封面变成纯色块。内联之后合计约 76 KB，换的是"永远画得出来"。
 */
export const COVER_ART: readonly string[] = [art01, art02, art03, art04];
