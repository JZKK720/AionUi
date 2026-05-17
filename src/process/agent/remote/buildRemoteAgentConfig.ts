/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { uuid } from '@/common/utils';
import { generateIdentity } from '@process/agent/openclaw/deviceIdentity';
import type { RemoteAgentConfig, RemoteAgentInput } from './types';

export function buildRemoteAgentConfig(input: RemoteAgentInput, now: number = Date.now()): RemoteAgentConfig {
  const device =
    input.protocol === 'openclaw'
      ? generateIdentity()
      : { deviceId: undefined, publicKeyPem: undefined, privateKeyPem: undefined };

  return {
    ...input,
    id: uuid(),
    deviceId: device.deviceId,
    devicePublicKey: device.publicKeyPem,
    devicePrivateKey: device.privateKeyPem,
    status: 'unknown',
    createdAt: now,
    updatedAt: now,
  };
}
