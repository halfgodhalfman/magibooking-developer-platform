# Public release checklist

This checklist describes release gates, not a claim that production MCP, OAuth or self-service enrollment is live. Preview documentation must retain its environment labels until live readback and client acceptance pass.

## Source and packages

- [ ] Freeze a new, unused source-kit version and record the GitHub base commit, candidate tree digest and archive checksums. Never replace an existing release tag or asset with changed bytes.
- [ ] Export only reviewed SDKs, OpenAPI, client examples, documentation and MIT license. Exclude private cloud code, migrations, operations reports, credentials, receiver journals and customer records.
- [ ] Scan every reachable public-history version as well as the candidate export. Record patterns and limitations; zero known-pattern matches is not proof that every possible secret is absent.
- [ ] Run clean dependency installation, syntax checks, SDK tests, independent OpenAPI validation, TypeScript declarations and package builds from the exported candidate, not the dirty development checkout.
- [ ] Compare SDK/package versions independently. An unchanged SDK may retain its version, but changed package bytes require a new package version before a registry release.
- [ ] Run CI for the exact new GitHub commit. A green run on the previous preview does not validate the new release.
- [ ] Verify published source/archive/assets by downloading and comparing checksums. GitHub source, npm/PyPI packages and MCP Registry metadata are separate publications.

## Cloud and authorization

- [ ] Verify production backup and nonproduction restore rehearsal; pin rollback source, runtime dependencies, config and ingress before cutover.
- [ ] Compare applied migration checksums and the exact additive pending list. Do not rewrite SQL or migration history, including rolled-back records.
- [ ] Build with the production public origin and production public settings. Never promote a staging `.next` directory. Independent typechecking is mandatory when the build skips type validation.
- [ ] Check authenticated readiness against the actual candidate and after cutover. An unauthenticated HTTP401 establishes an authentication guard, not a working booking flow.
- [ ] Verify `/` defaults to `/en/`, original English/Chinese homepage content, walkthrough, industry cards/photos, merchant login/console, and separate app landing page. Check every rendered image and browser errors before and after release.
- [ ] Verify OAuth discovery, protected-resource metadata, public-client preregistration, PKCE S256, state/issuer, exact callbacks, one-time codes, token audience, expiry and grant revocation.
- [ ] Verify cross-merchant isolation, subscriptions, persistent quotas, idempotency, version conflicts, booking policy and concurrency. Agent identity alone grants no entitlement.
- [ ] Verify automatic signed Webhook delivery, failure retry, receiver deduplication, restart recovery and queued/future-send suppression after grant revocation. Match the API and worker source/encryption configuration; retain provider effects as separate controls.
- [ ] Validate payment/reminder behavior separately before advertising it as live: merchant-controlled checkout, server-confirmed payment, duplicate callbacks, quota/reservation accounting and provider retry safety.

## Client compatibility and public discovery

- [ ] Test each named client/version with a real merchant browser consent, live query, confirmed synthetic create/reschedule/cancel, signed event receipt and revocation. Label protocol fixtures and mocked model responses separately.
- [ ] Keep native callback limitations explicit. Do not advertise universal one-click installation while preregistration, literal-IP callbacks or a local bridge are required.
- [ ] Keep preview helpers pinned to staging until a reviewed production profile exists and is tested. Do not suggest editing a token file or replacing endpoint strings to obtain production access.
- [ ] Publish stable developer guide, OpenAPI, terms/privacy, support contact, price units, sandbox limits and status/incident instructions at the verified production origin.
- [ ] Prepare an MCP Registry metadata draft under a verified namespace. A hosted remote server may use remote transport metadata; npm publication is a separate optional source-bridge distribution.
- [ ] Submit metadata only after the exact remote URL, version, repository and authentication instructions are live. Read back the registry entry after submission. Listing is not automatic installation in every AI product.
- [ ] Make platform-specific submissions only after that platform's acceptance requirements pass. Do not claim official endorsement or integration merely because an API or protocol is supported.

## Commercial availability

- [ ] State that the request allowance counts business API calls, not SMS messages. State separately the software subscription, SMS credits and payment-processor fees.
- [ ] Verify live provider configuration and approved checkout terms before enabling billing. Never reuse test keys, test prices or staging Webhook secrets.
- [ ] Begin with controlled production enrollment, document operator-assisted steps and complete an independent developer pilot before general availability.

References: [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), [MCP Registry publishing](https://modelcontextprotocol.io/registry/quickstart), [remote-server metadata](https://modelcontextprotocol.io/registry/remote-servers). Check current schemas and requirements at submission time.
