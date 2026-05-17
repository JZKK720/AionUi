import { describe, expect, it } from 'vitest';
import { OpenClawGatewayConnection } from '@process/agent/openclaw/OpenClawGatewayConnection';
import { OPENCLAW_PROTOCOL_VERSION } from '@process/agent/openclaw/types';

type ConnectionWithOpts = OpenClawGatewayConnection & {
  opts: {
    minProtocol: number;
    maxProtocol: number;
  };
};

const TEST_DEVICE_IDENTITY = {
  deviceId: 'test-device-id',
  publicKeyPem: 'test-public-key',
  privateKeyPem: 'test-private-key',
};

function createConnection(
  overrides: Partial<{
    minProtocol: number;
    maxProtocol: number;
  }> = {}
): ConnectionWithOpts {
  return new OpenClawGatewayConnection({
    url: 'ws://example.com:18789',
    deviceIdentity: TEST_DEVICE_IDENTITY,
    ...overrides,
  }) as unknown as ConnectionWithOpts;
}

describe('OpenClawGatewayConnection protocol defaults', () => {
  it('should advertise the current OpenClaw protocol version by default', () => {
    const connection = createConnection();

    expect(OPENCLAW_PROTOCOL_VERSION).toBe(4);
    expect(connection.opts.minProtocol).toBe(OPENCLAW_PROTOCOL_VERSION);
    expect(connection.opts.maxProtocol).toBe(OPENCLAW_PROTOCOL_VERSION);
    expect(connection.opts.minProtocol).not.toBe(3);
  });

  it('should preserve explicit protocol overrides for compatibility probes', () => {
    const connection = createConnection({
      minProtocol: OPENCLAW_PROTOCOL_VERSION - 1,
      maxProtocol: OPENCLAW_PROTOCOL_VERSION,
    });

    expect(connection.opts.minProtocol).toBe(3);
    expect(connection.opts.maxProtocol).toBe(4);
  });
});