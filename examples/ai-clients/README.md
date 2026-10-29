# AI client source kit

Start with [Connect your AI assistant](../../docs/CONNECT-AI.md).

- `oauth.mjs`: read-only OAuth authorization-code + PKCE helper; literal loopback, state/issuer checks, private credential file.
- `claude-stdio.example.json`: source bridge configuration; no embedded tokens.
- `openai.mjs`: Responses remote MCP, only service/staff reads, explicit data-sharing flag.
- `deepseek.mjs`: bounded Tool Calls executor over the JavaScript REST SDK, service/staff reads only.
- `probe.mjs`: official SDK protocol read test; not a real-model test.
- `revoke.mjs`: revoke one helper token; full grant revocation remains in the merchant console.

These are source examples, not published registry packages. No model API key is needed for the OAuth helper or protocol probe. Provider examples require your own locally configured key and may incur provider charges. Never share keys in chat. Staging is the default. The [explicit production profile](../../docs/PRODUCTION-CONNECTION.md) must be selected separately and used only after production cloud availability is verified. Use test data for acceptance.
