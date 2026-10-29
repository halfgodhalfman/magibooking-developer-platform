# Production connection profile — prepared, not activated

The code supports an explicit production profile. This does **not** deploy cloud OAuth/MCP, preregister a client, grant store access or verify a real client. Keep the default staging profile until production deployment and its acceptance record are confirmed.

| Profile | Origin | Credential file |
| --- | --- | --- |
| `staging` (default) | `https://staging.magibooking.com` | Dedicated staging `.private.json` |
| `production` (explicit) | `https://www.magibooking.com` | Different production `.private.json` |

Only these exact HTTPS origins are accepted by the helper. The production profile never accepts staging tokens or silently switches based on file contents. A new production file must declare `environment: production`, match its issuer/resource, have read-only scopes and a valid expiry, and be an owned mode-600 regular file. Existing staging helper files remain compatible. There are separate REST and MCP audiences in each environment; no wildcard, hostname override, refresh-token assumption or client-secret requirement is introduced.

After production is live and your application/callback is preregistered, set:

```sh
export MAGI_AI_ENVIRONMENT=production
export MAGI_AI_CLIENT_ID='YOUR_PRODUCTION_PREREGISTERED_CLIENT_ID'
export MAGI_AI_TOKEN_FILE='/YOUR_PRIVATE_DIRECTORY/production-mcp.private.json'
node examples/ai-clients/oauth.mjs mcp
```

Complete merchant login and read-only consent yourself. For the source bridge, use `examples/ai-clients/claude-production.example.json`; replace its absolute path placeholders. For OpenAI, keep `MAGI_AI_ENVIRONMENT=production` when running the example with your locally configured provider key. Its explicit data-sharing flag still applies. For DeepSeek, authorize a different `api` audience file and set the intended merchant ID before calling its example. The MagiBooking token remains local to the DeepSeek executor; OpenAI remote MCP requires sending the short-lived MCP token to OpenAI. Provider charges remain separate.

Switching `MAGI_AI_ENVIRONMENT` is a deliberate selection, not a token conversion. Never edit a staging credential's origin/audience to make it look like a production credential. Production acceptance must include actual browser consent, query, scope isolation and revocation. The helper supports reads only; booking mutations require a separately approved application scope set and customer confirmation.

To return to staging, select `MAGI_AI_ENVIRONMENT=staging` and use its own token file/client ID. Revoke old grants in the corresponding environment's merchant console. A token-level revoke does not revoke the whole grant or its Webhooks.
