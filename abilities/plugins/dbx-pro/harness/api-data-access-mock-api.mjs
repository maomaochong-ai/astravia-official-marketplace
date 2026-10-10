// 「API 接入」端到端验证用的本地假接口：需要认证头，返回嵌套结构的 JSON。
// 与 harness/api-data-access-e2e.mjs 配套，不参与打包（harness/ 不在制品白名单内）。
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 8787);
const TOKEN = process.env.MOCK_TOKEN ?? "secret-token-123";

const ROWS = Array.from({ length: 7 }, (_, i) => ({
	id: i + 1,
	title: `文章 ${i + 1}`,
	author: { name: `作者${i + 1}`, team: i % 2 === 0 ? "A" : "B" },
	tags: ["x", "y"],
	amount: (i + 1) * 10,
}));

const server = createServer((req, res) => {
	const url = new URL(req.url, "http://127.0.0.1");
	if (url.pathname === "/api/v1/posts") {
		const auth = req.headers.authorization ?? "";
		if (auth !== `Bearer ${TOKEN}`) {
			res.writeHead(401, { "content-type": "application/json" });
			res.end(JSON.stringify({ error: "unauthorized" }));
			return;
		}
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify({ data: { items: ROWS, total: ROWS.length } }));
		return;
	}
	if (url.pathname === "/api/v1/ping") {
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify({ ok: true }));
		return;
	}
	res.writeHead(404, { "content-type": "application/json" });
	res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`mock api on http://127.0.0.1:${PORT}/api/v1/posts (token=${TOKEN}, rows=${ROWS.length})`);
});
