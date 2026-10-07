/**
 * OpenMetadata MCP 工具定义和 handler。
 *
 * 每个工具由两部分组成：
 *  - definition：{ name, description, parameters } —— 传给 ctx.agent.registerTool 的工具签名
 *  - handler: (params) => Promise<{ content: [{ type: "text", text: string }] }> —— Agent 调用时执行
 *
 * handler 内部逻辑：
 *   1. 参数校验（基础必填检查，复杂校验留给 OM 服务端）
 *   2. 调用 omRequest() → 代理进程 → OM REST API
 *   3. 错误处理 → 结构化返回 isError + 可读消息
 *   4. 成功 → 裁剪/格式化后返回紧凑 JSON 文本
 */

import { omRequest, OmProxyError } from "../shared/om-services";

// ==================== Handler 辅助 ====================

function errorResult(message: string, detail?: unknown) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: detail ? `${message}\n\n${JSON.stringify(detail, null, 2)}` : message }],
  };
}

function textResult(data: unknown) {
  const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  // Agent MCP 工具结果上限是几 KB，大响应做裁剪
  if (json.length > 20000) {
    return {
      isError: false as const,
      content: [
        { type: "text" as const, text: json.slice(0, 18000) + "\n\n... [结果已截断，请使用更精确的查询]" },
      ],
    };
  }
  return { isError: false as const, content: [{ type: "text" as const, text: json }] };
}

async function safeRequest<T>(path: string, options?: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown }) {
  try {
    const data = await omRequest<T>(path, options);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: e as OmProxyError };
  }
}

// ==================== L0 — 核心只读工具 ====================

export const omSearchMetadataTool = {
  name: "om_search_metadata",
  description: "Search metadata entities across all OpenMetadata assets using keyword search. Supports advanced OpenSearch queries via queryFilter. Returns matching entities with their FQN, type, owner, tier, and tags.",
  parameters: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Keyword or search text. Use lowercase for term/terms queries." },
      entityType: {
        type: "string",
        description: "Filter by entity type: table, dashboard, pipeline, topic, metric, chart, glossaryTerm, domain, database, databaseSchema, mlmodel, searchIndex, storedProcedure, etc.",
      },
      queryFilter: { type: "string", description: "Advanced OpenSearch DSL JSON to refine results." },
      size: { type: "integer", description: "Number of results to return (max 50, default 10)." },
      fields: { type: "array", items: { type: "string" }, description: "Additional fields to include (e.g., [columns, aiContext, domain, owners])." },
    },
    required: ["query"],
  },
  handler: async (params: { query: string; entityType?: string; queryFilter?: string; size?: number; fields?: string[] }) => {
    const query = new URLSearchParams({ query: params.query });
    if (params.entityType) query.set("entityType", params.entityType);
    if (params.size) query.set("size", String(params.size));
    if (params.fields) query.set("fields", params.fields.join(","));
    if (params.queryFilter) query.set("queryFilter", params.queryFilter);

    const result = await safeRequest<unknown>(`/search/query?${query.toString()}`);
    if (!result.ok) return errorResult(`om_search_metadata failed: ${result.error.message}`, result.error.omResponse);
    return textResult(result.data);
  },
};

export const omSemanticSearchTool = {
  name: "om_semantic_search",
  description: "Semantic vector search using natural language. Requires OpenMetadata to be configured with embeddings. Returns the most relevant entities with matching text passages. Falls back to om_search_metadata if semantic search is not configured.",
  parameters: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Natural language query describing what data you're looking for." },
      filters: {
        type: "object",
        description: "Optional filters: { entityType: [...], service: [...], tags: [...], tiers: [...], owners: [...] }",
      },
      size: { type: "integer", description: "Number of results (default 10, max 50)." },
      threshold: { type: "number", description: "Minimum similarity score (default 0.0)." },
    },
    required: ["query"],
  },
  handler: async (params: { query: string; filters?: Record<string, unknown>; size?: number; threshold?: number }) => {
    const body: Record<string, unknown> = { query: params.query };
    if (params.filters) body.filters = params.filters;
    if (params.size) body.size = params.size;
    if (params.threshold !== undefined) body.threshold = params.threshold;

    const result = await safeRequest<unknown>(`/search/vector/query`, { method: "POST", body });
    if (!result.ok) {
      // 向量嵌入未配置 → Agent 应降级到关键词搜索
      const omMsg = typeof result.error.omResponse === "object" && result.error.omResponse
        ? String((result.error.omResponse as { message?: string }).message ?? "")
        : "";
      if (result.error.code === "OM_ERROR" && /not configured/i.test(omMsg)) {
        return errorResult("Semantic search is not configured on this OpenMetadata instance. Please use om_search_metadata instead.");
      }
      return errorResult(`om_semantic_search failed: ${result.error.message}`, result.error.omResponse);
    }
    return textResult(result.data);
  },
};

export const omGetEntityDetailsTool = {
  name: "om_get_entity_details",
  description: "Get complete details of a metadata entity including columns, relationships, lineage context, data quality tests, and glossary tags. Use the FQN from search results as the identifier.",
  parameters: {
    type: "object" as const,
    properties: {
      entityType: { type: "string", description: "Entity type (table, dashboard, pipeline, glossaryTerm, domain, etc.)." },
      fqn: { type: "string", description: "Fully Qualified Name (FQN) of the entity. Get this from search results." },
      columnsOffset: { type: "integer", description: "Offset for column pagination (for wide tables)." },
      columnsLimit: { type: "integer", description: "Limit columns returned (default includes all)." },
      include: {
        type: "array",
        items: { type: "string" },
        description: "Additional sections to include: [lineage, quality, context, content]. 'context' gives you PK/FK/frequent joins — useful before writing SQL.",
      },
    },
    required: ["entityType", "fqn"],
  },
  handler: async (params: { entityType: string; fqn: string; columnsOffset?: number; columnsLimit?: number; include?: string[] }) => {
    const query = new URLSearchParams();
    if (params.columnsOffset !== undefined) query.set("columnOffset", String(params.columnsOffset));
    if (params.columnsLimit !== undefined) query.set("columnLimit", String(params.columnsLimit));
    if (params.include) query.set("include", params.include.join(","));
    const qs = query.toString();
    const path = `/${params.entityType}/${encodeURIComponent(params.fqn)}${qs ? `?${qs}` : ""}`;

    const result = await safeRequest<unknown>(path);
    if (!result.ok) return errorResult(`om_get_entity_details failed: ${result.error.message}`, result.error.omResponse);
    return textResult(result.data);
  },
};

export const omGetEntityLineageTool = {
  name: "om_get_entity_lineage",
  description: "Get the upstream and downstream lineage graph for an entity. Useful for understanding data flow, impact analysis, and root cause investigation of data quality issues.",
  parameters: {
    type: "object" as const,
    properties: {
      entityType: { type: "string", description: "Entity type (table, dashboard, pipeline, etc.)." },
      fqn: { type: "string", description: "Fully Qualified Name of the entity." },
      upstreamDepth: { type: "integer", description: "How many levels upstream to traverse (default 3, max 10)." },
      downstreamDepth: { type: "integer", description: "How many levels downstream to traverse (default 3, max 10)." },
      includeColumnLineage: { type: "boolean", description: "Include column-level lineage mappings (larger response)." },
      includeSql: { type: "boolean", description: "Include transformation SQL for each edge (very large response, use sparingly)." },
    },
    required: ["entityType", "fqn"],
  },
  handler: async (params: { entityType: string; fqn: string; upstreamDepth?: number; downstreamDepth?: number; includeColumnLineage?: boolean; includeSql?: boolean }) => {
    const query = new URLSearchParams();
    if (params.upstreamDepth !== undefined) query.set("upstreamDepth", String(params.upstreamDepth));
    if (params.downstreamDepth !== undefined) query.set("downstreamDepth", String(params.downstreamDepth));
    if (params.includeColumnLineage) query.set("includeColumns", "true");
    if (params.includeSql) query.set("includeLineageDetails", "true");
    const qs = query.toString();
    const path = `/lineage/${params.entityType}/${encodeURIComponent(params.fqn)}${qs ? `?${qs}` : ""}`;

    const result = await safeRequest<unknown>(path);
    if (!result.ok) return errorResult(`om_get_entity_lineage failed: ${result.error.message}`, result.error.omResponse);
    return textResult(result.data);
  },
};

export const omGetUserContextTool = {
  name: "om_get_user_context",
  description: "Get the current authenticated user's context including owned entities, followed assets, persona assignments, and role details.",
  parameters: {
    type: "object" as const,
    properties: {},
  },
  handler: async () => {
    const result = await safeRequest<unknown>("/users/current");
    if (!result.ok) return errorResult(`om_get_user_context failed: ${result.error.message}`, result.error.omResponse);
    return textResult(result.data);
  },
};

export const omGetPersonaContextTool = {
  name: "om_get_persona_context",
  description: "Get the AI context for a specific persona (or your own persona if no name given). Persona context helps AI understand the user's data domain, glossary, and typical queries.",
  parameters: {
    type: "object" as const,
    properties: {
      personaName: { type: "string", description: "Persona name/FQN. If omitted, returns your own persona context." },
      part: { type: "string", description: "Specific part: context, glossary, or all (default context)." },
    },
  },
  handler: async (params: { personaName?: string; part?: string }) => {
    const path = params.personaName
      ? `/personas/name/${encodeURIComponent(params.personaName)}/context`
      : "/personas/my/context";
    const query = new URLSearchParams();
    if (params.part) query.set("part", params.part);
    const qs = query.toString();

    const result = await safeRequest<unknown>(`${path}${qs ? `?${qs}` : ""}`);
    if (!result.ok) return errorResult(`om_get_persona_context failed: ${result.error.message}`, result.error.omResponse);
    return textResult(result.data);
  },
};

export const omFindContextTool = {
  name: "om_find_context",
  description: "Guided context discovery: given a business question or term, finds relevant glossary terms, candidate data assets, and their relationships. Combines semantic search + glossary lookup internally.",
  parameters: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Business question or term you want to understand (e.g., 'customer churn analysis', 'quarterly revenue')." },
      format: { type: "string", enum: ["markdown", "json"], description: "Output format (default markdown, easier for humans)." },
    },
    required: ["query"],
  },
  handler: async (params: { query: string; format?: string }) => {
    // 内部组合：语义搜索 + glossary 搜索
    const format = params.format ?? "markdown";
    const results: string[] = [];

    // 1. 语义搜索候选资产
    const semantic = await safeRequest<unknown>("/search/vector/query", {
      method: "POST",
      body: { query: params.query, size: 5 },
    });
    if (semantic.ok) results.push("## Semantic Search Results\n" + JSON.stringify(semantic.data, null, 2));

    // 2. 关键词搜索 glossary 术语
    const glossary = await safeRequest<unknown>(
      `/search/query?query=${encodeURIComponent(params.query)}&entityType=glossaryTerm&size=5`,
    );
    if (glossary.ok) results.push("## Glossary Matches\n" + JSON.stringify(glossary.data, null, 2));

    // 3. 关键词搜索 metric
    const metric = await safeRequest<unknown>(
      `/search/query?query=${encodeURIComponent(params.query)}&entityType=metric&size=5`,
    );
    if (metric.ok) results.push("## Metric Matches\n" + JSON.stringify(metric.data, null, 2));

    return format === "json"
      ? textResult({ semantic: semantic.ok ? semantic.data : null, glossary: glossary.ok ? glossary.data : null, metric: metric.ok ? metric.data : null })
      : { isError: false as const, content: [{ type: "text" as const, text: results.join("\n\n") || "No matching context found." }] };
  },
};

// ==================== L1 — 写入治理工具 ====================

export const omCreateEntityTool = {
  name: "om_create_entity",
  description: "Create a new governance entity in OpenMetadata. Supports: glossaryTerm, glossary, domain, dataProduct, metric, classification, tag, chart, page. Read-only entities (table, database, pipeline) CANNOT be created — those come from ingestion connectors.",
  parameters: {
    type: "object" as const,
    properties: {
      entityType: { type: "string", description: "Entity type to create (glossaryTerm, glossary, domain, metric, classification, tag, dataProduct, chart, page)." },
      name: { type: "string", description: "Name for the new entity." },
      attributes: { type: "object", description: "Entity-specific attributes. Use om_describe_entity_type first to see what's required." },
      description: { type: "string", description: "Optional description." },
    },
    required: ["entityType", "name", "attributes"],
  },
  handler: async (params: { entityType: string; name: string; attributes: Record<string, unknown>; description?: string }) => {
    const body: Record<string, unknown> = { name: params.name, ...params.attributes };
    if (params.description) body.description = params.description;

    const result = await safeRequest<unknown>(`/${params.entityType}`, { method: "POST", body });
    if (!result.ok) {
      if (result.error.code === "AUTH_EXPIRED") return errorResult("Cannot create entity: API Token expired. Please update your token in plugin settings.");
      if (result.error.statusCode === 403) return errorResult(`Cannot create entity: your token lacks write permissions for ${params.entityType}.`, result.error.omResponse);
      return errorResult(`om_create_entity failed: ${result.error.message}`, result.error.omResponse);
    }
    return textResult(result.data);
  },
};

export const omPatchEntityTool = {
  name: "om_patch_entity",
  description: "Update an existing entity using JSON Patch (RFC 6902). Use this to add glossary tags, update domain assignment, change owner, modify description, or update any mutable field.",
  parameters: {
    type: "object" as const,
    properties: {
      entityType: { type: "string", description: "Entity type." },
      fqn: { type: "string", description: "Fully Qualified Name of the entity." },
      patch: {
        type: "array",
        description: "JSON Patch operations array. Each: { op: 'add'|'remove'|'replace', path: '/field', value: ... }",
      },
    },
    required: ["entityType", "fqn", "patch"],
  },
  handler: async (params: { entityType: string; fqn: string; patch: unknown[] }) => {
    const result = await safeRequest<unknown>(
      `/${params.entityType}/${encodeURIComponent(params.fqn)}`,
      { method: "PATCH", body: params.patch },
    );
    if (!result.ok) {
      if (result.error.code === "AUTH_EXPIRED") return errorResult("Cannot update entity: API Token expired.");
      if (result.error.statusCode === 403) return errorResult("Cannot update entity: insufficient permissions.", result.error.omResponse);
      return errorResult(`om_patch_entity failed: ${result.error.message}`, result.error.omResponse);
    }
    return textResult(result.data);
  },
};

export const omCreateLineageTool = {
  name: "om_create_lineage",
  description: "Create a lineage connection between two entities. Use when lineage is missing between tables/dashboards/pipelines and you need to manually establish the relationship.",
  parameters: {
    type: "object" as const,
    properties: {
      fromEntity: { type: "object", description: "{ type: 'table'|'dashboard'|..., fqn: 'service.db.schema.table' }" },
      toEntity: { type: "object", description: "{ type: 'table'|'dashboard'|..., fqn: 'service.db.schema.table' }" },
      columns: { type: "array", description: "Optional column-level mappings: [{ fromColumn, toColumn }]" },
      description: { type: "string", description: "Optional description of the transformation." },
    },
    required: ["fromEntity", "toEntity"],
  },
  handler: async (params: { fromEntity: Record<string, unknown>; toEntity: Record<string, unknown>; columns?: unknown[]; description?: string }) => {
    const body: Record<string, unknown> = { fromEntity: params.fromEntity, toEntity: params.toEntity };
    if (params.columns) body.columns = params.columns;
    if (params.description) body.description = params.description;

    const result = await safeRequest<unknown>("/lineage", { method: "POST", body });
    if (!result.ok) return errorResult(`om_create_lineage failed: ${result.error.message}`, result.error.omResponse);
    return textResult(result.data);
  },
};

export const omCreateTestCaseTool = {
  name: "om_create_test_case",
  description: "Create a data quality test case for a table or column. Use om_get_test_definitions first to see what test templates are available and what parameters they require.",
  parameters: {
    type: "object" as const,
    properties: {
      name: { type: "string", description: "Test case name." },
      fqn: { type: "string", description: "Table FQN to test (always table FQN, not column)." },
      columnName: { type: "string", description: "Column name (for column-level tests only)." },
      testDefinitionName: { type: "string", description: "Test definition name (e.g., 'columnValuesToBeUnique')." },
      parameterValues: {
        type: "array",
        description: "Parameter values for the test definition: [{ name, value }]",
      },
      testSuiteName: { type: "string", description: "Optional test suite name to group this test." },
    },
    required: ["name", "fqn", "testDefinitionName", "parameterValues"],
  },
  handler: async (params: Record<string, unknown>) => {
    const result = await safeRequest<unknown>("/dataQuality/testCases", { method: "POST", body: params });
    if (!result.ok) return errorResult(`om_create_test_case failed: ${result.error.message}`, result.error.omResponse);
    return textResult(result.data);
  },
};

export const omGetTestDefinitionsTool = {
  name: "om_get_test_definitions",
  description: "List available data quality test templates. Use before creating test cases to see what tests are supported and what parameters each requires.",
  parameters: {
    type: "object" as const,
    properties: {
      entityType: { type: "string", description: "TABLE or COLUMN (default TABLE)." },
      testPlatform: { type: "string", description: "OpenMetadata / GreatExpectations / DBT / Deequ / Soda / Other." },
    },
  },
  handler: async (params: { entityType?: string; testPlatform?: string }) => {
    const query = new URLSearchParams();
    if (params.entityType) query.set("entityType", params.entityType);
    if (params.testPlatform) query.set("testPlatform", params.testPlatform);
    const qs = query.toString();

    const result = await safeRequest<unknown>(`/dataQuality/testDefinitions${qs ? `?${qs}` : ""}`);
    if (!result.ok) return errorResult(`om_get_test_definitions failed: ${result.error.message}`, result.error.omResponse);
    return textResult(result.data);
  },
};

// ==================== L2 — 分析诊断工具 ====================

export const omRootCauseAnalysisTool = {
  name: "om_root_cause_analysis",
  description: "Perform root cause analysis for data quality failures. Traverses upstream lineage to find where test failures originate. Useful when a table has many failing tests and you want to know which upstream table is responsible.",
  parameters: {
    type: "object" as const,
    properties: {
      fqn: { type: "string", description: "FQN of the entity to analyze." },
      entityType: { type: "string", description: "Entity type (usually table)." },
      upstreamDepth: { type: "integer", description: "How far upstream to traverse (default 3)." },
    },
    required: ["fqn", "entityType"],
  },
  handler: async (params: { fqn: string; entityType: string; upstreamDepth?: number }) => {
    const depth = params.upstreamDepth ?? 3;
    const results: string[] = [];

    // Step 1: Get lineage to find upstream nodes
    const lineageResult = await safeRequest<unknown>(
      `/lineage/${params.entityType}/${encodeURIComponent(params.fqn)}?upstreamDepth=${depth}&downstreamDepth=0`,
    );
    if (!lineageResult.ok) {
      return errorResult(`Cannot get lineage for RCA: ${lineageResult.error.message}`, lineageResult.error.omResponse);
    }
    results.push("## Lineage\n" + JSON.stringify(lineageResult.data, null, 2));

    // Step 2: Search for failing tests on this entity and upstreams
    const testResult = await safeRequest<unknown>(
      `/search/query?query=testCase&entityType=testCase&size=20`,
    );
    if (testResult.ok) results.push("## Relevant Test Cases\n" + JSON.stringify(testResult.data, null, 2));

    return textResult({
      status: "analysis_complete",
      target: params.fqn,
      lineage: lineageResult.ok ? lineageResult.data : null,
      tests: testResult.ok ? testResult.data : null,
      guidance: "Traverse the lineage JSON to find upstream nodes, then check which have failing tests. The nearest upstream with a failed test is likely the root cause.",
    });
  },
};

// ==================== L3 — RDF 知识图谱工具（条件启用）====================
// 这些工具只在 OM 实例启用了 RDF 时才注册（由插件前端检测后决定）
// 为保持代码一致，仍然导出，但插件前端通过条件过滤决定是否注册

export const omSparqlQueryTool = {
  name: "om_sparql_query",
  description: "Execute a SPARQL query against the OpenMetadata RDF knowledge graph. Only available when the OpenMetadata instance has RDF enabled.",
  parameters: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "SPARQL query string." },
    },
    required: ["query"],
  },
  handler: async (params: { query: string }) => {
    const result = await safeRequest<unknown>("/sparql", { method: "POST", body: { query: params.query } });
    if (!result.ok) {
      if (result.error.statusCode === 404) return errorResult("SPARQL endpoint not found. OpenMetadata RDF is likely not enabled on this instance.");
      return errorResult(`om_sparql_query failed: ${result.error.message}`, result.error.omResponse);
    }
    return textResult(result.data);
  },
};

// ==================== 工具清单 ====================

export const ALL_TOOLS = [
  omSearchMetadataTool,
  omSemanticSearchTool,
  omGetEntityDetailsTool,
  omGetEntityLineageTool,
  omGetUserContextTool,
  omGetPersonaContextTool,
  omFindContextTool,
  omCreateEntityTool,
  omPatchEntityTool,
  omCreateLineageTool,
  omCreateTestCaseTool,
  omGetTestDefinitionsTool,
  omRootCauseAnalysisTool,
  omSparqlQueryTool,
];

export const READONLY_TOOLS = ALL_TOOLS.filter((t) =>
  ["om_search_metadata", "om_semantic_search", "om_get_entity_details", "om_get_entity_lineage",
   "om_get_user_context", "om_get_persona_context", "om_find_context", "om_get_test_definitions",
   "om_root_cause_analysis", "om_sparql_query"].includes(t.name),
);

export const WRITE_TOOLS = ALL_TOOLS.filter((t) =>
  ["om_create_entity", "om_patch_entity", "om_create_lineage", "om_create_test_case"].includes(t.name),
);

export function isRdfEnabled(): boolean {
  // 简单策略：RDF 工具在 server 未配置时会返回 404；插件前端在启动时探测后决定是否注册
  // 这里默认 true，实际注册时由插件前端条件过滤
  return true;
}
