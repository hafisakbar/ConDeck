/**
 * Preview-only stand-in for the Electron preload bridge.
 *
 * The production renderer talks to `window.condeck` over the IPC allowlist. This
 * file answers those calls with a fixed deck so the UI can be reviewed and
 * screenshotted in a normal browser without Electron, SQLite or OBS.
 */
(() => {
  const now = '2026-11-10T12:00:00.000Z';
  const profile = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Streaming',
    description: 'Main streaming deck',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const deck = {
    id: '22222222-2222-4222-8222-222222222222',
    profileId: profile.id,
    name: 'Main deck',
    columns: 5,
    rows: 3,
    createdAt: now,
    updatedAt: now,
  };

  const page = {
    id: '33333333-3333-4333-8333-333333333333',
    deckId: deck.id,
    name: 'Main',
    position: 0,
    createdAt: now,
    updatedAt: now,
  };

  const audioPage = {
    ...page,
    id: '33333333-3333-4333-8333-333333333334',
    name: 'Audio',
    position: 1,
  };

  const buttons = [
    ['Start Stream', 'radio', '#2b1b63', '#b79cff'],
    ['Record', 'circle', '#3a1116', '#ff6b78'],
    ['Camera', 'cast', '#122a3d', '#8fd0ff'],
    ['Mute', 'mic-off', '#132b1c', '#78e08f'],
    ['Scene 1', 'monitor', '#14213a', '#8fb8ff'],
    ['Chat', 'message-square', '#2c1533', '#e2a3f5'],
    ['Desktop', 'monitor', '#0f2a35', '#7fe3f0'],
    ['Game', 'gamepad-2', '#331026', '#ff9bd2'],
    ['Next', 'skip-forward', '#33240f', '#ffc773'],
    ['Settings', 'settings', '#1a1d24', '#d5dbe6'],
    ['Follow', 'star', '#33101d', '#ff9ab5'],
    ['Music', 'music', '#0f2b25', '#7ce8c8'],
    ['Volume +', 'volume-2', '#10203a', '#8fc0ff'],
    ['Volume −', 'volume-x', '#241236', '#c1a2ff'],
    ['Brightness', 'zap', '#1a1f27', '#e6ebf5'],
  ].map(([label, icon, backgroundColor, textColor], position) => ({
    id: `44444444-4444-4444-8444-44444444444${String(position).padStart(1, '0')}`,
    pageId: page.id,
    position,
    label,
    icon,
    backgroundColor,
    textColor,
    appearance: null,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
    action:
      position === 0 || position === 1
        ? {
            id: `55555555-5555-4555-8555-55555555555${position}`,
            buttonId: `44444444-4444-4444-8444-44444444444${String(position).padStart(1, '0')}`,
            actionType: position === 0 ? 'OBS_START_STREAMING' : 'OBS_STOP_RECORDING',
            config: {},
            createdAt: now,
            updatedAt: now,
          }
        : null,
  }));

  const catalog = [
    {
      type: 'OBS_START_STREAMING',
      label: 'Start streaming',
      description: 'Starts the stream in OBS.',
      category: 'OBS',
      requiresObs: true,
      fields: [],
    },
    {
      type: 'OBS_SWITCH_SCENE',
      label: 'Switch scene',
      description: 'Switches OBS to another scene.',
      category: 'OBS',
      requiresObs: true,
      fields: [{ key: 'sceneName', label: 'Scene', type: 'text', help: 'Scene name in OBS.', placeholder: 'Main' }],
    },
    {
      type: 'SYSTEM_OPEN_URL',
      label: 'Open URL',
      description: 'Opens a web page in the default browser.',
      category: 'SYSTEM',
      requiresObs: false,
      fields: [{ key: 'url', label: 'URL', type: 'text', help: 'http or https only.' }],
    },
  ];

  const ok = (data) => Promise.resolve({ ok: true, data });
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const bridge = {
    getDashboardSummary: () =>
      ok({
        app: { version: '0.1.0', platform: 'win32', arch: 'x64' },
        profiles: { total: 1, active: profile.name },
        decks: { total: 1 },
        pages: { total: 2 },
        buttons: { total: buttons.length },
        devices: { paired: 1, online: 1 },
        obs: { state: 'CONNECTED' },
      }),
    listProfiles: () => ok(clone([profile])),
    listDevices: () => ok([]),
    listCustomIcons: () => ok([]),
    listSounds: () => ok([]),
    listActivity: () => ok([]),
    listDecks: () => ok([{ ...clone(deck), pageCount: 2, buttonCount: buttons.length }]),
    getDeck: () => ok({ deck: clone(deck), pages: [clone({ ...page, buttons }), clone({ ...audioPage, buttons: [] })] }),
    getActionCatalog: () => ok(clone(catalog)),
    getObsSnapshot: () =>
      ok({
        state: 'CONNECTED',
        message: null,
        host: '127.0.0.1',
        port: 4455,
        isEnabled: true,
        hasPassword: false,
        sceneName: 'Main',
        scenes: ['Main', 'BRB'],
        isStreaming: true,
        isRecording: false,
        mutedInputs: { 'Mic/Aux': true },
      }),
    onNavigationRequest: () => () => {},
    onObsSnapshot: () => () => {},
  };

  window.condeck = new Proxy(bridge, {
    get(target, key) {
      if (typeof key === 'symbol' || key === 'then') {
        return undefined;
      }
      if (key in target) {
        return target[key];
      }
      return () => ok(null);
    },
  });
})();
