/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { agentRegistry } from './AgentRegistry';
import { autoSeedRemoteAgents } from './remote/autoSeedRemoteAgents';

export async function initializeDetectedAgents(): Promise<void> {
  await autoSeedRemoteAgents();
  await agentRegistry.initialize();
}