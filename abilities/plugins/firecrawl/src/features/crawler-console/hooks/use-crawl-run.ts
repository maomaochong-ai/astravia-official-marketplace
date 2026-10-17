import { useSyncExternalStore } from "react";
import type { CrawlRunSnapshot, CrawlRunStore } from "../services/crawl-run-store";

export function useCrawlRun(store: CrawlRunStore): CrawlRunSnapshot {
	return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
