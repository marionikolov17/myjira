export interface ISchemaManager {
  recreateSchema(schema: string): Promise<void>;
  truncateSchema(schema: string): Promise<void>;
  dropSchema(schema: string): Promise<void>;
}
