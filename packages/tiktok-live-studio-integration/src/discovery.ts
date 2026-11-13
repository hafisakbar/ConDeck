import { execFile } from 'node:child_process';
import { AppError, tiktokDefaults } from '@condeck/shared';

export interface StudioProcess {
  pid: number;
  name: string;
  executablePath: string | null;
  version: string | null;
  ports: number[];
}

export interface StudioRuntime {
  running: boolean;
  appVersion: string | null;
  executablePath: string | null;
  processes: StudioProcess[];
  listeningPorts: number[];
  /** Set when discovery itself failed, so the UI can explain what to check. */
  error: string | null;
}

/**
 * Fixed PowerShell discovery script. It only reads process and TCP owner
 * information; no value from the renderer or the network is interpolated.
 */
const DISCOVERY_SCRIPT = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  "$procs = Get-CimInstance Win32_Process | Where-Object {",
  "  $_.Name -match 'TikTok.*LIVE.*Studio' -or $_.ExecutablePath -match 'TikTok LIVE Studio'",
  '}',
  '$result = @()',
  'foreach ($p in $procs) {',
  '  $ports = @()',
  '  if ($p.ProcessId) {',
  '    $ports = @(Get-NetTCPConnection -State Listen -OwningProcess $p.ProcessId | Select-Object -ExpandProperty LocalPort)',
  '  }',
  '  $version = $null',
  '  if ($p.ExecutablePath) {',
  '    $item = Get-Item -LiteralPath $p.ExecutablePath',
  '    if ($item -and $item.VersionInfo) { $version = $item.VersionInfo.ProductVersion }',
  '  }',
  '  $result += [pscustomobject]@{',
  '    pid = [int]$p.ProcessId',
  '    name = [string]$p.Name',
  '    path = [string]$p.ExecutablePath',
  '    version = [string]$version',
  '    ports = @($ports)',
  '  }',
  '}',
  '$result | ConvertTo-Json -Compress -Depth 4',
].join('\n');

export function parseDiscoveryOutput(output: string): StudioProcess[] {
  const text = output.trim();
  if (text.length === 0) {
    return [];
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new AppError('ACTION_FAILED', 'TikTok LIVE Studio discovery returned malformed data.');
  }

  const entries = Array.isArray(decoded) ? decoded : [decoded];
  const processes: StudioProcess[] = [];

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const pid = Number(record.pid);
    const name = typeof record.name === 'string' ? record.name : '';
    if (!Number.isInteger(pid) || pid <= 0 || name.length === 0) {
      continue;
    }
    const rawPorts = Array.isArray(record.ports) ? record.ports : [];
    const ports = [...new Set(rawPorts.map(Number))].filter(
      (port) => Number.isInteger(port) && port > 0 && port <= 65535,
    );
    processes.push({
      pid,
      name,
      executablePath: typeof record.path === 'string' && record.path.length > 0 ? record.path : null,
      version: typeof record.version === 'string' && record.version.length > 0 ? record.version : null,
      ports,
    });
  }

  return processes;
}

export function candidatePorts(runtime: StudioRuntime): number[] {
  const owned = runtime.processes.flatMap((process) => process.ports);
  return [...new Set([...runtime.listeningPorts, ...owned, ...tiktokDefaults.knownPorts])];
}

export type PowerShellRunner = (script: string) => Promise<string>;

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 8_000, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

export interface DiscoverOptions {
  platform?: NodeJS.Platform;
  run?: PowerShellRunner;
}

/**
 * Finds the LIVE Studio process and the ports that process actually owns.
 * The static port list is only a fallback when Windows will not report owners.
 */
export async function discoverLiveStudio(options: DiscoverOptions = {}): Promise<StudioRuntime> {
  const platform = options.platform ?? process.platform;
  if (platform !== 'win32') {
    return {
      running: false,
      appVersion: null,
      executablePath: null,
      processes: [],
      listeningPorts: [],
      error: 'TikTok LIVE Studio integration is only available on Windows.',
    };
  }

  try {
    const output = await (options.run ?? runPowerShell)(DISCOVERY_SCRIPT);
    const processes = parseDiscoveryOutput(output);
    const main = processes.find((process) => /tiktok.*live.*studio/i.test(process.name)) ?? processes[0];
    const listeningPorts = [...new Set(processes.flatMap((process) => process.ports))];

    return {
      running: processes.length > 0,
      appVersion: main?.version ?? null,
      executablePath: main?.executablePath ?? null,
      processes,
      listeningPorts,
      error: null,
    };
  } catch (error) {
    return {
      running: false,
      appVersion: null,
      executablePath: null,
      processes: [],
      listeningPorts: [],
      error: error instanceof Error ? error.message : 'TikTok LIVE Studio discovery failed.',
    };
  }
}
