/**
 * 画布节点契约：内置节点类型、已知 metadata 字段、自动布局步长。
 *
 * 这些是**声明式编排**（ADR-0007）的输入侧常量，不含任何运行状态，所以单独成文件：
 * 工具表、编排编译、路由三处都要读它，放在启动流程里会让依赖方向倒过来。
 *
 * 注意 `NODE_SCHEMAS` 只用于在提交前拦住「类型不存在」这类一眼能看出的错误，
 * 不做严格校验：插件节点与上游新增字段都在这里之外，后端才是权威。
 */

/** 画布内置的节点类型。上游新增类型时这里会滞后，但只影响提前校验，不影响调用。 */
export const BUILTIN_NODE_TYPES: string[] = [
  "image", "text", "drawing", "script", "skill", "config",
  "video", "audio", "frame", "markdown", "svg", "html",
  "panorama", "compare", "chart", "colorgrade", "media-conversion", "batch-table",
];

export interface NodeSchema {
  fields: string[];
  description: string;
}

export const NODE_SCHEMAS: Record<string, NodeSchema> = {
  image: { fields: ["content", "storageKey", "prompt", "model", "parameters", "generationTaskId"], description: "Image generation node." },
  text: { fields: ["content", "prompt", "model"], description: "Text generation node." },
  config: { fields: ["model", "parameters", "provider"], description: "Generation configuration node. Connect to image/text/video nodes to set their model." },
  video: { fields: ["content", "storageKey", "prompt", "model", "referenceImages"], description: "Video generation node." },
  audio: { fields: ["content", "storageKey", "prompt", "model"], description: "Audio generation node." },
  script: { fields: ["shots", "title"], description: "Storyboard script node." },
  frame: { fields: ["image", "duration"], description: "Timeline frame node." },
  markdown: { fields: ["content"], description: "Markdown text node." },
  svg: { fields: ["content"], description: "SVG vector node." },
  html: { fields: ["content"], description: "HTML embed node." },
  drawing: { fields: ["content", "storageKey"], description: "Drawing canvas node." },
  skill: { fields: ["skillId", "config"], description: "Skill node." },
  panorama: { fields: ["content", "storageKey"], description: "Panorama image node." },
  compare: { fields: ["images"], description: "Image comparison node." },
  chart: { fields: ["config", "data"], description: "Chart node." },
  colorgrade: { fields: ["lut", "intensity"], description: "Color grading node." },
  "media-conversion": { fields: ["format", "input"], description: "Media format conversion node." },
  "batch-table": { fields: ["rows", "columns"], description: "Batch processing table node." },
};

/** ADR-0007：自动布局的网格尺寸。改这里只影响没给 position 的节点。 */
export const LAYOUT_STEP_X = 400;
export const LAYOUT_STEP_Y = 280;
