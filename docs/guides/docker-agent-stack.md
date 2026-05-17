# AionUi Docker Agent Stack Guide

Use this guide when AionUi WebUI runs in Docker and needs stable connections to local Ollama and external agent gateways.

## What This Repo Now Guarantees

The root [compose.yaml](../../../compose.yaml) now gives the `agentos` service:

- A stable Docker network name: `aionui-stack`
- Stable container aliases: `agentos` and `aionui`
- A `host.docker.internal` host-gateway mapping for host-published services

That means you have two stable connection modes for AionUi:

- Same Docker network: use service names such as `ollama`, `openclaw`, `hermes-agent`, and `ironclaw`
- Host-published fallback: use `host.docker.internal`

## Stable URLs To Use In AionUi

### Local Ollama Model Provider

Preferred when Ollama is on the shared Docker network:

```text
http://ollama:11434/v1
```

Fallback when Ollama only publishes to the Docker host:

```text
http://host.docker.internal:11434/v1
```

Notes:

- Add Ollama under **Settings -> Model Settings**, not under **Remote Agents**
- If the model form insists on an API key for OpenAI-compatible probing, use a non-empty placeholder such as `ollama`
- Changing the Guid page model only affects provider-based chats; Remote Agents and OpenClaw-style sessions use their own gateway backend
- If Ollama is running directly on the Docker host instead of in a container, keep using `http://host.docker.internal:11434/v1`

### Remote Agent Gateway URLs

At startup, AionUi now probes these known sibling-service aliases and host fallbacks and auto-adds any gateway that answers the OpenClaw handshake.

Use these same URLs under **Settings -> Agent Settings -> Remote Agents** when you need to add a gateway manually or repair auth.

Verified OpenClaw service-name URL on the shared Docker network:

```text
ws://openclaw:18789
```

Verified OpenClaw host-published fallback:

```text
ws://host.docker.internal:18788
```

Hermes Agent candidate gateway URL for this stack. TCP is reachable, but compatibility with AionUi's OpenClaw remote-agent flow is not yet verified:

```text
ws://hermes-agent:8789
```

IronClaw candidate gateway URL for this stack. TCP is reachable, but compatibility with AionUi's OpenClaw remote-agent flow is not yet verified:

```text
ws://ironclaw:8080
```

Host-published fallback forms:

```text
ws://host.docker.internal:8789
ws://host.docker.internal:8281
```

Do not use these UI ports in AionUi Remote Agents:

- Hermes Agent UI: `9119`
- IronClaw terminal UI: `3231`

## Important Compatibility Rule

AionUi's Remote Agents implementation is currently built around the OpenClaw gateway transport. OpenClaw should work directly and is the only sibling gateway verified end to end in this stack. Hermes Agent and IronClaw will only auto-detect or work through **Remote Agents** if those gateway ports speak the same compatible WebSocket gateway protocol.

If Hermes or IronClaw only expose their own UI or terminal surface, keep using them through their native UI or local ACP integration instead of AionUi Remote Agents.

## Shared Network Setup

If your Ollama and gateway containers run in a separate Compose project, attach that project to the same external network name used by AionUi.

Create the network once:

```bash
docker network create aionui-stack
```

Then keep AionUi on that network by starting the root compose file normally:

```bash
docker compose -f compose.yaml up -d
```

For your backend stack, merge in an overlay like [docker-agent-stack.override.example.yaml](docker-agent-stack.override.example.yaml).

Example:

```yaml
services:
  ollama:
    networks:
      default:
        aliases:
          - ollama

  openclaw:
    networks:
      default:
        aliases:
          - openclaw

  hermes-agent:
    networks:
      default:
        aliases:
          - hermes-agent

  ironclaw:
    networks:
      default:
        aliases:
          - ironclaw

networks:
  default:
    external: true
    name: aionui-stack
```

Adjust the service keys if your backend compose project uses different names. The alias names are what matter for AionUi.

For the currently validated live stack on this machine:

- `openclaw-openclaw-gateway-1` was attached with alias `openclaw`
- `hermes-gateway` was attached with alias `hermes-agent`
- `ironclaw` was attached with alias `ironclaw`

## Recommended Dashboard Configuration

### Ollama

1. Open **Settings -> Model Settings**
2. Add an OpenAI-compatible provider using `http://ollama:11434/v1`
3. If required, set API key to `ollama`
4. Pick the Ollama model on the Guid page before starting a new provider-based conversation

If Ollama is not containerized on the shared network, use `http://host.docker.internal:11434/v1` instead.

### OpenClaw

1. Start AionUi and wait for startup discovery to probe `openclaw` and the host fallback
2. Open **Settings -> Agent Settings -> Remote Agents** and confirm the auto-detected OpenClaw entry is present
3. If the gateway requires auth, update that entry with the shared token and save it to complete the pairing flow
4. If discovery did not find the gateway, add it manually with `ws://openclaw:18789` on the shared network or `ws://host.docker.internal:18788` as host fallback

### Hermes Agent and IronClaw

1. AionUi probes the documented Hermes and IronClaw candidate gateway URLs automatically at startup
2. Only endpoints that answer the OpenClaw handshake are auto-added; plain web UIs and terminal ports are ignored
3. In the current live stack, only OpenClaw has been verified end to end as a working remote-agent gateway
