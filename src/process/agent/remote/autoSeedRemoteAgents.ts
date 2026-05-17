/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase } from '@process/services/database';
import { buildRemoteAgentConfig } from './buildRemoteAgentConfig';
import { handshakeRemoteAgent, type RemoteAgentHandshakeResult } from './handshakeRemoteAgent';
import { normalizeRemoteAgentUrl } from './normalizeRemoteAgentUrl';
import { parseRemoteAgentSeedsFromEnv } from './seedConfig';
import type { RemoteAgentConfig, RemoteAgentInput, RemoteAgentProtocol } from './types';

export type AutoSeedRemoteAgentsResult = {
  configuredCount: number;
  createdIds: string[];
  skippedCount: number;
  handshakeResults: Record<string, RemoteAgentHandshakeResult>;
};

function logAutoSeedSummary(result: AutoSeedRemoteAgentsResult): void {
  const handshakeSummary = Object.entries(result.handshakeResults)
    .map(([agentId, handshakeResult]) => {
      const errorSuffix = handshakeResult.error ? `:${handshakeResult.error}` : '';
      return `${agentId}=${handshakeResult.status}${errorSuffix}`;
    })
    .join(', ');

  console.info(
    `[RemoteAgentSeed] Startup seeding complete: configured=${result.configuredCount} created=${result.createdIds.length} skipped=${result.skippedCount} handshakes=${handshakeSummary || 'none'}`
  );
}

function buildSeedKey(protocol: RemoteAgentProtocol, url: string): string {
  const normalizedUrl = normalizeRemoteAgentUrl(url);
  return `${protocol}:${'url' in normalizedUrl ? normalizedUrl.url : url.trim()}`;
}

function getExistingSeedKeys(agents: RemoteAgentConfig[]): Set<string> {
  return new Set(agents.map((agent) => buildSeedKey(agent.protocol, agent.url)));
}

export async function autoSeedRemoteAgents(env: NodeJS.ProcessEnv = process.env): Promise<AutoSeedRemoteAgentsResult> {
  const seeds = parseRemoteAgentSeedsFromEnv(env);
  const result: AutoSeedRemoteAgentsResult = {
    configuredCount: seeds.length,
    createdIds: [],
    skippedCount: 0,
    handshakeResults: {},
  };

  if (seeds.length === 0) {
    return result;
  }

  const db = await getDatabase();
  const existingKeys = getExistingSeedKeys(db.getRemoteAgents());

  for (const seed of seeds) {
    const seedKey = buildSeedKey(seed.protocol, seed.url);
    if (existingKeys.has(seedKey)) {
      result.skippedCount += 1;
      continue;
    }

    const config = buildRemoteAgentConfig(seed);
    const createResult = db.createRemoteAgent(config);
    if (!createResult.success || !createResult.data) {
      console.warn(
        `[RemoteAgentSeed] Failed to create seed "${seed.name}" (${seed.url}): ${createResult.error ?? 'unknown error'}`
      );
      result.skippedCount += 1;
      continue;
    }

    existingKeys.add(seedKey);
    result.createdIds.push(config.id);
  }

  for (const agentId of result.createdIds) {
    result.handshakeResults[agentId] = await handshakeRemoteAgent(db, agentId);
  }

  logAutoSeedSummary(result);

  return result;
}