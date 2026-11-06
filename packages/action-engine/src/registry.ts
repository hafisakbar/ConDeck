import type { ActionType } from '@condeck/shared';
import type { ZodType } from 'zod';
import type { ActionContext, ActionPorts } from './ports';

/**
 * One entry in the Action Registry (TECHNICAL_SPECIFICATION.md §6).
 * A definition owns its configuration schema and its execution handler; the
 * engine refuses to run anything that is not registered here.
 */
export interface ActionDefinition {
  type: ActionType;
  configSchema: ZodType<unknown>;
  execute(config: unknown, ports: ActionPorts, context: ActionContext): Promise<string>;
}

/** Builds a definition while keeping the handler's config type inferred. */
export function defineAction<TConfig>(
  type: ActionType,
  configSchema: ZodType<TConfig>,
  handler: (config: TConfig, ports: ActionPorts, context: ActionContext) => Promise<string>,
): ActionDefinition {
  return {
    type,
    configSchema: configSchema as unknown as ZodType<unknown>,
    execute: (config, ports, context) => handler(config as TConfig, ports, context),
  };
}

export interface ActionRegistry {
  get(type: ActionType): ActionDefinition | undefined;
  has(type: ActionType): boolean;
  list(): readonly ActionDefinition[];
}

export function createActionRegistry(
  definitions: readonly ActionDefinition[],
): ActionRegistry {
  const byType = new Map<ActionType, ActionDefinition>();

  for (const definition of definitions) {
    if (byType.has(definition.type)) {
      throw new Error(`Duplicate action definition: ${definition.type}`);
    }
    byType.set(definition.type, definition);
  }

  return {
    get: (type) => byType.get(type),
    has: (type) => byType.has(type),
    list: () => [...byType.values()],
  };
}
