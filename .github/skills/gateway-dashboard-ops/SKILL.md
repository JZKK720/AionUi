---
name: gateway-dashboard-ops
description: 'Operate and troubleshoot AionUi AgentOS/WebUI gateway and Guid dashboard. Use when users ask about localhost:3308, /guid, WebUI mode, dashboard or gateway behavior, adding Ollama or LM Studio local models through a custom platform or local API endpoint, selected model not responding on the Guid page, or adding remote agents and services such as OpenClaw, Hermes, or IronClaw.'
argument-hint: 'Describe whether you are diagnosing WebUI access, local model setup, Guid-page model routing, or remote-agent onboarding.'
user-invocable: true
---

# Gateway Dashboard Ops

Use this skill for operator-facing AionUi questions around the AgentOS/WebUI dashboard and Guid page.

## Current Repo Reality

- The repo's `compose.yaml` packages a single `agentos` service that serves the WebUI on host port `3308` by default and enables remote access. It does not define separate `openclaw`, `hermes`, or `ironclaw` containers.
- Local Ollama and LM Studio support is documented only as a Custom platform with a local API endpoint. There is no dedicated first-party Ollama adapter in this repo.
- Remote agent onboarding is implemented in-app, but Phase 1 is OpenClaw Gateway protocol only. Types mention `zeroclaw` and `acp` as future protocol slots; do not assume Hermes or IronClaw are supported unless they expose a verified compatible gateway.

## Load These Sources First

- [WebUI startup and runtime](../../../docs/guides/webui.md)
- [Main README model support statement](../../../readme.md)
- [Compose runtime entry](../../../compose.yaml)
- [Server WebUI entrypoint](../../../src/server.ts)
- [Guid page wiring](../../../src/renderer/pages/guid/GuidPage.tsx)
- [Guid model state](../../../src/renderer/pages/guid/hooks/useGuidModelSelection.ts)
- [Guid send path](../../../src/renderer/pages/guid/hooks/useGuidSend.ts)
- [Guid agent selection and remote merge](../../../src/renderer/pages/guid/hooks/useGuidAgentSelection.ts)
- [Conversation model selector for ACP agents](../../../src/renderer/components/agent/AcpModelSelector.tsx)
- [Model settings modal](../../../src/renderer/components/settings/SettingsModal/contents/ModelModalContent.tsx)
- [Add platform modal](../../../src/renderer/pages/settings/components/AddPlatformModal.tsx)
- [Conversation builder](../../../src/common/utils/buildAgentConversationParams.ts)
- [Remote agent settings UI](../../../src/renderer/pages/settings/AgentSettings/RemoteAgentManagement.tsx)
- [Remote agent requirements](../../../docs/specs/remote-agent/requirements.md)
- [Remote agent core](../../../src/process/agent/remote/RemoteAgentCore.ts)

## Split The Problem First

- `localhost:3308`, `--webui`, dashboard login, or browser access issues: start from WebUI runtime.
- Ollama or LM Studio setup questions: start from Model Settings and Custom platform configuration.
- Guid page shows one model but chat uses another, or chat does not respond after model selection: start from Guid model selection and send flow.
- OpenClaw, Hermes, IronClaw, or remote server onboarding: start from Remote Agents, then verify protocol compatibility before promising support.

## Local Models: What Is Actually Supported

- Treat local Ollama and LM Studio as model providers configured through Model Settings, not as remote agents.
- The repo documentation only claims support via a Custom platform with a local API endpoint.
- The actual config surface is [Add platform modal](../../../src/renderer/pages/settings/components/AddPlatformModal.tsx), which collects `baseUrl`, `apiKey`, and `model`, then fetches available models through `ipcBridge.mode.fetchModelList`.
- If the base URL is non-official, the modal also runs protocol detection instead of assuming a platform.
- For New API style gateways, per-model protocol is stored in `modelProtocols`; do not confuse that with remote-agent protocol support.

## Guid Page Model Routing

- Before the first message, Guid-page provider defaults are owned by [useGuidModelSelection.ts](../../../src/renderer/pages/guid/hooks/useGuidModelSelection.ts).
- Conversation creation is owned by [useGuidSend.ts](../../../src/renderer/pages/guid/hooks/useGuidSend.ts).
- Provider-based paths (`gemini`, `aionrs`) send `currentModel`.
- The ACP and remote path sends `currentModelId` from `selectedAcpModel` plus any cached config options.
- Existing conversations then switch models through [AcpModelSelector.tsx](../../../src/renderer/components/agent/AcpModelSelector.tsx), which reads model info over IPC and can call `acpConversation.setModel`.

When a user says "I selected a local model on the main page, but the chat does not use it," inspect this order:

1. Was the issue before the first message or after the conversation already existed?
2. Which agent type is selected: provider-based, ACP/custom, `openclaw-gateway`, or `remote`?
3. Did the selected model exist in Model Settings and return from `fetchModelList`?
4. Did [useGuidSend.ts](../../../src/renderer/pages/guid/hooks/useGuidSend.ts) pass the right `currentModel` or `currentModelId` into [buildAgentConversationParams.ts](../../../src/common/utils/buildAgentConversationParams.ts)?
5. If the conversation already existed, did [AcpModelSelector.tsx](../../../src/renderer/components/agent/AcpModelSelector.tsx) load or overwrite the model info via stream updates?

## Remote Agents: What Is Actually Implemented

- The user-facing entry is Settings -> Agent Settings -> Remote Agents.
- The implementation is centered on [RemoteAgentManagement.tsx](../../../src/renderer/pages/settings/AgentSettings/RemoteAgentManagement.tsx), [requirements.md](../../../docs/specs/remote-agent/requirements.md), and [RemoteAgentCore.ts](../../../src/process/agent/remote/RemoteAgentCore.ts).
- Saving an OpenClaw remote agent performs a full handshake, not just a connectivity test.
- Pairing approval is built in: the UI polls every 5 seconds for up to 5 minutes when the gateway returns a pending approval state.
- Remote device identity is generated per remote agent and stored in app data; it is not shared with local `~/.openclaw` identity.

## Compatibility Rules For External Services

- If a user names `hermes`, `ironclaw`, or another external service, verify whether that service actually exposes a compatible OpenClaw Gateway WebSocket interface.
- Do not claim support based only on type unions, specs, or future protocol placeholders.
- If the repo does not contain the service definition or protocol docs, say so and ask for the external compose file, gateway docs, or handshake format.
- Do not tell users to add Ollama under Remote Agents.
- Do not tell users to add OpenClaw, Hermes, or IronClaw under Model Settings.

## WebUI Runtime Rules

- `compose.yaml` maps host port `3308` to container port `3000` and sets remote access on.
- [src/server.ts](../../../src/server.ts) is the runtime entrypoint for WebUI mode.
- Desktop WebUI remote-access settings and Remote Agents are separate systems. Do not mix them when answering.
- If the user points to a live page like `http://localhost:3308/#/guid`, prefer a live browser check when tools are available; otherwise read [GuidPage.tsx](../../../src/renderer/pages/guid/GuidPage.tsx) and its hooks first.

## Fast Triage Checklist

1. Is the report about WebUI runtime, model configuration, Guid-page model routing, or remote-agent handshake?
2. Which selected agent type is involved?
3. Is the problem before the first message or after conversation creation?
4. For local models, is there a reachable Custom platform or local API endpoint with a fetchable model list?
5. For remote agents, does the target service expose a verified compatible OpenClaw gateway?
6. If the named services are outside this repo, ask for their stack docs before changing code or instructions.
