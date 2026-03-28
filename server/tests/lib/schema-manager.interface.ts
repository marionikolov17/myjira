export interface ISchemaManager {
  readonly schema: string;
  ensureSchema(): Promise<void>;
  getProbeTableName(): Promise<string>;
  waitForReload(probe: () => Promise<void>, maxWaitMs?: number): Promise<void>;
  truncateSchema(): Promise<void>;
  dropSchema(): Promise<void>;
}
