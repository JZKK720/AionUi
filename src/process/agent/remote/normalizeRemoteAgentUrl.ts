/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export function normalizeRemoteAgentUrl(url: string): { url: string } | { error: string } {
  try {
    const trimmed = url.trim();
    const hasScheme = /^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed);
    const raw = hasScheme ? trimmed : `ws://${trimmed}`;
    const parsed = new URL(raw);

    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return { error: `Unsupported protocol: ${parsed.protocol}` };
    }

    return { url: parsed.toString() };
  } catch {
    return { error: 'Invalid URL' };
  }
}