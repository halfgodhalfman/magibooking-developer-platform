# Third-party OAuth and MCP — staging preview

This phase adds a dedicated authorization server to the private cloud. It does not modify the existing BookingSiteBuilder partner OAuth. Production remains unchanged.

Staging update (2026-10-28): the fixed staging endpoint now identifies third-party applications in the merchant grant list and supports RFC 8252 native loopback callbacks. This update is not deployed to production. See [desktop callback acceptance](DESKTOP-OAUTH-STAGING-20261028.md).

A developer first creates an application using their signed-in account. During the pilot, a private operator preregisters its HTTPS redirect URI(s), or a native callback such as `http://127.0.0.1/callback` or `http://[::1]/callback`, and allowed scope ceiling. HTTP is allowed only for these literal loopback IPs. For native HTTP callbacks, only the port may vary at authorization time; the literal IP, path and query must still match registration. Hostnames such as `localhost`, alternate IP spellings, fragments and credentials are rejected. HTTPS redirects still require exact matching. This is not open dynamic registration, and does not grant paid subscriptions or API entitlements. Use the assigned application ID as `client_id`; public clients use `token_endpoint_auth_method=none` and mandatory PKCE S256.

Discovery:

- `/.well-known/oauth-authorization-server/`
- `/.well-known/oauth-protected-resource/api/developer/v1/`
- `/.well-known/oauth-protected-resource/api/developer/mcp/`

Start at `/api/developer/oauth/authorize/` with `response_type=code`, client ID, exact redirect URI, state (16–512 characters), space-delimited scopes, a base64url S256 challenge, `code_challenge_method=S256`, and exact `resource`. The two supported resource identifiers are the trusted origin followed by `/api/developer/v1/` or `/api/developer/mcp/`. They are separate audiences.

The merchant signs in, chooses merchant/store, and explicitly selects permissions. No checkbox starts selected. Merchant-wide configuration scopes affect all stores and have a separate warning. Denial returns `access_denied` and state to the registered callback. On approval the callback receives a one-time code, state and issuer; clients must validate state and issuer before exchanging.

POST URL-encoded fields to `/api/developer/oauth/token/`: `grant_type=authorization_code`, client ID, code, exact redirect URI, resource and PKCE verifier. Codes last two minutes and can be consumed once, including concurrent exchanges. Exchange must use the exact redirect URI of that authorization request, including its selected loopback port; another registered port cannot redeem the code. Metadata advertises issuer-bound responses (`authorization_response_iss_parameter_supported=true`); both approval and denial callbacks include `iss`. Only hashes of codes/tokens are stored. Access tokens expire within one hour; no refresh token is issued in this pilot. Expiry requires a new authorization flow. Re-consent for the same application, merchant/store and exact permission set reuses its still-valid grant so retry keys remain stable. Revoked/expired grants are never revived, and the original grant expiry is not silently extended. TLS is required externally; HTTP loopback is allowed only for isolated tests.

The merchant may identify the application by its name and application/authorization IDs, then revoke its underlying grant in Developer access. Grant inventory includes only safe application ID, name and active state after the existing merchant-owner check; it does not expose another developer's account or credentials. Clients can POST their token and client ID to `/api/developer/oauth/revoke/`. Every tool/API call rechecks current token, client/application, merchant owner, location, subscription and entitlement. Revocation takes effect for subsequent operations; already committed operations are not rolled back. Retried booking writes use the same existing durable idempotency and location quota buckets.

MCP uses the official SDK's stateless Streamable HTTP transport. It returns protected-resource metadata in unauthenticated challenges and rejects invalid Origin headers. It exposes `list_services`, `list_staff`, `get_availability`, `get_appointment`, `get_payment_status`, then optionally `create_appointment`, `reschedule_appointment` and `cancel_appointment`. Tools are filtered by authorized scopes; writes additionally require the private staging write flag. Customer confirmation is required before mutations. Idempotency keys and quoted versions are explicit tool arguments. The agent cannot assert payment success or change payout accounts. No arbitrary server URL, SQL or message-sending tool is provided.

The optional [stdio bridge](../packages/mcp/) forwards the hosted MCP tools with an MCP-audience token. It does not bypass OAuth or implement scheduling itself. Broad client interoperability is not claimed until each target client completes a browser authorization and tool-call acceptance test.

Standards used: [OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700/), [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), [MCP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
