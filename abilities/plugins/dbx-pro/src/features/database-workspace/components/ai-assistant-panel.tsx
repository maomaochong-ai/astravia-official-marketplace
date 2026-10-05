/**
 * AI 协助连接数据库面板
 * 
 * 参考 dbx 桌面壳的"让 AI 协助帮您配置"功能
 * 用户可以通过自然语言描述数据库连接信息，AI 帮助生成连接配置
 */

import { useState, type JSX } from "react";

interface Props {
	onClose: () => void;
	onCreateConnection: (config: {
		name: string;
		dbType: string;
		host: string;
		port: number;
		username: string;
		password: string;
		database?: string;
	}) => void;
}

/** 支持的数据库类型列表 */
const SUPPORTED_DB_TYPES = [
	{ value: "postgres", label: "PostgreSQL", defaultPort: 5432 },
	{ value: "mysql", label: "MySQL", defaultPort: 3306 },
	{ value: "mariadb", label: "MariaDB", defaultPort: 3306 },
	{ value: "sqlserver", label: "SQL Server", defaultPort: 1433 },
	{ value: "oracle", label: "Oracle", defaultPort: 1521 },
	{ value: "sqlite", label: "SQLite", defaultPort: 0 },
	{ value: "mongodb", label: "MongoDB", defaultPort: 27017 },
	{ value: "redis", label: "Redis", defaultPort: 6379 },
	{ value: "clickhouse", label: "ClickHouse", defaultPort: 8123 },
	{ value: "elasticsearch", label: "Elasticsearch", defaultPort: 9200 },
];

export function AiAssistantPanel({ onClose, onCreateConnection }: Props): JSX.Element {
	const [description, setDescription] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [extractedConfig, setExtractedConfig] = useState<{
		name: string;
		dbType: string;
		host: string;
		port: number;
		username: string;
		password: string;
		database?: string;
	} | null>(null);

	/**
	 * 模拟 AI 解析连接描述
	 * 实际应该调用 AI API 来解析自然语言
	 */
	async function handleAnalyze(): Promise<void> {
		if (!description.trim()) return;
		
		setIsProcessing(true);
		
		// 模拟 AI 处理延迟
		await new Promise((resolve) => setTimeout(resolve, 1000));
		
		// 简单的关键词提取（实际应该用 AI）
		const lowerDesc = description.toLowerCase();
		let dbType = "postgres";
		let host = "localhost";
		let port = 5432;
		let username = "";
		let password = "";
		let database = "";
		let name = "新连接";
		
		// 识别数据库类型
		for (const db of SUPPORTED_DB_TYPES) {
			if (lowerDesc.includes(db.value) || lowerDesc.includes(db.label.toLowerCase())) {
				dbType = db.value;
				port = db.defaultPort;
				break;
			}
		}
		
		// 识别主机地址
		const hostMatch = description.match(/(?:host|主机|地址|服务器)[：:\s]*([^\s,，]+)/i);
		if (hostMatch) host = hostMatch[1];
		
		// 识别端口
		const portMatch = description.match(/(?:port|端口)[：:\s]*(\d+)/i);
		if (portMatch) port = parseInt(portMatch[1], 10);
		
		// 识别用户名
		const userMatch = description.match(/(?:user|username|用户名|账号)[：:\s]*([^\s,，]+)/i);
		if (userMatch) username = userMatch[1];
		
		// 识别密码
		const passMatch = description.match(/(?:password|pass|密码)[：:\s]*([^\s,，]+)/i);
		if (passMatch) password = passMatch[1];
		
		// 识别数据库名
		const dbMatch = description.match(/(?:database|db|数据库|库名)[：:\s]*([^\s,，]+)/i);
		if (dbMatch) database = dbMatch[1];
		
		// 识别连接名称
		const nameMatch = description.match(/(?:name|名称|连接名)[：:\s]*([^\s,，]+)/i);
		if (nameMatch) name = nameMatch[1];
		
		setExtractedConfig({ name, dbType, host, port, username, password, database });
		setIsProcessing(false);
	}

	function handleCreate(): void {
		if (extractedConfig) {
			onCreateConnection(extractedConfig);
			onClose();
		}
	}

	return (
		<div className="dbx-connection-dialog" style={{ width: "min(560px, calc(100% - 2rem))" }}>
			{/* 头部 */}
			<div className="dbx-connection-header">
				<span className="icon-[lucide--sparkles] h-4 w-4 text-primary" />
				<h2 className="dbx-connection-title">让 AI 协助连接数据库</h2>
				<button
					type="button"
					onClick={onClose}
					title="关闭"
					className="dbx-iconbtn"
				>
					<span className="icon-[lucide--x] h-4 w-4" />
				</button>
			</div>

			{/* 内容区 */}
			<div className="dbx-connection-body">
				<div className="space-y-3">
					<div>
						<label className="dbx-form-label">描述您的数据库连接</label>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="例如：我需要连接一个 PostgreSQL 数据库，主机是 db.example.com，端口 5432，用户名 admin，密码 secret123，数据库名 myapp"
							className="dbx-form-input resize-none"
							rows={4}
							style={{ minHeight: 80 }}
						/>
						<p className="mt-1 text-[10px] text-muted-foreground">
							用自然语言描述数据库连接信息，AI 会自动提取配置
						</p>
					</div>

					<button
						type="button"
						onClick={handleAnalyze}
						disabled={isProcessing || !description.trim()}
						className="dbx-btn primary w-full"
						style={{ height: 32 }}
					>
						{isProcessing ? (
							<>
								<span className="icon-[lucide--loader] h-3.5 w-3.5 animate-spin" />
								AI 分析中...
							</>
						) : (
							<>
								<span className="icon-[lucide--sparkles] h-3.5 w-3.5" />
								分析连接信息
							</>
						)}
					</button>

					{extractedConfig && (
						<div className="dbx-panel-group">
							<div className="dbx-panel-group-header">提取的连接配置</div>
							<div className="dbx-panel-group-body space-y-2">
								<div className="grid grid-cols-2 gap-2">
									<div>
										<label className="dbx-form-label">连接名称</label>
										<input
											type="text"
											value={extractedConfig.name}
											onChange={(e) => setExtractedConfig({ ...extractedConfig, name: e.target.value })}
											className="dbx-form-input"
										/>
									</div>
									<div>
										<label className="dbx-form-label">数据库类型</label>
										<select
											value={extractedConfig.dbType}
											onChange={(e) => {
												const db = SUPPORTED_DB_TYPES.find(d => d.value === e.target.value);
												setExtractedConfig({ 
													...extractedConfig, 
													dbType: e.target.value,
													port: db?.defaultPort ?? extractedConfig.port 
												});
											}}
											className="dbx-form-input"
										>
											{SUPPORTED_DB_TYPES.map((db) => (
												<option key={db.value} value={db.value}>{db.label}</option>
											))}
										</select>
									</div>
									<div>
										<label className="dbx-form-label">主机地址</label>
										<input
											type="text"
											value={extractedConfig.host}
											onChange={(e) => setExtractedConfig({ ...extractedConfig, host: e.target.value })}
											className="dbx-form-input"
										/>
									</div>
									<div>
										<label className="dbx-form-label">端口</label>
										<input
											type="number"
											value={extractedConfig.port}
											onChange={(e) => setExtractedConfig({ ...extractedConfig, port: parseInt(e.target.value, 10) || 0 })}
											className="dbx-form-input"
										/>
									</div>
									<div>
										<label className="dbx-form-label">用户名</label>
										<input
											type="text"
											value={extractedConfig.username}
											onChange={(e) => setExtractedConfig({ ...extractedConfig, username: e.target.value })}
											className="dbx-form-input"
										/>
									</div>
									<div>
										<label className="dbx-form-label">密码</label>
										<input
											type="password"
											value={extractedConfig.password}
											onChange={(e) => setExtractedConfig({ ...extractedConfig, password: e.target.value })}
											className="dbx-form-input"
										/>
									</div>
									<div className="col-span-2">
										<label className="dbx-form-label">数据库名（可选）</label>
										<input
											type="text"
											value={extractedConfig.database ?? ""}
											onChange={(e) => setExtractedConfig({ ...extractedConfig, database: e.target.value })}
											className="dbx-form-input"
										/>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* 底部操作栏 */}
			{extractedConfig && (
				<div className="dbx-connection-footer">
					<button className="dbx-btn ghost" onClick={onClose}>
						取消
					</button>
					<div className="flex-1" />
					<button className="dbx-btn primary" onClick={handleCreate}>
						创建连接
					</button>
				</div>
			)}
		</div>
	);
}
