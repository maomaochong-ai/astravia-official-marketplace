/**
 * 默认封面（ADR 0020 §4，底版换成实拍水墨见 ADR 0024 §3）。
 *
 * 每本书都有一张确定的封面，不是占位符：底版是 `COVER_PLATES` 里的一张公有领域水墨，
 * 先转灰度、再 multiply 到宿主的 accent 上——于是任何主题下都只剩「这档主色 + 墨迹」两色，
 * 和 UI 其它颜色不打架。底版与浓淡由 `book.id` 的稳定哈希选出（改名不换封面）。
 *
 * 不出现 `#hex`：颜色只有两步，图象去色后的灰阶与 `accent` 的混色（ADR 0006）。
 * 只画底纹；首字、进度条与文案由 `BookCover` 叠在上面。
 */

import { COVER_PLATES } from "../covers.generated.js";
import { coverVariant } from "../library-model.js";

interface DefaultCoverProps {
	/** 哈希种子，用书 id 而不是书名：改名不该换封面。 */
	seed: string;
}

const PLATE_OPACITY = [0.55, 0.7, 0.85] as const;

export function DefaultCover({ seed }: DefaultCoverProps) {
	const { plate, layer } = coverVariant(seed);
	return (
		<span aria-hidden="true" className="absolute inset-0 overflow-hidden">
			<img
				src={COVER_PLATES[plate]}
				alt=""
				decoding="async"
				draggable={false}
				className="h-full w-full object-cover grayscale"
				style={{ mixBlendMode: "multiply", opacity: PLATE_OPACITY[layer] }}
			/>
			{/* 上下压一层 accent：首字与底部说明行压在墨迹上也读得清，中段留给画。 */}
			<span className="absolute inset-0 bg-gradient-to-b from-accent/70 via-transparent to-accent/55" />
		</span>
	);
}
