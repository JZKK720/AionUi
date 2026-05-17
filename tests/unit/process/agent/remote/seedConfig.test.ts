/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseRemoteAgentSeedsFromEnv,
  REMOTE_AGENT_SEEDS_ENV,
} from '../../../../../src/process/agent/remote/seedConfig';

describe('parseRemoteAgentSeedsFromEnv', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    warnSpy.mockClear();
  });

  afterEach(() => {
    warnSpy.mockClear();
  });

  it('returns an empty list when no seed env is configured', () => {
    expect(parseRemoteAgentSeedsFromEnv({})).toEqual([]);
  });

  it('parses valid seeds with normalized urls and sensible auth defaults', () => {
    const seeds = parseRemoteAgentSeedsFromEnv({
      [REMOTE_AGENT_SEEDS_ENV]: JSON.stringify([
        {
          name: 'OpenClaw Gateway',
          url: 'openclaw:18789',
        },
        {
          name: 'Protected Gateway',
          url: 'wss://gateway.example.com',
          authToken: 'secret-token',
          allowInsecure: 'true',
          avatar: '🦾',
          description: 'production',
        },
      ]),
    });

    expect(seeds).toEqual([
      {
        name: 'OpenClaw Gateway',
        protocol: 'openclaw',
        url: 'ws://openclaw:18789/',
        authType: 'none',
      },
      {
        name: 'Protected Gateway',
        protocol: 'openclaw',
        url: 'wss://gateway.example.com/',
        authType: 'bearer',
        authToken: 'secret-token',
        allowInsecure: true,
        avatar: '🦾',
        description: 'production',
      },
    ]);
  });

  it('returns an empty list and warns when the env value is not valid JSON', () => {
    const seeds = parseRemoteAgentSeedsFromEnv({
      [REMOTE_AGENT_SEEDS_ENV]: '{not-json}',
    });

    expect(seeds).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('skips invalid seed entries and keeps valid ones', () => {
    const seeds = parseRemoteAgentSeedsFromEnv({
      [REMOTE_AGENT_SEEDS_ENV]: JSON.stringify([
        { name: 'Missing URL' },
        { name: 'Bad Protocol', url: 'ws://bad', protocol: 'acp' },
        { name: 'Missing Token', url: 'ws://auth', authType: 'bearer' },
        { name: 'Good Agent', url: 'ws://good', authType: 'none' },
      ]),
    });

    expect(seeds).toEqual([
      {
        name: 'Good Agent',
        protocol: 'openclaw',
        url: 'ws://good/',
        authType: 'none',
      },
    ]);
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });
});
