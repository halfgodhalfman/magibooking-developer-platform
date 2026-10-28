# MagiBooking Developer Platform

Booking infrastructure for AI agents and service businesses.

Add scheduling, appointment reminders, and merchant-controlled payments to your website, app, or AI agent.

This public preview contains JavaScript and Python SDKs, OpenAPI, a booking-button component, and examples. Core scheduling, merchant/customer data, authorization, subscription/quotas, messaging providers and payments run privately in MagiBooking Cloud.

**Availability:** basic cloud catalog, availability, appointment creation/read and `appointment.created` notifications are in production for approved integrations. Reschedule/cancel, merchant configuration, developer payments and reminders passed staging verification and remain preview. Third-party OAuth and MCP are available as a separately verified staging preview; self-service developer enrollment is upcoming. Package registry releases are separate from this GitHub source preview.

- [Cloud quickstart](docs/QUICKSTART.md)
- [Cloud OpenAPI](openapi/cloud.openapi.json) — per-operation release status
- [Webhook contract](openapi/webhooks.json)
- [JavaScript SDK](packages/javascript/)
- [Python SDK](packages/python/)
- [Booking-button component](packages/embed/)
- [OAuth and MCP staging preview](docs/OAUTH-MCP.md)
- [Security](SECURITY.md) · [MIT license](LICENSE)

## Run locally

Node 22+ and Python 3.10+ are required. The JS/Python clients have no runtime dependencies. The optional MCP bridge uses the official MCP SDK.

```sh
npm ci --ignore-scripts --prefix packages/mcp
npm test
npm run check
npm start
# another terminal: legacy in-memory simulation only
node examples/booking.mjs
```

The loopback sandbox uses separate paths and simplified data. It is not a cloud replica, does not send real notifications or accept payments, and resets on restart. Its SDK is exported separately as `./sandbox`; see [sandbox contract](openapi/sandbox.openapi.json). Never deploy this fixture publicly or enter real customer details.

For a website demo, run `python3 -m http.server 4330 --bind 127.0.0.1` and open `/examples/website/`. API credentials must stay on your server. The component opens the merchant's public booking page; a customer's payment success is confirmed by the cloud server, never by an agent.

Source publication does not grant cloud entitlements or bypass merchant authorization, subscription or usage limits. Merchants control the store access granted to integrations and can revoke it.
