/**
 * visualization-bridge — 各 feature → 可视化领域类型的轻量桥接层。
 *
 * database-workspace、bi-editor 等 feature 通过相对路径直接引用 domain 层类型
 * 会打破 feature 边界；这里统一 re-export，消费方只依赖本 bridge。
 */

export type { Visualization } from "../../domain/chart-contract";
