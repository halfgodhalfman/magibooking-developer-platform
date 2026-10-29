# Connect your AI assistant to MagiBooking

**Controlled staging preview. Test data only. No production access or live billing is enabled by this kit.**

MagiBooking provides booking tools for agents through OAuth-authorized remote MCP and a REST API. Your model does not receive database, payment-provider or administrator credentials. Each merchant approves a store and scopes, and may revoke the grant. This guide defaults to staging; the separate [production profile](PRODUCTION-CONNECTION.md) must be selected explicitly and used only after the cloud production release is verified.

## Endpoints

| Purpose | Exact staging URL |
| --- | --- |
| Remote MCP (Streamable HTTP) | https://staging.magibooking.com/api/developer/mcp/ |
| REST resource audience | https://staging.magibooking.com/api/developer/v1/ |
| Authorization metadata | https://staging.magibooking.com/.well-known/oauth-authorization-server/ |
| MCP resource metadata | https://staging.magibooking.com/.well-known/oauth-protected-resource/api/developer/mcp/ |
| Manage or revoke grants | https://staging.magibooking.com/merchant/developer/ |
| Sandbox and API plans | https://staging.magibooking.com/merchant/developer/start/ |

Keep the trailing slash in both resource identifiers. MCP tokens cannot call REST; REST tokens cannot call MCP. Pilot access tokens expire within one hour and have no refresh token. Reconnect after expiry. The application must be preregistered; there is no dynamic client registration or automatic paid entitlement.

## 1. Prepare your sandbox and application

1. Sign in to the staging merchant console and create a sandbox through **Sandbox & API plans**. Use only synthetic customer information.
2. Create an application with a recognizable name through **Set up access**. Creating an application alone does not register OAuth.
3. During this controlled pilot, give the operator your application ID and request registration of `http://127.0.0.1/callback`, public-client authentication (`none`), S256 PKCE, and the scopes `catalog:read availability:read appointments:read`. The callback port may vary; the IP, path and query must match. A client's displayed callback may have a suffix; preregister that exact path instead of a wildcard. No client secret is required.
4. Merchant-store access, partner enrollment where applicable, and an eligible sandbox allowance must still be active. Registration does not bypass them.

The operator registration step is still manual. This is not yet universal one-click installation.

## 2. Connect once with the local OAuth helper

Requires Node.js 22+. Run commands from the extracted source-kit root. Create a private directory outside your repository first. Replace every placeholder; do not paste tokens or model API keys into chat.

```sh
export MAGI_AI_CLIENT_ID='YOUR_PREREGISTERED_APPLICATION_ID'
export MAGI_AI_TOKEN_FILE='/YOUR_PRIVATE_DIRECTORY/mcp.private.json'
node examples/ai-clients/oauth.mjs mcp
```

Open the printed authorization URL yourself, sign in, choose your sandbox store and approve only the read scopes. The helper listens on literal `127.0.0.1`, validates state and issuer, exchanges the one-time code using S256 PKCE and saves an owned mode-600 file. It refuses to overwrite an existing file. Never publish this file, put it in a web page or add it to a shared MCP configuration.

To check the remote protocol without paying for a model call:

```sh
npm ci --ignore-scripts --prefix packages/mcp
node examples/ai-clients/probe.mjs
```

The probe lists tools and reads services. This verifies the MCP connection, not compatibility with any particular AI product.

## 3A. Claude Code: use the source stdio bridge

Install the official MCP SDK using the command above. Copy `examples/ai-clients/claude-stdio.example.json` into the appropriate Claude Code MCP configuration, replacing its two absolute path placeholders. Alternatively, add a local stdio server with the same command, arguments and environment using Claude Code's MCP settings. Keep the token file local and outside the repository; its contents never belong in the configuration. Reconnect with the helper after token expiry, then restart/reconnect the MCP server.

Open `/mcp`, enable `magibooking-staging`, and ask: “List services and staff in my authorized sandbox store. Do not change anything.” The bridge advertises only the tools allowed by the current merchant grant. A read-only helper grant does not enable booking writes.

Native remote HTTP OAuth is **not claimed as verified**. Current Claude Code documentation uses a `localhost` callback in some versions; MagiBooking accepts only registered literal loopback IP callbacks. Use the bridge until a specific native-client version and redirect URI have passed acceptance. Do not weaken callback validation or register wildcard redirects to work around this.

Official configuration reference: https://code.claude.com/docs/en/mcp

## 3B. An agent using OpenAI Responses API

Use the MCP credential from step 2. Configure `OPENAI_API_KEY` privately in your terminal or secret manager, and set `OPENAI_MODEL` to a model in your account that supports remote MCP.

```sh
export OPENAI_MODEL='YOUR_AVAILABLE_MCP_CAPABLE_MODEL'
node examples/ai-clients/openai.mjs --allow-provider-data
```

**Data disclosure:** running this sends the short-lived MCP access token to OpenAI so its servers can call MagiBooking, and sends sandbox catalog/staff tool results to the model. Use a dedicated read-only test grant. The explicit flag acknowledges this flow; it does not authorize appointment changes. Model usage can incur charges under your own model-provider account.

The example uses `store:false`, restricts `allowed_tools` to `list_services` and `list_staff`, and permits those two read calls without a second approval prompt. It does not expose write tools, print customer records, or retry failed provider requests. OAuth happens separately through step 2. This is a server-side API example, not an automatically listed ChatGPT app.

Official reference: https://developers.openai.com/api/docs/guides/tools-connectors-mcp

## 3C. An agent using DeepSeek Tool Calls

Obtain a **separate REST-audience token** with the same helper and select the same sandbox store:

```sh
export MAGI_AI_TOKEN_FILE='/YOUR_PRIVATE_DIRECTORY/api.private.json'
node examples/ai-clients/oauth.mjs api
export MAGI_AI_MERCHANT_ID='YOUR_SANDBOX_MERCHANT_ID'
export DEEPSEEK_MODEL='YOUR_AVAILABLE_TOOL_CAPABLE_MODEL'
node examples/ai-clients/deepseek.mjs --allow-provider-data
```

Configure `DEEPSEEK_API_KEY` privately before running. The application executes the tools; the model itself does not make the REST requests. **Data disclosure:** catalog/staff results are returned to DeepSeek; the MagiBooking token stays in your application. Model usage may incur provider charges.

This bounded example accepts only `list_services` and `list_staff` with empty argument objects, a maximum of four calls and four model turns. It rejects arbitrary URLs, merchant IDs, extra fields and mutation tool names. It does not automatically retry failures. Do not supply real customer data.

Official reference: https://api-docs.deepseek.com/guides/tool_calls/

## 4. Add booking writes deliberately

After the read connection works, separately request the allowed OAuth ceiling and merchant consent for `appointments:create appointments:reschedule appointments:cancel`. The first-read helper intentionally cannot obtain these scopes. Use the existing desktop pilot or your own OAuth client with the reviewed scopes; do not modify a credential file to pretend it has broader permission.

MCP tools are `list_services`, `list_staff`, `get_availability`, `get_appointment`, optionally `get_payment_status`, `create_appointment`, `reschedule_appointment`, `cancel_appointment`. Discovery is filtered by scopes and the staging write flag.

Before each write, show the customer the service, store, staff, date/time and intended change and obtain confirmation. Persist one operation key and the exact arguments **before** making the request. Reuse both after a timeout; do not invent a new key. For reschedule/cancel, pass the current quoted `updated_at` as `if_match`; on version conflict read again and ask the customer to confirm the changed proposal. Never let a model assert that a payment succeeded or change a receiving account. Payment/reminder permissions are a separate acceptance scope.

See `docs/OAUTH-MCP.md`, `openapi/cloud.openapi.json`, `examples/desktop-pilot/` and `examples/webhook-receiver/` in the source kit. Webhooks are registered separately for a specific grant; OAuth connection alone does not create an endpoint. Verify signatures and deduplicate event IDs. A durable receiver is required in addition to automatic server-side retry.

## 5. Revoke and verify

In the merchant console, choose **Authorizations**, locate the exact application/store card and select **Revoke access → Confirm revocation**. The next MCP/API call must fail, and queued/future deliveries for that grant must stop. Revocation does not cancel appointments or the store subscription.

To revoke only a helper token and remove its local credential file, run `node examples/ai-clients/revoke.mjs mcp` (or `api`) with the corresponding `MAGI_AI_TOKEN_FILE`. This token-level action does **not** stop other tokens or grant-bound Webhooks; full grant revocation is done in the merchant console. Expired credential files can be removed locally after confirming the grant state there.

## Troubleshooting and verification status

| Symptom | Next step |
| --- | --- |
| `INVALID_CLIENT` | Ask the operator to preregister this application; creating it in the console is insufficient. |
| Redirect mismatch | Check literal IP, exact path/query and actual client version. Use the local bridge for clients requiring `localhost`. |
| HTTP 401 | Check token expiry, audience and revocation. Reconnect; never substitute a REST token into MCP. |
| Subscription/allowance error | Check the selected store's active sandbox or API plan; model identity does not grant access. |
| No create/cancel tool | Read-only grant or disabled write flag; obtain separate merchant consent, not a new prompt. |
| HTTP 409/412 or timeout | Preserve the operation key/body; re-read version/availability as appropriate and do not blindly retry writes. |
| No Webhook events | Check registration, grant binding, signature handling and delivery logs; OAuth alone does not register Webhooks. |

Acceptance is recorded separately for local contract tests, live staging protocol checks and real-model/client calls. This kit does not claim a Claude Code, OpenAI or DeepSeek real-model pass until that exact client run has been performed. Source publication, platform directory listing and production enrollment are separate release steps.
