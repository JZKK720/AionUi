/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAutoSeedRemoteAgents = vi.hoisted(() => vi.fn(async () => undefined));
const mockInitializeRegistry = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../../../../src/process/agent/remote/autoSeedRemoteAgents', () => ({
  autoSeedRemoteAgents: (...args: unknown[]) => mockAutoSeedRemoteAgents(...args),
}));

vi.mock('../../../../src/process/agent/AgentRegistry', () => ({
  agentRegistry: {
    initialize: (...args: unknown[]) => mockInitializeRegistry(...args),
  },
}));

import { initializeDetectedAgents } from '../../../../src/process/agent/initializeDetectedAgents';

describe('initializeDetectedAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds configured remote agents before initializing the registry', async () => {
    const callOrder: string[] = [];
    mockAutoSeedRemoteAgents.mockImplementationOnce(async () => {
      callOrder.push('seed');
    });
    mockInitializeRegistry.mockImplementationOnce(async () => {
      callOrder.push('initialize');
    });

    await initializeDetectedAgents();

    expect(callOrder).toEqual(['seed', 'initialize']);
    expect(mockAutoSeedRemoteAgents).toHaveBeenCalledTimes(1);
    expect(mockInitializeRegistry).toHaveBeenCalledTimes(1);
  });

  it('propagates seeding failures to the caller', async () => {
    mockAutoSeedRemoteAgents.mockRejectedValueOnce(new Error('seed failed'));

    await expect(initializeDetectedAgents()).rejects.toThrow('seed failed');
    expect(mockInitializeRegistry).not.toHaveBeenCalled();
  });
});