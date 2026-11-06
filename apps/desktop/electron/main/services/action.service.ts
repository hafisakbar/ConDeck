import { actionRegistry, createActionEngine, type ActionPorts } from '@condeck/action-engine';
import {
  deleteButtonAction,
  getActionTarget,
  getButtonAction,
  setButtonAction,
  type ConDeckDb,
} from '@condeck/database';
import {
  actionCatalog,
  AppError,
  type ActionCatalogEntry,
  type ActionExecutionResult,
  type ActionRecord,
  type ActionType,
  type SetActionInput,
} from '@condeck/shared';

export interface ActionServiceOptions {
  db: ConDeckDb;
  ports: ActionPorts;
  timeoutMs?: number;
}

/**
 * Single entry point for everything the IPC layer needs around actions:
 * the catalog, persistence of a button's action, and execution by button id.
 */
export interface ActionService {
  catalog(): ActionCatalogEntry[];
  setAction(input: SetActionInput): ActionRecord;
  removeAction(buttonId: string): ActionType;
  execute(buttonId: string): Promise<ActionExecutionResult>;
}

export function createActionService({
  db,
  ports,
  timeoutMs,
}: ActionServiceOptions): ActionService {
  const engine = createActionEngine({ registry: actionRegistry, ports, timeoutMs });

  return {
    catalog: () => [...actionCatalog],

    setAction: (input) => setButtonAction(db, input),

    removeAction: (buttonId) => deleteButtonAction(db, buttonId),

    async execute(buttonId) {
      const target = getActionTarget(db, buttonId);

      if (!target.isEnabled) {
        throw new AppError(
          'INVALID_INPUT',
          `Button "${target.buttonLabel}" is disabled, so its action was not run.`,
        );
      }

      const action = getButtonAction(db, buttonId);
      if (!action) {
        throw new AppError(
          'NOT_FOUND',
          `Button "${target.buttonLabel}" has no action configured yet.`,
        );
      }

      return engine.execute({
        buttonId: target.buttonId,
        buttonLabel: target.buttonLabel,
        pageId: target.pageId,
        deckId: target.deckId,
        actionType: action.actionType,
        config: action.config,
      });
    },
  };
}
