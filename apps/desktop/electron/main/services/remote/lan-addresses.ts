import { networkInterfaces } from 'node:os';

export interface LanAddressInfo {
  address: string;
  family: string;
  internal: boolean;
}

export type LanInterfaceMap = Record<string, ReadonlyArray<LanAddressInfo> | undefined>;

/** Adapters that exist on the PC but are not the network a phone shares. */
const virtualAdapterPattern =
  /(virtualbox|vmware|hyper-?v|vethernet|docker|wsl|tailscale|zerotier|wireguard|openvpn|vpn|tap|tun|loopback|bluetooth|virtual)/i;
const wirelessPattern = /(wi-?fi|wlan|wireless|airport)/i;
const wiredPattern = /(ethernet|eth\d|lan)/i;

export interface LanAddressCandidate {
  name: string;
  address: string;
}

function isPrivateIpv4(address: string): boolean {
  const [first = 0, second = 0] = address.split('.').map((part) => Number(part));
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

/**
 * Higher is better. The QR code uses the best candidate, so a VirtualBox or
 * Hyper-V adapter must never outrank the Wi-Fi card the phone is connected to.
 */
export function scoreLanAddress(name: string, address: string): number {
  if (address.startsWith('169.254.')) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = isPrivateIpv4(address) ? 20 : 0;
  if (wirelessPattern.test(name)) {
    score += 40;
  } else if (wiredPattern.test(name)) {
    score += 30;
  }
  if (virtualAdapterPattern.test(name)) {
    score -= 200;
  }
  if (address.startsWith('192.168.56.')) {
    // VirtualBox's default host-only range is never the LAN.
    score -= 50;
  }
  return score;
}

export function rankLanAddresses(candidates: LanAddressCandidate[]): LanAddressCandidate[] {
  return candidates
    .map((candidate, order) => ({ candidate, order, score: scoreLanAddress(candidate.name, candidate.address) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .map((entry) => entry.candidate);
}

/**
 * Reachable IPv4 addresses for the remote server, best first. Interfaces can be
 * injected so the ordering stays testable without touching the host machine.
 */
export function listLanAddresses(port: number, interfaces: LanInterfaceMap = networkInterfaces()): string[] {
  const candidates: LanAddressCandidate[] = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const info of addresses ?? []) {
      if (info.family !== 'IPv4' || info.internal) {
        continue;
      }
      candidates.push({ name, address: info.address });
    }
  }

  return rankLanAddresses(candidates).map((candidate) => `http://${candidate.address}:${port}`);
}
