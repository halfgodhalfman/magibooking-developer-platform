# Independent staging pilot

Use a verified invited email and claim the partner invitation. ACTIVE means partner eligibility, not merchant authorization or API billing access. Keep real customers, production keys and live payments out of this pilot.

1. Create your own free sandbox from the billing/sandbox page. Note its merchant/location and limits. The controlled pilot permits up to 3 merchants and 3 applications; store trials have separate allowances.
2. Provide an OAuth callback URL you control and a reachable HTTPS Webhook URL you control. Register the application's name and exact callback using the partner application tools. If registration needs an operator, record that assistance rather than calling the flow self-service.
3. Complete OAuth with PKCE, state validation and exact redirect matching. The sandbox merchant chooses its own location and scopes. Save credentials only on your server.
4. Run catalog and availability queries, create a synthetic appointment, read it, reschedule with the current version, and cancel. Replay the original create request with the identical key/body; it must return the same booking. Record only IDs, statuses and request IDs.
5. Verify signed raw Webhook bytes and timestamp before parsing, persist by event ID, then acknowledge. Deliberately return one 503; confirm the same event is retried. Duplicate delivery and a receiver restart must not duplicate processing; invalid signatures must be rejected.
6. Revoke the grant in the merchant console. Both SDK and OAuth requests must immediately fail. Disable the test endpoint and remove temporary credentials when finished.

Acceptance evidence must come from the developer's own application and callback/receiver. An agent-owned fixture is useful technical QA but does not complete independent human onboarding. Current first-pilot callback and Webhook URLs are still required; no additional invitation is sent by this document.

Commercial prices are defined in [API pricing](API-PRICING.md). Sandbox requests are not SMS. Production billing and real-merchant testing are a separate release step.
