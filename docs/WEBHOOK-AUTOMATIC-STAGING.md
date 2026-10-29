# Automatic Webhook delivery — staging

The configured MagiBooking staging environment now runs a dedicated background worker. After the merchant authorizes an application and registers its endpoint, booking events are delivered automatically; an agent does not need to trigger each delivery. This update is not a production release.

Failed attempts retain their event ID, delivery ID, exact body and retry deadline in the cloud database. The first retry is approximately30 seconds later. Restarting the worker does not discard delayed tasks. Each attempt carries a fresh timestamp and valid raw-body signature.

Receivers must verify the signature and timestamp, persist a durable inbox keyed by event ID, then acknowledge. Delivery is at least once. If saving succeeds but the response is lost, the same event may arrive again; the example receiver accepts the duplicate without adding another inbox record. Downstream consumers must also use their own idempotency boundary before performing side effects.

To stop delivery, revoke the application's merchant grant in **Merchant → Developer access**. The worker rechecks that grant before sending: queued retries and subsequent events are cancelled when authorization is unavailable. An already authorized in-flight send drains before the revocation operation returns. The desktop demo's **Disconnect current connection** button revokes its current access token; full merchant-grant revocation is a separate action.

Staging acceptance on2026-10-29 verified a503 before saving followed by automatic success after30.273 seconds; a503 after saving followed by a worker restart and successful duplicate retry after33.506 seconds; unchanged durable inbox content; and no HTTP requests for delayed/future events after grant revocation. The original, separately authorized receiver continued delivering normally. All test appointments were cancelled and temporary grants/endpoints retired. No real payment, email or SMS was triggered.

Application registration and endpoint binding remain controlled pilot setup steps. Successful assisted setup does not prove unaided developer onboarding. Keep using synthetic customers and staging credentials.
