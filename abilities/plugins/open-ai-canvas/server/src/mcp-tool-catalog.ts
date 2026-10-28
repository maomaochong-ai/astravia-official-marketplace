/**
 * MCP 工具清单（纯数据，28 个工具）
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
export const MCP_TOOLS = [
  // --- 画布项目管理 ---
  {
    name: "list_canvas_projects",
    description: "List all canvas projects in the user's library.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
        page_size: { type: "number", description: "Items per page (default 20)" },
      },
    },
  },
  {
    name: "get_canvas_project",
    description: "Get a canvas project by ID, including its nodes, connections, and revision.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
  },
  {
    name: "create_canvas_project",
    description: "Create a new canvas project and return its id, title, revision and the browser URL to open it. Requires a captured browser session: open the canvas in a browser and log in once first. If canvas_id is omitted, a UUID is generated.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Canvas title (default: 'Untitled')" },
        canvas_id: { type: "string", description: "Optional canvas ID (UUID). If omitted, server generates one." },
      },
    },
  },
  {
    name: "delete_canvas_project",
    description: "Delete a canvas project by ID.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
  },
  // --- 节点操作 ---
  {
    name: "add_node",
    description: "Add a node to a canvas project. metadata is a free-form JSON object; call get_node_schema first to know which fields the node type expects.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        type: { type: "string", description: "Node type (e.g. image, text, config, video)" },
        title: { type: "string", description: "Node display title" },
        position: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" } },
          description: "Node position on canvas (default {x:0,y:0})",
        },
        width: { type: "number", description: "Node width in px" },
        height: { type: "number", description: "Node height in px" },
        metadata: { type: "object", description: "Node-specific metadata (call get_node_schema for the schema)" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "type"],
    },
  },
  {
    name: "update_node",
    description: "Update an existing node's fields (patch operation).",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        node_id: { type: "string", description: "Node ID to update" },
        patch: { type: "object", description: "Fields to patch (title, position, width, height, metadata, etc.)" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "node_id", "patch"],
    },
  },
  {
    name: "delete_node",
    description: "Delete a node from a canvas project.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        node_id: { type: "string", description: "Node ID to delete" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "node_id"],
    },
  },
  {
    name: "list_node_types",
    description: "List all available node types (built-in + plugin-registered).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_node_schema",
    description: "Get the metadata schema for a given node type, so you know what fields to pass to add_node.",
    inputSchema: {
      type: "object",
      properties: {
        node_type: { type: "string", description: "Node type (e.g. image, text, config)" },
      },
      required: ["node_type"],
    },
  },
  // --- 连接操作 ---
  {
    name: "connect_nodes",
    description: "Create a connection between two nodes.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        from_node_id: { type: "string", description: "Source node ID" },
        to_node_id: { type: "string", description: "Target node ID" },
        from_handle: { type: "string", description: "Source handle ID (optional)" },
        to_handle: { type: "string", description: "Target handle ID (optional)" },
        base_revision: { type: "number", description: "Expected canvas revision (optional)" },
      },
      required: ["canvas_id", "from_node_id", "to_node_id"],
    },
  },
  {
    name: "delete_connection",
    description: "Delete a connection between nodes.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        connection_id: { type: "string", description: "Connection ID to delete" },
        base_revision: { type: "number", description: "Expected canvas revision (optional)" },
      },
      required: ["canvas_id", "connection_id"],
    },
  },
  {
    name: "list_connections",
    description: "List all connections in a canvas project.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
  },
  // --- 生成与资源 ---
  {
    name: "run_generation",
    description: "Trigger a generation task on a node (image/text/video/audio). Polls until completion or timeout. Returns task_id, status, result_url and resource_id.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        node_id: { type: "string", description: "Node ID to generate from" },
        prompt: { type: "string", description: "Generation prompt" },
        timeout_seconds: { type: "number", description: "Max wait time in seconds (default 120)" },
      },
      required: ["canvas_id", "node_id", "prompt"],
    },
  },
  {
    name: "list_assets",
    description: "List assets (images/videos/audio) in the user's resource library.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by type: image, video, audio (optional)" },
        limit: { type: "number", description: "Max items (default 50)" },
      },
    },
  },
  {
    name: "get_canvas_state",
    description: "Get the full canvas state: revision, nodes, and connections. Use before write operations for conflict detection.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
  },
  // --- 批量操作 ---
  {
    name: "apply_operations",
    description: "Apply a batch of canvas operations directly. Escape hatch for advanced use cases or operation types not covered by dedicated tools.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        operations: {
          type: "array",
          description: "Array of CanvasOperation objects (create_node, patch_node, remove_node, create_connection, remove_connection, set_field, etc.)",
          items: { type: "object" },
        },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "operations"],
    },
  },
  // --- 声明式编排（ADR-0007）---
  {
    name: "apply_workflow",
    description:
      "Apply a whole workflow in ONE request: nodes + edges described declaratively, laid out automatically, validated before submit, and idempotent by node key. Use this instead of many add_node/connect_nodes calls when building a multi-step workflow. Returns the key→node_id mapping and the canvas URL. Generation does NOT run unless run is true, and even then only for nodes marked {\"run\": true}.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        base_revision: { type: "number", description: "Expected canvas revision; mismatches return revision_conflict instead of overwriting" },
        run: { type: "boolean", description: "Run generation for nodes marked {run:true} after applying (default false — generating costs money)" },
        workflow: {
          type: "object",
          description: "{ nodes: [{key, type, title?, position?, width?, height?, metadata?, depends_on?, run?}], edges: [{from, to, kind?}] }",
          properties: {
            nodes: { type: "array", items: { type: "object" } },
            edges: { type: "array", items: { type: "object" } },
          },
          required: ["nodes"],
        },
      },
      required: ["canvas_id", "workflow"],
    },
  },
  {
    name: "export_workflow",
    description:
      "Read a canvas back as the same declarative structure apply_workflow accepts, so an existing layout can be reused as a template.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
  },
  {
    name: "list_workspace_projects",
    description:
      "List the workspace-level projects (GET /api/projects) — the container a canvas can belong to, distinct from the canvas list itself.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
        page_size: { type: "number", description: "Items per page (default 50)" },
      },
    },
  },
  {
    name: "get_task",
    description:
      "Read one generation task by ID: status, progress and result URL. Use it to continue polling after run_generation times out.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID returned by run_generation" },
      },
      required: ["task_id"],
    },
  },
  // --- 技能库（ADR-0016）---
  {
    name: "list_skills",
    description:
      "List skills in the canvas skill library. Each item is a skill package (SKILL.md plus optional cards) that tells the agent how to execute one kind of creative task — short drama, ads, product visuals, story structure, shot grammar and so on. Filter with search or tag, then call get_skill for the instructions.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
        page_size: { type: "number", description: "Items per page (default 20, max 80)" },
        scope: {
          type: "string",
          enum: ["public", "mine", "created", "favorites"],
          description: "Whose skills: public catalogue (default), added to my library, created by me, or favourited",
        },
        tag: {
          type: "string",
          enum: ["drama", "ecommerce", "creative", "social", "others"],
          description: "Category filter. Any other value is silently dropped by the canvas, not an error",
        },
        sort: { type: "string", enum: ["popular", "new", "updated"], description: "Sort order (default popular)" },
        search: { type: "string", description: "Free-text search over name and description" },
      },
    },
  },
  {
    name: "get_skill",
    description:
      "Read one skill: metadata plus its SKILL.md instructions, which is the actual procedure the agent should follow. Long instructions are truncated and flagged; fetch the rest with read_skill_file.",
    inputSchema: {
      type: "object",
      properties: {
        skill_id: { type: "string", description: "Skill ID from list_skills (the database key, not the readable folder name)" },
        max_chars: { type: "number", description: "Instruction characters to return (default 20000, 0 = whole file)" },
      },
      required: ["skill_id"],
    },
  },
  {
    name: "list_skill_files",
    description:
      "List the files inside one skill package: SKILL.md, its reference cards under cards/, and any assets. Use it before read_skill_file when you do not know the path.",
    inputSchema: {
      type: "object",
      properties: {
        skill_id: { type: "string", description: "Skill ID from list_skills" },
      },
      required: ["skill_id"],
    },
  },
  {
    name: "read_skill_file",
    description:
      "Read one text file from a skill package, for example SKILL.md or cards/shot-grammar.md. Binary files come back as metadata only.",
    inputSchema: {
      type: "object",
      properties: {
        skill_id: { type: "string", description: "Skill ID from list_skills" },
        path: { type: "string", description: "Package-relative path, e.g. SKILL.md or cards/example.md" },
      },
      required: ["skill_id", "path"],
    },
  },
  {
    name: "search_skill_files",
    description:
      "Full-text search inside one skill package and get path + line + snippet hits. Use it on the large skills (dozens of cards) instead of reading every file.",
    inputSchema: {
      type: "object",
      properties: {
        skill_id: { type: "string", description: "Skill ID from list_skills" },
        query: { type: "string", description: "Search text, 1-120 characters" },
      },
      required: ["skill_id", "query"],
    },
  },
  {
    name: "list_added_skills",
    description:
      "List the skills this account has added to its own library — the set the canvas offers while working.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_skill_added",
    description:
      "Add a skill to the account library or remove it. Adding changes what the user sees in the canvas, so ask before calling it unless the user already said to.",
    inputSchema: {
      type: "object",
      properties: {
        skill_id: { type: "string", description: "Skill ID from list_skills" },
        added: { type: "boolean", description: "true to add (default), false to remove" },
      },
      required: ["skill_id"],
    },
  },
  {
    name: "list_skill_presets",
    description:
      "List scene presets: a plain-language task (e.g. a 15-second product film) mapped to the skill IDs that cover it, with a rationale. Good first call when the user describes a goal instead of naming a skill.",
    inputSchema: { type: "object", properties: {} },
  },
];

/**
 * 工具 → 展示分组的映射。
 *
 * 为什么单独一张表，不给每个工具加 group 字段：`MCP_TOOLS` 是 MCP 协议直接下发的
 * 声明，多塞一个字段就等于向所有客户端多广播一份非协议元数据。分组只服务插件视图。
 */
export const MCP_TOOL_GROUPS: Record<string, string> = {
  list_canvas_projects: "projects",
  get_canvas_project: "projects",
  create_canvas_project: "projects",
  delete_canvas_project: "projects",
  add_node: "nodes",
  update_node: "nodes",
  delete_node: "nodes",
  list_node_types: "nodes",
  get_node_schema: "nodes",
  connect_nodes: "connections",
  delete_connection: "connections",
  list_connections: "connections",
  run_generation: "generation",
  list_assets: "generation",
  get_canvas_state: "generation",
  apply_operations: "batch",
  apply_workflow: "batch",
  export_workflow: "batch",
  list_workspace_projects: "workspace",
  get_task: "workspace",
  list_skills: "skills",
  get_skill: "skills",
  list_skill_files: "skills",
  read_skill_file: "skills",
  search_skill_files: "skills",
  list_added_skills: "skills",
  set_skill_added: "skills",
  list_skill_presets: "skills",
};

// --- MCP 工具实现 ---
