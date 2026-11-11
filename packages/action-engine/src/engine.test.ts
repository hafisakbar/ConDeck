import { actionConfigSchemas, actionTypes, type ActionType } from '@condeck/shared';
import { describe, expect, it, vi } from 'vitest';
import { actionDefinitions, actionRegistry } from './definitions';
import { createActionEngine, type ExecuteActionRequest } from './engine';
import type { ActionContext, ActionPorts } from './ports';
import { createActionRegistry, defineAction } from './registry';

const context: ActionContext = {
  buttonId: '5f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  buttonLabel: 'Go live',
  pageId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  deckId: '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a',
};

function createPorts(overrides: Partial<ActionPorts> = {}): ActionPorts {
  return {
    obs: {
      isConnected: () => false,
      switchScene: vi.fn(async () => undefined),
      startStreaming: vi.fn(async () => undefined),
      stopStreaming: vi.fn(async () => undefined),
      startRecording: vi.fn(async () => undefined),
      stopRecording: vi.fn(async () => undefined),
      getInputMute: vi.fn(async () => false),
      setInputMute: vi.fn(async () => undefined),
    },
    system: {
      openApplication: vi.fn(async () => undefined),
      openUrl: vi.fn(async () => undefined),
    },
    navigation: {
      navigate: vi.fn(),
    },
    soundboard: {
      play: vi.fn(async () => 'Airhorn'),
    },
    ...overrides,
  };
}

function request(overrides: Partial<ExecuteActionRequest> = {}): ExecuteActionRequest {
  return {
    buttonId: context.buttonId,
    buttonLabel: context.buttonLabel,
    pageId: context.pageId,
    deckId: context.deckId,
    actionType: 'NAV_NEXT_PAGE',
    config: {},
    ...overrides,
  };
}

describe('action registry', () => {
  it('registers every action type declared in the shared contract', () => {
    expect([...actionTypes].sort()).toEqual(
      actionRegistry
        .list()
        .map((definition) => definition.type)
        .sort(),
    );
  });

  it('refuses duplicate definitions', () => {
    const definition = actionDefinitions[0];
    if (!definition) {
      throw new Error('expected at least one action definition');
    }
    expect(() => createActionRegistry([definition, definition])).toThrowError(/Duplicate/);
  });
});

describe('action engine', () => {
  it('runs a registered action through the navigation port', async () => {
    const ports = createPorts();
    const engine = createActionEngine({ registry: actionRegistry, ports });

    const result = await engine.execute(request());

    expect(result.status).toBe('SUCCESS');
    expect(result.code).toBeNull();
    expect(result.message).toContain('next page');
    expect(ports.navigation.navigate).toHaveBeenCalledWith('next', context);
  });

  it('rejects a configuration that does not match the action schema', async () => {
    const system = { openApplication: vi.fn(async () => undefined), openUrl: vi.fn(async () => undefined) };
    const engine = createActionEngine({
      registry: actionRegistry,
      ports: createPorts({ system }),
    });

    const result = await engine.execute(
      request({ actionType: 'SYSTEM_OPEN_URL', config: { url: 'javascript:alert(1)' } }),
    );

    expect(result.status).toBe('FAILED');
    expect(result.code).toBe('INVALID_INPUT');
    expect(system.openUrl).not.toHaveBeenCalled();
  });

  it('refuses action types that are not registered', async () => {
    const engine = createActionEngine({
      registry: createActionRegistry([]),
      ports: createPorts(),
    });

    const result = await engine.execute(request({ actionType: 'NAV_PREV_PAGE' }));

    expect(result.status).toBe('FAILED');
    expect(result.code).toBe('INVALID_INPUT');
  });

  it('reports an OBS action as disconnected instead of faking success', async () => {
    const obs = createPorts().obs;
    const engine = createActionEngine({
      registry: actionRegistry,
      ports: createPorts({ obs }),
    });

    const result = await engine.execute(
      request({ actionType: 'OBS_SWITCH_SCENE', config: { sceneName: 'Starting soon' } }),
    );

    expect(result.status).toBe('FAILED');
    expect(result.code).toBe('OBS_DISCONNECTED');
    expect(obs.switchScene).not.toHaveBeenCalled();
  });

  it('toggles an audio input through the OBS port when OBS is connected', async () => {
    const obs = createPorts().obs;
    obs.isConnected = () => true;
    obs.getInputMute = vi.fn(async () => true);
    const engine = createActionEngine({
      registry: actionRegistry,
      ports: createPorts({ obs }),
    });

    const result = await engine.execute(
      request({ actionType: 'OBS_TOGGLE_MUTE', config: { inputName: 'Mic/Aux' } }),
    );

    expect(result.status).toBe('SUCCESS');
    expect(obs.setInputMute).toHaveBeenCalledWith('Mic/Aux', false);
  });

  it('blocks a second run of the same button while the first is running', async () => {
    let release: (() => void) | undefined;
    const openUrl = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const engine = createActionEngine({
      registry: actionRegistry,
      ports: createPorts({
        system: { openApplication: vi.fn(async () => undefined), openUrl },
      }),
    });

    const input = request({ actionType: 'SYSTEM_OPEN_URL', config: { url: 'https://example.com' } });
    const first = engine.execute(input);
    const second = await engine.execute(input);

    expect(second.status).toBe('FAILED');
    expect(second.code).toBe('ACTION_BUSY');
    expect(openUrl).toHaveBeenCalledTimes(1);

    release?.();
    expect((await first).status).toBe('SUCCESS');
  });

  it('fails an action that never settles', async () => {
    const engine = createActionEngine({
      registry: actionRegistry,
      ports: createPorts({
        navigation: { navigate: () => new Promise<void>(() => undefined) },
      }),
      timeoutMs: 5,
    });

    const result = await engine.execute(request());

    expect(result.status).toBe('FAILED');
    expect(result.code).toBe('ACTION_TIMEOUT');
  });

  it('turns a handler error into a failed result', async () => {
    const engine = createActionEngine({
      registry: createActionRegistry([
        defineAction('NAV_PREV_PAGE', actionConfigSchemas.NAV_PREV_PAGE, async () => {
          throw new Error('renderer unavailable');
        }),
      ]),
      ports: createPorts(),
    });

    const result = await engine.execute(request({ actionType: 'NAV_PREV_PAGE' }));

    expect(result.status).toBe('FAILED');
    expect(result.code).toBe('ACTION_FAILED');
    expect(result.message).toBe('renderer unavailable');
  });

  it('keeps the button free again after an execution finishes', async () => {
    const engine = createActionEngine({ registry: actionRegistry, ports: createPorts() });

    const first = await engine.execute(request());
    const second = await engine.execute(request());

    expect(first.status).toBe('SUCCESS');
    expect(second.status).toBe('SUCCESS');
    expect(engine.isRunning(context.buttonId)).toBe(false);
  });
});

describe('action definitions', () => {
  it('covers every action type exactly once', () => {
    const types = actionDefinitions.map((definition) => definition.type as ActionType);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toHaveLength(actionTypes.length);
  });
});
