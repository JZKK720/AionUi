/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type ConnectionBehavior =
  | { status: 'hello' }
  | { status: 'connect-error'; message: string; code?: string };

const mockProbeBehaviors = vi.hoisted(() => new Map<string, ConnectionBehavior>());
const mockSyncRemoteAgentSeeds = vi.hoisted(() =>
  vi.fn(async () => ({
    configuredCount: 0,
    createdIds: [],
    updatedIds: [],
    skippedCount: 0,
    handshakeResults: {},
  }))
);

vi.mock('@process/agent/remote/autoSeedRemoteAgents', () => ({
  syncRemoteAgentSeeds: (...args: unknown[]) => mockSyncRemoteAgentSeeds(...args),
}));

vi.mock('@process/agent/openclaw/deviceIdentity', () => ({
  generateIdentity: vi.fn(() => ({
    deviceId: 'probe-device',
    publicKeyPem: 'probe-public-key',
    privateKeyPem: 'probe-private-key',
  })),
}));

vi.mock('@process/agent/openclaw/OpenClawGatewayConnection', () => ({
  OpenClawGatewayConnection: class {
    private readonly opts: Record<string, unknown>;

    constructor(opts: Record<string, unknown>) {
      this.opts = opts;
    }

    start(): void {
      const behavior = mockProbeBehaviors.get(this.opts.url as string) ?? {
        status: 'connect-error' as const,
        message: 'ECONNREFUSED',
      };

      queueMicrotask(() => {
        if (behavior.status === 'hello') {
          (this.opts.onHelloOk as ((hello: unknown) => void) | undefined)?.({});
          return;
        }

        const error = new Error(behavior.message) as Error & { details?: { code?: string } };
        if (behavior.code) {
          error.details = { code: behavior.code };
        }
        (this.opts.onConnectError as ((error: Error) => void) | undefined)?.(error);
      });
    }

    stop(): void {}
  },
}));

import { autoDetectRemoteAgents } from '../../../../../../src/process/agent/remote/autoDetectRemoteAgents';

describe('autoDetectRemoteAgents', () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    infoSpy.mockClear();
    mockProbeBehaviors.clear();
    mockSyncRemoteAgentSeeds.mockResolvedValue({
      configuredCount: 0,
      createdIds: [],
      updatedIds: [],
      skippedCount: 0,
      handshakeResults: {},
    });
  });

  it('syncs compatible sibling gateways without reconciling existing rows', async () => {
    mockProbeBehaviors.set('ws://openclaw:18789/', { status: 'hello' });
    mockProbeBehaviors.set('ws://hermes-agent:8789/', {
      status: 'connect-error',
      message: 'Pairing required',
      code: 'PAIRING_REQUIRED',
    });
    mockSyncRemoteAgentSeeds.mockResolvedValueOnce({
      configuredCount: 2,
      createdIds: ['seed-openclaw'],
      updatedIds: [],
      skippedCount: 1,
      handshakeResults: {
        'seed-openclaw': { status: 'pending_approval' },
      },
    });

    const result = await autoDetectRemoteAgents();

    expect(mockSyncRemoteAgentSeeds).toHaveBeenCalledWith(
      [
        {
          name: 'OpenClaw Gateway',
          protocol: 'openclaw',
          url: 'ws://openclaw:18789/',
          authType: 'none',
        },
        {
          name: 'Hermes Agent',
          protocol: 'openclaw',
          url: 'ws://hermes-agent:8789/',
          authType: 'none',
        },
      ],
      { reconcileExisting: false }
    );
    expect(result).toEqual({
      candidateCount: 3,
      compatibleCount: 2,
      incompatibleCount: 1,
      discoveredUrls: ['ws://openclaw:18789/', 'ws://hermes-agent:8789/'],
      syncResult: {
        configuredCount: 2,
        createdIds: ['seed-openclaw'],
        updatedIds: [],
        skippedCount: 1,
        handshakeResults: {
          'seed-openclaw': { status: 'pending_approval' },
        },
      },
    });
  });

  it('falls back to host-published gateway candidates when the shared-network alias is unavailable', async () => {
    mockProbeBehaviors.set('ws://host.docker.internal:18788/', { status: 'hello' });
    mockSyncRemoteAgentSeeds.mockResolvedValueOnce({
      configuredCount: 1,
      createdIds: ['seed-openclaw'],
      updatedIds: [],
      skippedCount: 0,
      handshakeResults: {
        'seed-openclaw': { status: 'ok' },
      },
    });

    const result = await autoDetectRemoteAgents();

    expect(mockSyncRemoteAgentSeeds).toHaveBeenCalledWith(
      [
        {
          name: 'OpenClaw Gateway',
          protocol: 'openclaw',
          url: 'ws://host.docker.internal:18788/',
          authType: 'none',
        },
      ],
      { reconcileExisting: false }
    );
    expect(result.discoveredUrls).toEqual(['ws://host.docker.internal:18788/']);
  });

  it('returns an empty sync result when no compatible gateways are found', async () => {
    const result = await autoDetectRemoteAgents();

    expect(mockSyncRemoteAgentSeeds).not.toHaveBeenCalled();
    expect(result).toEqual({
      candidateCount: 3,
      compatibleCount: 0,
      incompatibleCount: 3,
      discoveredUrls: [],
      syncResult: {
        configuredCount: 0,
        createdIds: [],
        updatedIds: [],
        skippedCount: 0,
        handshakeResults: {},
      },
    });
  });
});