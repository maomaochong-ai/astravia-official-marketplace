/**
 * mock-data-generator —— 演示模板的 mock 数据生成。
 *
 * 输入：模板 spec（紧凑 component spec 数组）→ 输出：每个组件需要的 mock 数据。
 * 用于 Phase 6 演示模板库（ADR-0010d）—— 用户选模板 → 一键生成 → 用 mock 数据预览。
 *
 * 支持的 generator 类型：
 *   - random-range:   随机整数 [min, max]
 *   - time-series:     时间序列（按天/小时递增）
 *   - top-n:           排序后的 N 条数据（演示排行榜）
 *   - geo-coords:      城市 → [lng, lat]（地图组件用）
 *   - hierarchical:    层级数据（树形）
 *   - categorical:     枚举分类（按 label 生成对应 count）
 */

const CITY_NAMES = ["北京", "上海", "深圳", "广州", "杭州", "成都", "武汉", "西安", "重庆", "天津", "南京", "苏州", "青岛", "大连"];
const INDUSTRY_NAMES = ["旅游", "政务", "医疗", "金融", "环保", "地产", "车辆", "警务", "科技", "教育", "零售", "能源", "物流", "制造"];
const PRODUCT_NAMES = ["产品A", "产品B", "产品C", "产品D", "产品E", "产品F", "产品G", "产品H", "产品I", "产品J"];

function rand(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

/** 为单个组件生成 mock 数据。 */
export function generateMockForComponent(comp, rules) {
	const data = rules?.data ?? [];

	switch (rules?.generator) {
		case "top-n": {
			const rowNum = rules.rowNum ?? 10;
			const names = rules.names ?? CITY_NAMES.slice(0, rowNum);
			const result = names.map(name => ({ name, value: rand(rules.min ?? 100, rules.max ?? 10000) }));
			return result.sort((a, b) => b.value - a.value);
		}

		case "time-series": {
			const count = rules.count ?? 12;
			const start = rules.start ?? new Date(Date.now() - count * 86400000);
			const names = [];
			for (let i = 0; i < count; i++) {
				const d = new Date(start.getTime() + i * 86400000);
				names.push(`${d.getMonth() + 1}/${d.getDate()}`);
			}
			return names.map(name => ({ name, value: rand(rules.min ?? 0, rules.max ?? 1000) }));
		}

		case "categorical": {
			const labels = rules.labels ?? INDUSTRY_NAMES.slice(0, 6);
			return labels.map(label => ({ name: label, value: rand(rules.min ?? 50, rules.max ?? 2000) }));
		}

		case "geo-coords": {
			const count = rules.count ?? 5;
			return CITY_NAMES.slice(0, count).map(name => ({ name, from: name, value: rand(rules.min ?? 100, rules.max ?? 5000) }));
		}

		case "hierarchical": {
			const rootName = rules.root ?? "总数据";
			const childrenNames = rules.children ?? PRODUCT_NAMES.slice(0, 5);
			return {
				name: rootName,
				value: rand(rules.min ?? 1000, rules.max ?? 10000),
				children: childrenNames.map(name => ({ name, value: rand(rules.min ?? 100, rules.max ?? 2000) })),
			};
		}

		case "random-range": {
			const count = rules.count ?? 10;
			if (data.length > 0) return data; // 模板里已写了数据就用模板的
			return Array.from({ length: count }, (_, i) => ({ name: `${rules.prefix ?? "Item"}-${i + 1}`, value: rand(rules.min ?? 0, rules.max ?? 100) }));
		}

		default:
			// 回退：从现有 data 推断或生成通用数据
			if (data.length > 0) return data;
			return CITY_NAMES.slice(0, 6).map((name, i) => ({ name, value: rand(100, 5000) }));
	}
}

/** 为整个模板生成 mock 数据（遍历所有 components，按 type 选合理 generator）。 */
export function generateTemplateMockData(spec) {
	const components = spec.components ?? [];
	const results = {};

	for (let i = 0; i < components.length; i++) {
		const comp = components[i];
		const rules = (spec.mockDataRules ?? []).find(r => r.targetComponent === comp.type);

		let mockData;
		if (rules) {
			mockData = generateMockForComponent(comp, { ...rules });
		} else {
			// 按组件类型选合理 generator
			mockData = pickDefaultGenerator(comp.type, comp);
		}
		results[`comp-${i}`] = mockData;
		results[comp.type + (comp.title ? `-${comp.title}` : "")] = mockData;
	}

	return results;
}

function pickDefaultGenerator(type, comp) {
	switch (type) {
		case "JBar": case "JStackBar": case "JMultipleBar": case "JPie": case "JRing":
		case "JLine": case "JMultipleLine":
		case "JFunnel": case "JRadar":
			return generateMockForComponent(comp, { generator: "categorical", labels: CITY_NAMES.slice(0, 6), min: 100, max: 5000 });

		case "JScrollRankingBoard":
			return generateMockForComponent(comp, { generator: "top-n", rowNum: comp.rowNum ?? 8, min: 50, max: 10000 });

		case "JGauge": case "JSemiGauge":
			return comp.value ?? rand(30, 95);

		case "JCountTo": case "JNumber":
			return comp.value ?? rand(1000, 50000);

		case "JStatsSummary":
			return (comp.items ?? [
				{ label: "总数", value: "29,500", suffix: "人" },
				{ label: "同比", value: "+12.5%", trend: "+12.5%" },
				{ label: "峰值", value: "3,200", suffix: "/小时" },
			]);

		case "JScrollBoard": case "JScrollTable":
			return CITY_NAMES.slice(0, 8).map((name, i) => [name, rand(1000, 10000), `${rand(5, 50)}%`, pickRandom(["正常", "警告", "优秀"])]);

		default:
			return comp.data ?? [];
	}
}
