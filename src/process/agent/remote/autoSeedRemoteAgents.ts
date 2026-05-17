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
  updatedIds: string[];
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
    `[RemoteAgentSeed] Startup seeding complete: configured=${result.configuredCount} created=${result.createdIds.length} updated=${result.updatedIds.length} skipped=${result.skippedCount} handshakes=${handshakeSummary || 'none'}`
  );
}

function buildSeedKey(protocol: RemoteAgentProtocol, url: string): string {
  const normalizedUrl = normalizeRemoteAgentUrl(url);
  return `${protocol}:${'url' in normalizedUrl ? normalizedUrl.url : url.trim()}`;
}

function getExistingSeedKeys(agents: RemoteAgentConfig[]): Set<string> {
  return new Set(agents.map((agent) => buildSeedKey(agent.protocol, agent.url)));
}

function getExistingAgentsBySeedKey(agents: RemoteAgentConfig[]): Map<string, RemoteAgentConfig> {
  return new Map(agents.map((agent) => [buildSeedKey(agent.protocol, agent.url), agent]));
}

function buildSeedUpdates(
  existingAgent: RemoteAgentConfig,
  seed: RemoteAgentInput
): Partial<{
  name: string;
  auth_type: string;
  auth_token: string;
  allow_insecure: number;
  avatar: string;
  description: string;
}> {
  const updates: Partial<{
    name: string;
    auth_type: string;
    auth_token: string;
    allow_insecure: number;
    avatar: string;
    description: string;
  }> = {};

  if (existingAgent.name !== seed.name) {
    updates.name = seed.name;
  }

  if (existingAgent.authType !== seed.authType) {
    updates.auth_type = seed.authType;
  }

  if (seed.authToken && existingAgent.authToken !== seed.authToken) {
    updates.auth_token = seed.authToken;
  }

  if (typeof seed.allowInsecure === 'boolean' && existingAgent.allowInsecure !== seed.allowInsecure) {
    updates.allow_insecure = seed.allowInsecure ? 1 : 0;
  }

  if (seed.avatar && existingAgent.avatar !== seed.avatar) {
    updates.avatar = seed.avatar;
  }

  if (seed.description && existingAgent.description !== seed.description) {
    updates.description = seed.description;
  }

  return updates;
}

export async function autoSeedRemoteAgents(env: NodeJS.ProcessEnv = process.env): Promise<AutoSeedRemoteAgentsResult> {
  const seeds = parseRemoteAgentSeedsFromEnv(env);
  const result: AutoSeedRemoteAgentsResult = {
    configuredCount: seeds.length,
    createdIds: [],
    updatedIds: [],
    skippedCount: 0,
    handshakeResults: {},
  };

  if (seeds.length === 0) {
    return result;
  }

  const db = await getDatabase();
  const existingAgents = db.getRemoteAgents();
  const existingKeys = getExistingSeedKeys(existingAgents);
  const existingAgentsByKey = getExistingAgentsBySeedKey(existingAgents);
  const processedSeedKeys = new Set<string>();

  for (const seed of seeds) {
    const seedKey = buildSeedKey(seed.protocol, seed.url);
    if (processedSeedKeys.has(seedKey)) {
      result.skippedCount += 1;
      continue;
    }
    processedSeedKeys.add(seedKey);

    const existingAgent = existingAgentsByKey.get(seedKey);
    if (existingAgent) {
      const updates = buildSeedUpdates(existingAgent, seed);
      if (Object.keys(updates).length === 0) {
        result.skippedCount += 1;
        continue;
      }

      const updateResult = db.updateRemoteAgent(existingAgent.id, updates);
      if (!updateResult.success) {
        console.warn(
          `[RemoteAgentSeed] Failed to update seed "${seed.name}" (${seed.url}): ${updateResult.error ?? 'unknown error'}`
        );
        result.skippedCount += 1;
        continue;
      }

      result.updatedIds.push(existingAgent.id);
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

  for (const agentId of [...result.createdIds, ...result.updatedIds]) {
    result.handshakeResults[agentId] = await handshakeRemoteAgent(db, agentId);
  }

  logAutoSeedSummary(result);

  return result;
}
