/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenClawGatewayConnection } from '@process/agent/openclaw/OpenClawGatewayConnection';
import type { RemoteAgentConfig } from './types';

type RemoteAgentDatabase = {
  getRemoteAgent(id: string): RemoteAgentConfig | null;
  updateRemoteAgent(
    id: string,
    updates: Partial<{
      device_token: string;
      status: string;
      last_connected_at: number;
    }>
  ): unknown;
};

export type RemoteAgentHandshakeResult = {
  status: 'ok' | 'pending_approval' | 'error';
  error?: string;
};

export async function handshakeRemoteAgent(
  db: RemoteAgentDatabase,
  id: string,
  timeoutMs: number = 15_000
): Promise<RemoteAgentHandshakeResult> {
  console.log('[RemoteAgent] handshake start, agentId:', id);

  const agent = db.getRemoteAgent(id);
  if (!agent) {
    console.log('[RemoteAgent] handshake abort: agent not found');
    return { status: 'error', error: 'Remote agent not found' };
  }

  if (agent.protocol !== 'openclaw') {
    return { status: 'ok' };
  }

  console.log('[RemoteAgent] handshake connecting to', agent.url, 'hasDeviceToken:', !!agent.deviceToken);

  return new Promise<RemoteAgentHandshakeResult>((resolve) => {
    let connection: OpenClawGatewayConnection | undefined;
    let settled = false;

    const settle = (result: RemoteAgentHandshakeResult) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      connection?.stop();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      settle({ status: 'error', error: `Handshake timed out (${Math.floor(timeoutMs / 1000)}s)` });
    }, timeoutMs);

    connection = new OpenClawGatewayConnection({
      url: agent.url,
      rejectUnauthorized: !agent.allowInsecure,
      token: agent.authType === 'bearer' ? agent.authToken : undefined,
      password: agent.authType === 'password' ? agent.authToken : undefined,
      deviceIdentity: agent.deviceId
        ? {
            deviceId: agent.deviceId,
            publicKeyPem: agent.devicePublicKey!,
            privateKeyPem: agent.devicePrivateKey!,
          }
        : undefined,
      deviceToken: agent.deviceToken,
      onDeviceTokenIssued: (token) => {
        db.updateRemoteAgent(id, { device_token: token });
      },
      onHelloOk: () => {
        console.log('[RemoteAgent] handshake ok, device paired');
        db.updateRemoteAgent(id, { status: 'connected', last_connected_at: Date.now() });
        settle({ status: 'ok' });
      },
      onConnectError: (error) => {
        const details = (error as Error & { details?: { recommendedNextStep?: string } }).details;
        console.log('[RemoteAgent] handshake error:', error.message, 'details:', JSON.stringify(details));
        const isPairingRequired =
          details?.recommendedNextStep === 'wait_then_retry' || /pairing.required/i.test(error.message);

        if (isPairingRequired) {
          console.log('[RemoteAgent] handshake pending approval, will poll');
          db.updateRemoteAgent(id, { status: 'pending' });
          settle({ status: 'pending_approval' });
          return;
        }

        console.log('[RemoteAgent] handshake failed:', error.message);
        db.updateRemoteAgent(id, { status: 'error' });
        settle({ status: 'error', error: error.message });
      },
      onClose: (code, reason) => {
        settle({ status: 'error', error: `Connection closed (${code}): ${reason}` });
      },
    });

    connection.start();
  });
}