import { join } from 'node:path';
import { app, BrowserWindow, shell } from 'electron';

export interface MainWindowOptions {
  preloadPath: string;
  indexPath: string;
  devServerUrl?: string | undefined;
}

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:']);

/**
 * Creates the only application window with Electron security defaults enforced:
 * context isolation on, Node integration off, sandbox on, navigation restricted
 * (TECHNICAL_SPECIFICATION.md §7).
 */
export function createMainWindow({ preloadPath, indexPath, devServerUrl }: MainWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    backgroundColor: '#0a0c11',
    title: 'StreamKey',
    // Packaged builds take the icon embedded in the executable.
    icon: app.isPackaged ? undefined : join(app.getAppPath(), 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    const parsed = safeUrl(url);
    if (parsed && ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    const isDevServer = devServerUrl !== undefined && url.startsWith(devServerUrl);
    if (!isDevServer) {
      event.preventDefault();
    }
  });

  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(indexPath);
  }

  return window;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
