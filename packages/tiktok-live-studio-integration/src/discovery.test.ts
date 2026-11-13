import { describe, expect, it, vi } from 'vitest';
import { candidatePorts, discoverLiveStudio, parseDiscoveryOutput } from './discovery';

const studio = {
  pid: 4242,
  name: 'TikTok LIVE Studio.exe',
  path: 'C:\\Users\\me\\AppData\\Local\\TikTok LIVE Studio\\TikTok LIVE Studio.exe',
  version: '1.33.2.100',
  ports: [39728, 39728, 99999, 0],
};

describe('parseDiscoveryOutput', () => {
  it('reads a single process object', () => {
    const processes = parseDiscoveryOutput(JSON.stringify(studio));
    expect(processes).toEqual([
      {
        pid: 4242,
        name: 'TikTok LIVE Studio.exe',
        executablePath: studio.path,
        version: '1.33.2.100',
        ports: [39728],
      },
    ]);
  });

  it('reads an array and skips entries without a usable pid', () => {
    const processes = parseDiscoveryOutput(
      JSON.stringify([studio, { pid: 0, name: 'x' }, { pid: 9, name: '' }]),
    );
    expect(processes).toHaveLength(1);
  });

  it('returns an empty list for blank output', () => {
    expect(parseDiscoveryOutput('   ')).toEqual([]);
  });

  it('rejects malformed output instead of guessing', () => {
    expect(() => parseDiscoveryOutput('not json')).toThrow(/malformed/i);
  });
});

describe('candidatePorts', () => {
  it('puts process-owned and listening ports before the static fallback', () => {
    const ports = candidatePorts({
      running: true,
      appVersion: '1.33.2',
      executablePath: null,
      processes: [{ pid: 1, name: 'TikTok LIVE Studio.exe', executablePath: null, version: null, ports: [41000] }],
      listeningPorts: [42000],
      error: null,
    });
    expect(ports.slice(0, 2)).toEqual([42000, 41000]);
    expect(ports).toContain(28189);
  });
});

describe('discoverLiveStudio', () => {
  it('reports that the integration is Windows-only elsewhere', async () => {
    const runtime = await discoverLiveStudio({ platform: 'darwin' });
    expect(runtime.running).toBe(false);
    expect(runtime.error).toMatch(/Windows/);
  });

  it('uses the injected PowerShell runner and never interpolates input', async () => {
    const run = vi.fn(async (_script: string) => JSON.stringify(studio));
    const runtime = await discoverLiveStudio({ platform: 'win32', run });
    expect(runtime.running).toBe(true);
    expect(runtime.appVersion).toBe('1.33.2.100');
    expect(runtime.listeningPorts).toEqual([39728]);
    const script = run.mock.calls[0]?.[0] ?? '';
    expect(script).toContain('Get-CimInstance Win32_Process');
    expect(script).toContain('Get-NetTCPConnection');
  });

  it('turns a runner failure into a readable discovery error', async () => {
    const runtime = await discoverLiveStudio({
      platform: 'win32',
      run: async () => {
        throw new Error('powershell missing');
      },
    });
    expect(runtime.running).toBe(false);
    expect(runtime.error).toBe('powershell missing');
  });
});
