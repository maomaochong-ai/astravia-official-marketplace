/**
 * dbx-pro 「API 接入」功能的本地 Mock 后端。
 *
 * 零依赖：只用 Node.js 内置 http。
 * 启动：  node src/test/mock-api-server.mjs [port]
 * 默认端口：8765
 *
 * 提供三类端点，覆盖 dbx-pro api-connection-form 的常见填写场景：
 *
 *  ┌─ 端点 ────────────────┬─ 响应结构 ──────────────────────┬─ dataPath ──────────┐
 *  │ /api/users             │ 直接数组                          │ （空，默认）          │
 *  │ /api/products          │ { code, message, data: { list } }  │ data.list            │
 *  │ /api/orders            │ { success, data: { items } }      │ data.items           │
 *  │ /api/reports/summary   │ { data: { reports: [...] } }      │ data.reports         │
 *  └────────────────────────┴───────────────────────────────────┴─────────────────────┘
 *
 * 可选 Bearer 认证：请求头 Authorization: Bearer test-token
 * 不带或带错会返回 401（用于测试认证失败场景）。
 * 认证默认关闭，传入环境变量 MOCK_AUTH=1 开启。
 */

import { createServer } from "node:http";

const PORT = Number(process.argv[2]) || 8765;
const ENABLE_AUTH = process.env.MOCK_AUTH === "1";
const VALID_TOKEN = "test-token";

// ── 测试数据 ──────────────────────────────────────────────────────

const USERS = [
	{ id: 1, name: "Alice", email: "alice@example.com", age: 28, city: "Beijing", status: "active", created_at: "2025-01-15" },
	{ id: 2, name: "Bob", email: "bob@example.com", age: 34, city: "Shanghai", status: "active", created_at: "2025-02-20" },
	{ id: 3, name: "Charlie", email: "charlie@example.com", age: 22, city: "Guangzhou", status: "inactive", created_at: "2025-03-10" },
	{ id: 4, name: "Diana", email: "diana@example.com", age: 45, city: "Beijing", status: "active", created_at: "2025-04-05" },
	{ id: 5, name: "Evan", email: "evan@example.com", age: 31, city: "Shenzhen", status: "active", created_at: "2025-05-12" },
	{ id: 6, name: "Fiona", email: "fiona@example.com", age: 27, city: "Shanghai", status: "pending", created_at: "2025-06-18" },
	{ id: 7, name: "George", email: "george@example.com", age: 52, city: "Beijing", status: "active", created_at: "2025-07-22" },
	{ id: 8, name: "Helen", email: "helen@example.com", age: 29, city: "Chengdu", status: "active", created_at: "2025-08-30" },
];

const PRODUCTS = [
	{ sku: "P001", name: "机械键盘", price: 599.0, stock: 120, category: "外设", rating: 4.7 },
	{ sku: "P002", name: "无线鼠标", price: 299.0, stock: 340, category: "外设", rating: 4.5 },
	{ sku: "P003", name: "4K 显示器", price: 2499.0, stock: 45, category: "显示", rating: 4.8 },
	{ sku: "P004", name: "USB-C 集线器", price: 159.0, stock: 520, category: "配件", rating: 4.3 },
	{ sku: "P005", name: "降噪耳机", price: 1299.0, stock: 78, category: "音频", rating: 4.6 },
	{ sku: "P006", name: "人体工学椅", price: 3599.0, stock: 12, category: "家具", rating: 4.9 },
];

const ORDERS = [
	{ order_id: "A1001", user_id: 1, amount: 898.0, status: "paid", items: 2, ordered_at: "2025-09-01T10:23:00Z" },
	{ order_id: "A1002", user_id: 2, amount: 2499.0, status: "shipped", items: 1, ordered_at: "2025-09-02T14:15:00Z" },
	{ order_id: "A1003", user_id: 1, amount: 159.0, status: "pending", items: 1, ordered_at: "2025-09-03T09:00:00Z" },
	{ order_id: "A1004", user_id: 4, amount: 3599.0, status: "paid", items: 1, ordered_at: "2025-09-04T16:42:00Z" },
	{ order_id: "A1005", user_id: 5, amount: 598.0, status: "cancelled", items: 2, ordered_at: "2025-09-05T11:30:00Z" },
	{ order_id: "A1006", user_id: 2, amount: 1299.0, status: "delivered", items: 1, ordered_at: "2025-09-06T08:10:00Z" },
];

const REPORTS = [
	{ month: "2025-07", revenue: 128450.0, orders: 342, customers: 198, avg_order: 375.6 },
	{ month: "2025-08", revenue: 156230.0, orders: 410, customers: 245, avg_order: 381.0 },
	{ month: "2025-09", revenue: 98720.0, orders: 289, customers: 167, avg_order: 341.6 },
];

// ── 路由 ──────────────────────────────────────────────────────────

function send(res, code, payload) {
	const body = JSON.stringify(payload);
	res.writeHead(code, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(body),
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
		"Access-Control-Allow-Methods": "GET, OPTIONS",
	});
	res.end(body);
}

function handle(req, res) {
	const url = new URL(req.url, `http://${req.headers.host}`);

	if (req.method === "OPTIONS") {
		return send(res, 204, null);
	}

	if (ENABLE_AUTH) {
		const auth = req.headers["authorization"] ?? "";
		if (auth !== `Bearer ${VALID_TOKEN}`) {
			return send(res, 401, { error: "unauthorized", hint: "请加 Authorization: Bearer test-token" });
		}
	}

	switch (url.pathname) {
		case "/health":
			return send(res, 200, { ok: true, uptime: process.uptime() });

		// 场景 1：响应本身就是数组 —— dataPath 留空
		case "/api/users":
			return send(res, 200, USERS);

		// 场景 2：嵌套 data.list —— dataPath = data.list
		case "/api/products":
			return send(res, 200, { code: 0, message: "ok", data: { list: PRODUCTS, total: PRODUCTS.length } });

		// 场景 3：嵌套 data.items —— dataPath = data.items
		case "/api/orders":
			return send(res, 200, { success: true, data: { items: ORDERS, page: 1, totalPages: 1 } });

		// 场景 4：嵌套 data.reports —— dataPath = data.reports
		case "/api/reports/summary":
			return send(res, 200, { data: { reports: REPORTS, generatedAt: new Date().toISOString() } });

		default:
			return send(res, 404, { error: "not_found", available: ["/api/users", "/api/products", "/api/orders", "/api/reports/summary", "/health"] });
	}
}

const server = createServer((req, res) => {
	try { handle(req, res); }
	catch (e) { send(res, 500, { error: e.message }); }
});

server.listen(PORT, () => {
	const authNote = ENABLE_AUTH ? " (已开启 Bearer 认证, token=test-token)" : " (认证已关闭)";
	console.log(`[mock-api] http://localhost:${PORT}${authNote}`);
	console.log(`[mock-api] endpoints:`);
	console.log(`  GET /api/users             → 直接数组，dataPath 留空`);
	console.log(`  GET /api/products          → dataPath = data.list`);
	console.log(`  GET /api/orders            → dataPath = data.items`);
	console.log(`  GET /api/reports/summary   → dataPath = data.reports`);
	console.log(`  GET /health                → 健康检查`);
});
