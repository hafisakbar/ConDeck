import { actionRegistry, createActionEngine, type ActionPorts } from '@condeck/action-engine';
import {
  deleteButtonAction,
  getActionTarget,
  getButtonAction,
  getSound,
  setButtonAction,
  type ConDeckDb,
} from '@condeck/database';
import {
  actionCatalog,
  AppError,
  parseActionConfig,
  type ActionCatalogEntry,
  type ActionExecutionResult,
  type ActionRecord,
  type ActionType,
  type SetActionInput,
  type Sound,
  type SoundPlayMode,
} from '@condeck/shared';

export interface ActionServiceOptions {
  db: ConDeckDb;
  ports: ActionPorts;
  timeoutMs?: number;
  /** Resolves a library sound and asks the renderer to play it. */
  playSound?: (soundId: string, mode: SoundPlayMode) => Sound;
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
  playSound,
}: ActionServiceOptions): ActionService {
  const engine = createActionEngine({ registry: actionRegistry, ports, timeoutMs });

  return {
    catalog: () => [...actionCatalog],

    setAction(input) {
      if (input.actionType === 'SOUNDBOARD_PLAY') {
        const config = parseActionConfig('SOUNDBOARD_PLAY', input.config);
        if (!getSound(db, String(config.soundId))) {
          throw new AppError('NOT_FOUND', 'Choose a sound from the sound library.');
        }
      }
      return setButtonAction(db, input);
    },

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

      /*
       * Soundboard playback is a renderer concern: the main process validates the
       * file and asks the window to play it. Everything else still runs through
       * the action engine registry.
       */
      if (action.actionType === 'SOUNDBOARD_PLAY') {
        const startedAt = Date.now();
        try {
          const config = parseActionConfig('SOUNDBOARD_PLAY', action.config);
          if (!playSound) {
            throw new AppError('NOT_AVAILABLE', 'Sound playback is not available.');
          }
          const sound = playSound(String(config.soundId), config.mode as SoundPlayMode);
          return {
            buttonId: target.buttonId,
            actionType: 'SOUNDBOARD_PLAY',
            status: 'SUCCESS',
            code: null,
            message: `Playing "${sound.name}"`,
            durationMs: Date.now() - startedAt,
          };
        } catch (error) {
          if (error instanceof AppError) {
            return {
              buttonId: target.buttonId,
              actionType: 'SOUNDBOARD_PLAY',
              status: 'FAILED',
              code: error.code,
              message: error.message,
              durationMs: Date.now() - startedAt,
            };
          }
          throw error;
        }
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
