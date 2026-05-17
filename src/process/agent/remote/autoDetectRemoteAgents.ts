/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateIdentity } from '@process/agent/openclaw/deviceIdentity';
import { OpenClawGatewayConnection } from '@process/agent/openclaw/OpenClawGatewayConnection';
import { syncRemoteAgentSeeds, type AutoSeedRemoteAgentsResult } from '@process/agent/remote/autoSeedRemoteAgents';
import { normalizeRemoteAgentUrl } from '@process/agent/remote/normalizeRemoteAgentUrl';
import type { RemoteAgentInput } from './types';

type KnownRemoteService = {
  id: string;
  name: string;
  urls: string[];
};

type GatewayProbeResult = {
  compatible: boolean;
  normalizedUrl: string;
  error?: string;
};

export type AutoDetectRemoteAgentsResult = {
  candidateCount: number;
  compatibleCount: number;
  incompatibleCount: number;
  discoveredUrls: string[];
  syncResult: AutoSeedRemoteAgentsResult;
};

const KNOWN_REMOTE_SERVICES: KnownRemoteService[] = [
  {
    id: 'openclaw',
    name: 'OpenClaw Gateway',
    urls: ['ws://openclaw:18789', 'ws://host.docker.internal:18788'],
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    urls: ['ws://hermes-agent:8789', 'ws://host.docker.internal:8789'],
  },
  {
    id: 'ironclaw',
    name: 'IronClaw',
    urls: ['ws://ironclaw:8080', 'ws://host.docker.internal:8281'],
  },
];

function formatHandshakeSummary(result: AutoSeedRemoteAgentsResult): string {
  return (
    Object.entries(result.handshakeResults)
      .map(([agentId, handshakeResult]) => {
        const errorSuffix = handshakeResult.error ? `:${handshakeResult.error}` : '';
        return `${agentId}=${handshakeResult.status}${errorSuffix}`;
      })
      .join(', ') || 'none'
  );
}

function isCompatibleGatewayError(error: Error & { details?: { code?: string } }): boolean {
  const code = error.details?.code;
  return code === 'AUTH_TOKEN_MISSING' || code === 'PAIRING_REQUIRED';
}

async function probeOpenClawGateway(url: string, timeoutMs = 1_000): Promise<GatewayProbeResult> {
  const normalized = normalizeRemoteAgentUrl(url);
  if ('error' in normalized) {
    return {
      compatible: false,
      normalizedUrl: url,
      error: normalized.error,
    };
  }

  return await new Promise<GatewayProbeResult>((resolve) => {
    const connection = new OpenClawGatewayConnection({
      url: normalized.url,
      deviceIdentity: generateIdentity(),
      onHelloOk: () => {
        finish({ compatible: true, normalizedUrl: normalized.url });
      },
      onConnectError: (error) => {
        const gatewayError = error as Error & { details?: { code?: string } };
        if (isCompatibleGatewayError(gatewayError)) {
          finish({ compatible: true, normalizedUrl: normalized.url });
          return;
        }

        finish({
          compatible: false,
          normalizedUrl: normalized.url,
          error: error.message,
        });
      },
      onClose: (code, reason) => {
        finish({
          compatible: false,
          normalizedUrl: normalized.url,
          error: reason ? `closed:${code}:${reason}` : `closed:${code}`,
        });
      },
      onDeviceTokenIssued: () => {},
    });

    let settled = false;
    const finish = (result: GatewayProbeResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      connection.stop();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        compatible: false,
        normalizedUrl: normalized.url,
        error: `Connection timed out (${timeoutMs}ms)`,
      });
    }, timeoutMs);

    try {
      connection.start();
    } catch (error) {
      finish({
        compatible: false,
        normalizedUrl: normalized.url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

async function findCompatibleGatewayUrl(service: KnownRemoteService): Promise<string | null> {
  for (const candidateUrl of service.urls) {
    const probe = await probeOpenClawGateway(candidateUrl);
    if (probe.compatible) {
      return probe.normalizedUrl;
    }
  }

  return null;
}

export async function autoDetectRemoteAgents(): Promise<AutoDetectRemoteAgentsResult> {
  const discoveredSeeds: RemoteAgentInput[] = [];
  const discoveredUrls: string[] = [];

  for (const service of KNOWN_REMOTE_SERVICES) {
    const compatibleUrl = await findCompatibleGatewayUrl(service);
    if (!compatibleUrl) {
      continue;
    }

    discoveredSeeds.push({
      name: service.name,
      protocol: 'openclaw',
      url: compatibleUrl,
      authType: 'none',
    });
    discoveredUrls.push(compatibleUrl);
  }

  const syncResult =
    discoveredSeeds.length > 0
      ? await syncRemoteAgentSeeds(discoveredSeeds, { reconcileExisting: false })
      : {
          configuredCount: 0,
          createdIds: [],
          updatedIds: [],
          skippedCount: 0,
          handshakeResults: {},
        };

  console.info(
    `[RemoteAgentDetect] Startup discovery complete: candidates=${KNOWN_REMOTE_SERVICES.length} compatible=${discoveredSeeds.length} incompatible=${KNOWN_REMOTE_SERVICES.length - discoveredSeeds.length} created=${syncResult.createdIds.length} updated=${syncResult.updatedIds.length} skipped=${syncResult.skippedCount} handshakes=${formatHandshakeSummary(syncResult)}`
  );

  return {
    candidateCount: KNOWN_REMOTE_SERVICES.length,
    compatibleCount: discoveredSeeds.length,
    incompatibleCount: KNOWN_REMOTE_SERVICES.length - discoveredSeeds.length,
    discoveredUrls,
    syncResult,
  };
}