/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RemoteAgentAuthType, RemoteAgentInput, RemoteAgentProtocol } from './types';
import { normalizeRemoteAgentUrl } from './normalizeRemoteAgentUrl';

export const REMOTE_AGENT_SEEDS_ENV = 'AIONUI_REMOTE_AGENT_SEEDS';

const SUPPORTED_PROTOCOLS = new Set<RemoteAgentProtocol>(['openclaw']);
const SUPPORTED_AUTH_TYPES = new Set<RemoteAgentAuthType>(['none', 'bearer', 'password']);

type RawSeed = Partial<RemoteAgentInput> & {
  token?: string;
};

function parseBooleanLike(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseSeed(seed: unknown, index: number): RemoteAgentInput | null {
  if (!seed || typeof seed !== 'object' || Array.isArray(seed)) {
    console.warn(`[RemoteAgentSeed] Ignoring entry ${index}: expected an object.`);
    return null;
  }

  const rawSeed = seed as RawSeed;
  const name = normalizeOptionalString(rawSeed.name);
  const rawUrl = normalizeOptionalString(rawSeed.url);

  if (!name || !rawUrl) {
    console.warn(`[RemoteAgentSeed] Ignoring entry ${index}: name and url are required.`);
    return null;
  }

  const protocol = (normalizeOptionalString(rawSeed.protocol) ?? 'openclaw') as RemoteAgentProtocol;
  if (!SUPPORTED_PROTOCOLS.has(protocol)) {
    console.warn(`[RemoteAgentSeed] Ignoring entry ${index}: unsupported protocol "${protocol}".`);
    return null;
  }

  const normalizedUrl = normalizeRemoteAgentUrl(rawUrl);
  if ('error' in normalizedUrl) {
    console.warn(`[RemoteAgentSeed] Ignoring entry ${index}: ${normalizedUrl.error}.`);
    return null;
  }

  const authToken = normalizeOptionalString(rawSeed.authToken) ?? normalizeOptionalString(rawSeed.token);
  const authType = (normalizeOptionalString(rawSeed.authType) ??
    (authToken ? 'bearer' : 'none')) as RemoteAgentAuthType;

  if (!SUPPORTED_AUTH_TYPES.has(authType)) {
    console.warn(`[RemoteAgentSeed] Ignoring entry ${index}: unsupported auth type "${authType}".`);
    return null;
  }

  if (authType !== 'none' && !authToken) {
    console.warn(`[RemoteAgentSeed] Ignoring entry ${index}: authToken is required for authType "${authType}".`);
    return null;
  }

  const allowInsecure = parseBooleanLike(rawSeed.allowInsecure);
  const avatar = normalizeOptionalString(rawSeed.avatar);
  const description = normalizeOptionalString(rawSeed.description);

  return {
    name,
    protocol,
    url: normalizedUrl.url,
    authType,
    ...(authToken ? { authToken } : {}),
    ...(typeof allowInsecure === 'boolean' ? { allowInsecure } : {}),
    ...(avatar ? { avatar } : {}),
    ...(description ? { description } : {}),
  };
}

export function parseRemoteAgentSeedsFromEnv(env: NodeJS.ProcessEnv = process.env): RemoteAgentInput[] {
  const rawSeeds = env[REMOTE_AGENT_SEEDS_ENV]?.trim();

  if (!rawSeeds) {
    return [];
  }

  let parsedSeeds: unknown;
  try {
    parsedSeeds = JSON.parse(rawSeeds);
  } catch (error) {
    console.warn(
      `[RemoteAgentSeed] Failed to parse ${REMOTE_AGENT_SEEDS_ENV}: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }

  if (!Array.isArray(parsedSeeds)) {
    console.warn(`[RemoteAgentSeed] Ignoring ${REMOTE_AGENT_SEEDS_ENV}: expected a JSON array.`);
    return [];
  }

  return parsedSeeds
    .map((seed, index) => parseSeed(seed, index))
    .filter((seed): seed is RemoteAgentInput => seed !== null);
}
