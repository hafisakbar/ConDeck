import { describe, expect, it } from 'vitest';
import { listLanAddresses, rankLanAddresses, scoreLanAddress } from './lan-addresses';

function info(address: string, family: 'IPv4' | 'IPv6' = 'IPv4', internal = false) {
  return { address, family, internal };
}

describe('lan address ranking', () => {
  it('puts the Wi-Fi adapter ahead of a VirtualBox host-only adapter', () => {
    const addresses = listLanAddresses(43821, {
      'VirtualBox Host-Only Network': [info('192.168.56.1')],
      'Wi-Fi': [info('192.168.1.24')],
    });

    expect(addresses[0]).toBe('http://192.168.1.24:43821');
    expect(addresses).toContain('http://192.168.56.1:43821');
  });

  it('keeps Ethernet above Hyper-V and WSL adapters', () => {
    const addresses = listLanAddresses(43821, {
      'vEthernet (Default Switch)': [info('172.21.48.1')],
      'vEthernet (WSL)': [info('172.29.240.1')],
      Ethernet: [info('10.0.0.7')],
    });

    expect(addresses[0]).toBe('http://10.0.0.7:43821');
  });

  it('skips loopback, IPv6 and link-local addresses', () => {
    const addresses = listLanAddresses(43821, {
      Loopback: [info('127.0.0.1', 'IPv4', true)],
      'Wi-Fi': [
        info('fe80::1c2b:3cff:fe4d:5e6f', 'IPv6'),
        info('169.254.12.9'),
        info('192.168.0.12'),
      ],
    });

    expect(addresses).toEqual(['http://192.168.0.12:43821']);
  });

  it('falls back to the only adapter when every adapter looks virtual', () => {
    const addresses = listLanAddresses(43821, {
      'VirtualBox Host-Only Network': [info('192.168.56.1')],
    });

    expect(addresses).toEqual(['http://192.168.56.1:43821']);
  });
});

describe('scoreLanAddress', () => {
  it('rejects link-local addresses outright', () => {
    expect(scoreLanAddress('Wi-Fi', '169.254.1.1')).toBe(Number.NEGATIVE_INFINITY);
  });

  it('prefers private ranges and wireless names', () => {
    expect(scoreLanAddress('Wi-Fi', '192.168.1.5')).toBeGreaterThan(
      scoreLanAddress('Ethernet', '192.168.1.5'),
    );
    expect(scoreLanAddress('Ethernet', '192.168.1.5')).toBeGreaterThan(
      scoreLanAddress('Ethernet', '8.8.8.8'),
    );
  });

  it('orders candidates deterministically when scores are equal', () => {
    const ranked = rankLanAddresses([
      { name: 'Ethernet', address: '10.0.0.3' },
      { name: 'Ethernet', address: '10.0.0.2' },
    ]);

    expect(ranked.map((entry) => entry.address)).toEqual(['10.0.0.3', '10.0.0.2']);
  });
});
