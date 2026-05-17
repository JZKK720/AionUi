/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { agentRegistry } from '@process/agent/AgentRegistry';
import { buildRemoteAgentConfig } from '@process/agent/remote/buildRemoteAgentConfig';
import { handshakeRemoteAgent } from '@process/agent/remote/handshakeRemoteAgent';
import { normalizeRemoteAgentUrl } from '@process/agent/remote/normalizeRemoteAgentUrl';
import { getDatabase } from '@process/services/database';
import WebSocket from 'ws';

export function initRemoteAgentBridge(): void {
  ipcBridge.remoteAgent.list.provider(async () => {
    const db = await getDatabase();
    return db.getRemoteAgents();
  });

  ipcBridge.remoteAgent.get.provider(async ({ id }) => {
    const db = await getDatabase();
    return db.getRemoteAgent(id);
  });

  ipcBridge.remoteAgent.create.provider(async (input) => {
    const db = await getDatabase();
    const config = buildRemoteAgentConfig(input);
    const result = db.createRemoteAgent(config);
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to create remote agent');
    }
    // Sync AgentRegistry so getDetectedAgents() includes the new remote agent
    agentRegistry.refreshRemoteAgents().catch(() => {});
    return result.data;
  });

  ipcBridge.remoteAgent.update.provider(async ({ id, updates }) => {
    const db = await getDatabase();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.protocol !== undefined) dbUpdates.protocol = updates.protocol;
    if (updates.url !== undefined) dbUpdates.url = updates.url;
    if (updates.authType !== undefined) dbUpdates.auth_type = updates.authType;
    if (updates.authToken !== undefined) dbUpdates.auth_token = updates.authToken;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.allowInsecure !== undefined) dbUpdates.allow_insecure = updates.allowInsecure ? 1 : 0;
    const result = db.updateRemoteAgent(id, dbUpdates);
    return result.success;
  });

  ipcBridge.remoteAgent.delete.provider(async ({ id }) => {
    const db = await getDatabase();
    const result = db.deleteRemoteAgent(id);
    if (result.success) {
      // Sync AgentRegistry so deleted remote agent is removed from detection
      agentRegistry.refreshRemoteAgents().catch(() => {});
    }
    return result.success;
  });

  ipcBridge.remoteAgent.testConnection.provider(async ({ url, authType, authToken, allowInsecure }) => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      // Normalize & validate URL: prepend ws:// when no protocol is provided
      // so that bare host:port strings (e.g. "127.0.0.1:42617") work, then
      // enforce ws/wss protocol to prevent SSRF via other schemes.
      const validated = normalizeRemoteAgentUrl(url);
      if ('error' in validated) {
        resolve({ success: false, error: validated.error });
        return;
      }
      const wsUrl = validated.url;

      let settled = false;
      let ws: WebSocket | undefined;
      const headers: Record<string, string> = {};
      if (authType === 'bearer' && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const finish = (result: { success: boolean; error?: string }) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        ws?.close();
        resolve(result);
      };

      const timeout = setTimeout(() => {
        finish({ success: false, error: 'Connection timed out (10s)' });
      }, 10_000);

      try {
        ws = new WebSocket(wsUrl, {
          headers,
          handshakeTimeout: 10_000,
          rejectUnauthorized: !allowInsecure,
        });
      } catch (error) {
        finish({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      ws.on('open', () => {
        finish({ success: true });
      });

      ws.on('error', (err) => {
        finish({ success: false, error: err.message });
      });
    });
  });

  ipcBridge.remoteAgent.handshake.provider(async ({ id }) => {
    const db = await getDatabase();
    return handshakeRemoteAgent(db, id);
  });
}
