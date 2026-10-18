import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";

export type ServicePhase = "disabled" | "installing" | "starting" | "ready" | "stopping" | "stopped" | "failed";

export interface ServiceStatus {
  serviceId: string;
  phase: ServicePhase;
  version: string;
  installed: boolean;
  message?: string;
  /** Last stdout/stderr lines from the managed service process. */
  recentOutput: string;
}

export interface ManagedServiceApi {
  getPlatform(): Promise<{ tag: string }>;
  getStatus(serviceId: string): Promise<ServiceStatus>;
  install(serviceId: string, artifacts: Array<{ destination: string; data: string }>): Promise<ServiceStatus>;
  start(serviceId: string): Promise<ServiceStatus>;
  stop(serviceId: string): Promise<ServiceStatus>;
  request<T = unknown>(
    serviceId: string,
    request: {
      path: string;
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      responseType?: "json" | "text";
      timeoutMs?: number;
      body?: unknown;
    },
  ): Promise<{ ok: boolean; status: number; statusText: string; body: T }>;
  onStatusChange(listener: (status: ServiceStatus) => void): Disposable;
}

export type ManagedPluginContext = PluginContext & {
  services: ManagedServiceApi;
  ui: PluginContext["ui"] & {
    registerAbilityDetailSlot(input: {
      id: string;
      abilityId: string;
      component: () => unknown;
    }): Disposable;
  };
};
