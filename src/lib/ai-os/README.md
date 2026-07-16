# AcademyOS — AI Operating System (Phase 11.0 Foundation)

This is the **provider-agnostic AI layer** for AcademyOS. Nothing here
executes writes, exposes secrets, or bypasses existing business logic.

## Layers

```
┌────────────────────────────────────────────────────────────────┐
│ Consumers (Owner AI Chat, Founder AI, Reports AI, etc.)        │
└────────────────────────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────────────────────┐
│ Orchestrator (future) — routes prompt + tools + memory to LLM  │
└────────────────────────────────────────────────────────────────┘
      │              │              │             │           │
      ▼              ▼              ▼             ▼           ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌────────┐  ┌────────┐
│ Provider  │  │  Tool     │  │ Context   │  │ Prompt │  │ Memory │
│ Registry  │  │ Registry  │  │ Builder   │  │ Library│  │ Store  │
└───────────┘  └───────────┘  └───────────┘  └────────┘  └────────┘
     │              │
     ▼              ▼
Lovable AI     Existing RPCs /
Gateway        server functions
```

## Rules (non-negotiable)

1. **Providers** are the ONLY code that talks to a model API. Everything
   else uses the `AIProvider` interface.
2. **Tools** are the ONLY way the model touches app data. Tools call
   existing RPCs / server functions — never raw `supabase.from(...)`.
3. **Permissions** are enforced by the tool itself using the current
   role / tenant from `AIContext`. A tool that cannot answer must return
   `{ ok: false, reason: "forbidden" }` — not throw.
4. **Writes** require `requiresConfirmation: true` on the tool and go
   through existing business-logic entry points.
5. **Secrets** (`LOVABLE_API_KEY`, provider keys) live only in
   `*.server.ts` modules. Never imported from client code.

## Files

- `providers/` — `AIProvider` interface, registry, Gemini provider.
- `tools/` — `ToolRegistry` + tool definitions grouped by domain.
- `context/` — `AIContext` shape + `buildContext()`.
- `prompts/` — reusable system prompts.
- `memory/` — conversation memory store + summarizer contract.
- `usage/` — token / cost / latency tracking.
- `safety/` — write-op confirmation contract.
- `config.ts` — model defaults, timeouts, retry, rate-limit config.

## Not in this phase

- No LLM calls are wired yet (no orchestrator, no chat route).
- No DB tables are created (usage + memory contracts are code-only for now).
- No UI.

See `phase-11.1` for the orchestrator, `phase-11.2` for the Owner AI chat UI.
