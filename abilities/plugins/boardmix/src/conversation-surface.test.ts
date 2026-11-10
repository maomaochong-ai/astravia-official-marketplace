/**
 * 会话可驱动性检查。
 *
 * 宿主的能力是现成的：技能按 `skillPaths` 全部加载，`invoke_skill` 按名字解析（不看 picker 可见性），
 * 工具按 `registerTool` 进会话。那么"会话里能不能像 boardmix 自己的 AI 那样用"，就只取决于插件侧
 * 三件事——**路由说对、工具列全、描述不互相打架**。这三件事都可以用文本断言。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// 从测试文件自身定位插件根：写死绝对路径就只能在那台机器上跑。
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SKILLS = ["boardmix", "boardmix-canvas", "boardmix-ai", "boardmix-collaboration", "boardmix-io"];

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** 工具 id 的唯一来源。 */
function toolIds(): string[] {
  const text = read("src/plugin-ids.ts");
  return [...text.matchAll(/^\t\w+: "(boardmix_\w+)"/gm)].map((match) => match[1]);
}

describe("conversation surface", () => {
  it("declares the permissions the host needs before any tool can be registered", () => {
    const plugin = JSON.parse(read("plugin.json")) as { permissions: string[] };
    expect(plugin.permissions).toContain("agent.tools.register");
    expect(plugin.permissions).toContain("agent.toolHandler.execute");
    expect(plugin.permissions).toContain("agent.skills.control");
  });

  it("lists every registered tool in the router", () => {
    const ids = toolIds();
    expect(ids.length).toBeGreaterThanOrEqual(12);
    const router = read("agent/skills/boardmix/SKILL.md");
    const missing = ids.filter((id) => !router.includes(`\`${id}\``));
    expect(missing).toEqual([]);
  });

  it("has one tool section, not a leftover duplicate heading", () => {
    const router = read("agent/skills/boardmix/SKILL.md");
    const headings = [...router.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    const toolHeadings = headings.filter((heading) => /工具|tools/i.test(heading));
    expect(toolHeadings).toHaveLength(1);
    expect(router).not.toMatch(/## The nine tools|## The six tools/);
  });

  it("never routes to a sibling skill that does not exist", () => {
    const problems: string[] = [];
    for (const skill of SKILLS) {
      const text = read(`agent/skills/${skill}/SKILL.md`);
      for (const match of text.matchAll(/`(boardmix(?:-[a-z]+)?)`/g)) {
        const name = match[1];
        if (name === "boardmix") continue;
        if (!SKILLS.includes(name)) problems.push(`${skill}: names ${name}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("states the three routes with their tools in the router, and attaches them to the composer", () => {
    const router = read("agent/skills/boardmix/SKILL.md");
    for (const tool of ["boardmix_ai_prompt", "boardmix_diagram", "boardmix_act"]) {
      expect(router, `the router never mentions ${tool}`).toContain(tool);
    }
    expect(router).toMatch(/谁生成/);

    // 没有 persona 之后，输入栏开关的 decoratePrompt 是唯一能“随这一轮”递给模型的说明。
    const action = read("src/hooks/input-action.ts");
    for (const tool of ["boardmix_ai_prompt", "boardmix_diagram", "boardmix_act"]) {
      expect(action, `the input action never mentions ${tool}`).toContain(tool);
    }
  });

  it("routes Mermaid import through the tool that does it, and does not call mindmap Mermaid", () => {
    const io = read("agent/skills/boardmix-io/SKILL.md");
    expect(io).toContain("boardmix_diagram");
    expect(io).not.toMatch(/`mindmap`/);
  });

  it("tells the model what to do next after the panel lands on an AI page", () => {
    const automation = read("src/features/boardmix-workspace/services/automation.ts");
    expect(automation).toContain("nextMoveAfter");
    expect(automation).toMatch(/ai-ppt|ai-flowchart|ai-chat/);
    expect(automation).toContain("boardmix_ai_prompt");
  });

  it("ships every reference a skill points at", () => {
    const problems: string[] = [];
    for (const skill of SKILLS) {
      const dir = `agent/skills/${skill}`;
      const files = readdirSync(join(ROOT, dir, "references"));
      for (const match of read(`${dir}/SKILL.md`).matchAll(/`references\/([\w.-]+\.md)`/g)) {
        if (!files.includes(match[1])) problems.push(`${skill} -> ${match[1]}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
