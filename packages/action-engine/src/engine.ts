import {
  AppError,
  actionConfigIssue,
  type ActionExecutionResult,
  type ActionType,
  type ErrorCode,
} from '@condeck/shared';
import type { ActionContext, ActionPorts } from './ports';
import type { ActionRegistry } from './registry';

/** PRD §9 sets a 150 ms target for local work; anything slower than this is stuck. */
export const defaultActionTimeoutMs = 10_000;

export interface ExecuteActionRequest {
  buttonId: string;
  buttonLabel: string;
  pageId: string;
  deckId: string;
  actionType: ActionType;
  config: unknown;
}

export interface ActionEngineOptions {
  registry: ActionRegistry;
  ports: ActionPorts;
  timeoutMs?: number;
}

export interface ActionEngine {
  execute(request: ExecuteActionRequest): Promise<ActionExecutionResult>;
  isRunning(buttonId: string): boolean;
}

function result(
  request: ExecuteActionRequest,
  status: ActionExecutionResult['status'],
  code: ErrorCode | null,
  message: string,
  startedAt: number,
): ActionExecutionResult {
  return {
    buttonId: request.buttonId,
    actionType: request.actionType,
    status,
    code,
    message,
    durationMs: Math.max(0, Date.now() - startedAt),
  };
}

/** Fails the execution when a handler never settles. */
async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(
            new AppError(
              'ACTION_TIMEOUT',
              `The action did not finish within ${Math.round(timeoutMs / 1000)} seconds.`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Executes a button's configured action.
 *
 * Guarantees:
 * - the action type must exist in the registry;
 * - the stored configuration is validated again before it reaches a handler;
 * - one button never runs twice at the same time (PRD §5.4 concurrency rule);
 * - every attempt returns a result instead of throwing at the caller.
 */
export function createActionEngine({
  registry,
  ports,
  timeoutMs = defaultActionTimeoutMs,
}: ActionEngineOptions): ActionEngine {
  const running = new Set<string>();

  return {
    isRunning(buttonId) {
      return running.has(buttonId);
    },

    async execute(request) {
      const startedAt = Date.now();

      if (running.has(request.buttonId)) {
        return result(
          request,
          'FAILED',
          'ACTION_BUSY',
          'This button is already running. Wait for the current action to finish.',
          startedAt,
        );
      }

      const definition = registry.get(request.actionType);
      if (!definition) {
        return result(
          request,
          'FAILED',
          'INVALID_INPUT',
          `Unknown action type: ${request.actionType}.`,
          startedAt,
        );
      }

      const issue = actionConfigIssue(request.actionType, request.config);
      if (issue) {
        return result(request, 'FAILED', 'INVALID_INPUT', issue, startedAt);
      }

      const context: ActionContext = {
        buttonId: request.buttonId,
        buttonLabel: request.buttonLabel,
        pageId: request.pageId,
        deckId: request.deckId,
      };

      running.add(request.buttonId);
      try {
        const message = await withTimeout(
          definition.execute(request.config ?? {}, ports, context),
          timeoutMs,
        );
        return result(request, 'SUCCESS', null, message, startedAt);
      } catch (error) {
        if (error instanceof AppError) {
          return result(request, 'FAILED', error.code, error.message, startedAt);
        }
        return result(
          request,
          'FAILED',
          'ACTION_FAILED',
          error instanceof Error ? error.message : 'The action failed.',
          startedAt,
        );
      } finally {
        running.delete(request.buttonId);
      }
    },
  };
}
