/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  getRemoteAgents: vi.fn(() => []),
  createRemoteAgent: vi.fn((config: Record<string, unknown>) => ({ success: true, data: config })),
  getRemoteAgent: vi.fn(() => null),
  updateRemoteAgent: vi.fn(() => ({ success: true })),
}));

const mockBuildRemoteAgentConfig = vi.hoisted(() =>
  vi.fn((input: { name: string; protocol: string; url: string; authType: string }) => ({
    ...input,
    id: `seed-${input.name.toLowerCase().replace(/\s+/g, '-')}`,
    createdAt: 1,
    updatedAt: 1,
    status: 'unknown',
  }))
);

const mockHandshakeRemoteAgent = vi.hoisted(() => vi.fn(async () => ({ status: 'ok' as const })));

vi.mock('../../../../../src/process/services/database', () => ({
  getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock('../../../../../src/process/agent/remote/buildRemoteAgentConfig', () => ({
  buildRemoteAgentConfig: (...args: unknown[]) => mockBuildRemoteAgentConfig(...args),
}));

vi.mock('../../../../../src/process/agent/remote/handshakeRemoteAgent', () => ({
  handshakeRemoteAgent: (...args: unknown[]) => mockHandshakeRemoteAgent(...args),
}));

import { autoSeedRemoteAgents } from '../../../../../src/process/agent/remote/autoSeedRemoteAgents';

describe('autoSeedRemoteAgents', () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    infoSpy.mockClear();
    mockDb.getRemoteAgents.mockReturnValue([]);
    mockDb.createRemoteAgent.mockImplementation((config: Record<string, unknown>) => ({ success: true, data: config }));
    mockHandshakeRemoteAgent.mockResolvedValue({ status: 'ok' });
  });

  it('returns an empty result when no seeds are configured', async () => {
    await expect(autoSeedRemoteAgents({})).resolves.toEqual({
      configuredCount: 0,
      createdIds: [],
      skippedCount: 0,
      handshakeResults: {},
    });
    expect(mockDb.createRemoteAgent).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('creates and handshakes newly seeded remote agents', async () => {
    const result = await autoSeedRemoteAgents({
      AIONUI_REMOTE_AGENT_SEEDS: JSON.stringify([{ name: 'OpenClaw', url: 'openclaw:18789' }]),
    });

    expect(mockBuildRemoteAgentConfig).toHaveBeenCalledWith({
      name: 'OpenClaw',
      protocol: 'openclaw',
      url: 'ws://openclaw:18789/',
      authType: 'none',
    });
    expect(mockDb.createRemoteAgent).toHaveBeenCalledTimes(1);
    expect(mockHandshakeRemoteAgent).toHaveBeenCalledWith(mockDb, 'seed-openclaw');
    expect(result).toEqual({
      configuredCount: 1,
      createdIds: ['seed-openclaw'],
      skippedCount: 0,
      handshakeResults: {
        'seed-openclaw': { status: 'ok' },
      },
    });
  });

  it('skips existing remote agents that already match a configured protocol and url', async () => {
    mockDb.getRemoteAgents.mockReturnValue([
      {
        id: 'existing-1',
        name: 'Existing OpenClaw',
        protocol: 'openclaw',
        url: 'openclaw:18789',
        authType: 'none',
        createdAt: 0,
        updatedAt: 0,
      },
    ]);

    const result = await autoSeedRemoteAgents({
      AIONUI_REMOTE_AGENT_SEEDS: JSON.stringify([{ name: 'OpenClaw', url: 'ws://openclaw:18789/' }]),
    });

    expect(mockDb.createRemoteAgent).not.toHaveBeenCalled();
    expect(mockHandshakeRemoteAgent).not.toHaveBeenCalled();
    expect(result).toEqual({
      configuredCount: 1,
      createdIds: [],
      skippedCount: 1,
      handshakeResults: {},
    });
  });

  it('deduplicates duplicate seed entries in one startup batch', async () => {
    const result = await autoSeedRemoteAgents({
      AIONUI_REMOTE_AGENT_SEEDS: JSON.stringify([
        { name: 'OpenClaw', url: 'openclaw:18789' },
        { name: 'OpenClaw Duplicate', url: 'ws://openclaw:18789/' },
      ]),
    });

    expect(mockDb.createRemoteAgent).toHaveBeenCalledTimes(1);
    expect(mockHandshakeRemoteAgent).toHaveBeenCalledTimes(1);
    expect(result.createdIds).toEqual(['seed-openclaw']);
    expect(result.skippedCount).toBe(1);
  });

  it('counts create failures as skipped and does not handshake them', async () => {
    mockDb.createRemoteAgent.mockReturnValueOnce({ success: false, error: 'duplicate' });

    const result = await autoSeedRemoteAgents({
      AIONUI_REMOTE_AGENT_SEEDS: JSON.stringify([{ name: 'OpenClaw', url: 'openclaw:18789' }]),
    });

    expect(mockHandshakeRemoteAgent).not.toHaveBeenCalled();
    expect(result).toEqual({
      configuredCount: 1,
      createdIds: [],
      skippedCount: 1,
      handshakeResults: {},
    });
  });

  it('logs a startup summary with counts and handshake outcomes', async () => {
    mockHandshakeRemoteAgent.mockResolvedValueOnce({ status: 'pending_approval' });

    await autoSeedRemoteAgents({
      AIONUI_REMOTE_AGENT_SEEDS: JSON.stringify([{ name: 'OpenClaw', url: 'openclaw:18789' }]),
    });

    expect(infoSpy).toHaveBeenCalledWith(
      '[RemoteAgentSeed] Startup seeding complete: configured=1 created=1 skipped=0 handshakes=seed-openclaw=pending_approval'
    );
  });
});
