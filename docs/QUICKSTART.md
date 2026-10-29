# Cloud API quickstart

This SDK is a preview. Merchant-created bearer credentials are available to approved merchants with developer entitlements. Third-party OAuth and MCP have a separate staging preview; see [OAuth/MCP](OAUTH-MCP.md). Production continues to use approved merchant-created credentials. Never use the local sandbox token against cloud services.

Obtain the merchant ID and location-specific credential in the merchant developer console. The merchant must authorize the requested scopes. API subscriptions, roles, location access and quota are checked on every request, including retries. Catalog settings are shared across the merchant; writing services/staff requires separate merchant-wide consent. Payment-rule fields additionally require `merchant:payment-rules:write`.

## JavaScript (Node 22+)

Until npm publication, use the checked-out package path. The repository contains installable package metadata but package registry publication is separate.

```js
import {MagiBooking} from '../packages/javascript/index.mjs';
const api = new MagiBooking({
  baseUrl: process.env.MAGI_API_ORIGIN,
  token: process.env.MAGI_API_TOKEN,
  merchantId: process.env.MAGI_MERCHANT_ID
});
const services = await api.services();
const staff = await api.staff();
const times = await api.availability({date:'2026-12-01',service_id:'service_id',staff_id:'staff_id'});
```

Use the merchant timezone/date and one returned `start_at`. Service/staff lists are limited to 100 and currently have no pagination. A listed employee is not necessarily associated with every service; availability rejects incompatible selections. Always present current availability and obtain customer confirmation before booking.

```js
const result = await api.createAppointment({
  service_id:'service_id', staff_id:'staff_id', start_at:'2026-12-01T15:00:00.000Z',
  new_client:{name:'Customer name',phone:'+12025550123',email:'customer@example.com'}
}, persistedOperationKey);
const current = await api.appointment(result.appointment.id);
await api.rescheduleAppointment(current.appointment.id, {
  start_at:'2026-12-02T15:00:00.000Z',staff_id:'staff_id'
}, {idempotencyKey: persistedRescheduleKey, ifMatch: JSON.stringify(current.appointment.updated_at)});
```

Keys must be 16–128 letters, digits, underscores or hyphens. Persist each key with the exact request body and `If-Match` before sending. For a timeout, retry the same operation with that key, body and version. A genuinely new operation uses a new key. Neither SDK silently retries writes. On 412, fetch current state and ask for any needed customer confirmation before issuing a new operation. Cancellation and rescheduling enforce merchant policies and cutoff times; payments can require merchant review rather than automatic cancellation/refund.

## Python (3.10+)

```sh
python3 -m pip install ./packages/python
```

```python
import os
from magibooking import MagiBooking, MagiBookingError
api = MagiBooking(os.environ['MAGI_API_TOKEN'], os.environ['MAGI_MERCHANT_ID'], os.environ['MAGI_API_ORIGIN'])
services = api.services()
appointment = api.appointment('appointment_id')
api.cancel_appointment('appointment_id', {'reason':'Customer request'},
    idempotency_key=persisted_cancel_key,
    if_match='"'+appointment['appointment']['updated_at']+'"')
```

Both SDKs expose all 16 operations in [the cloud contract](../openapi/cloud.openapi.json), including service/staff creation and update, checkout, reminders and merchant payment setup. The cloud contract annotates production versus staging-preview per operation. Do not assume preview features are in production.

## Payments and reminders (staging preview)

Paid creation queues checkout asynchronously. Poll `payments(id)` with bounded backoff and offer the returned `checkout_url` only when ready. A redirect back from checkout is not proof of payment. Trust the server's `payment_status` and signed events. An authorized `checkout(id,key)` can prepare the initial checkout; it is not a separate charge-per-call API. `paymentSetup()` returns the merchant's secure setup page; agents cannot change payout destinations.

`sendReminder(id,'email'|'sms',key)` returns an accepted effect, not delivery confirmation. Query `reminders(id)` for its status. SMS remains subject to subscription, country, consent, balance and merchant settings. This is an appointment reminder API, not arbitrary bulk messaging. Do not send reminders automatically while running examples.

SDK errors include code/status/request ID (`requestId` in JS, `request_id` in Python). Log the request ID, not credentials or customer information. Handle 403 entitlements/scopes, 409 policies/conflicts, 412 versions and 429 quota explicitly.

## Website and embed

Run `python3 -m http.server 4330 --bind 127.0.0.1` from the repository and open `/examples/website/`. Enter a real merchant's public booking slug. The button opens the merchant-controlled booking flow and payment page. No API token reaches the browser. The current website prevents cross-origin iframes; this package deliberately uses a booking-button component. Full inline booking and scoped browser sessions remain future work.

## Staging API website demo

`examples/cloud-website/` exercises the cloud API from a local server. It is separate from the public booking-button example above. Use only a staging sandbox credential with catalog, availability and appointment read/create/reschedule/cancel scopes:

```sh
export MAGI_API_ORIGIN=https://staging.magibooking.com
# Set MAGI_API_TOKEN and MAGI_MERCHANT_ID securely in your server environment.
node examples/cloud-website/server.mjs
```

Open `http://127.0.0.1:4331/`. Select a compatible service, staff member and returned available slot, then create, reschedule and cancel the synthetic booking. The demo accepts only its synthetic customer identity and never starts payments or reminders. API credentials remain on the server. A pending write retains its operation key, exact body and version across refresh; resolve an uncertain result before starting another operation. The CLI `examples/cloud-booking.mjs` queries payment status only when `MAGI_QUERY_PAYMENT_STATUS=true` and the credential has the required payment scope.

The published SDKs were exercised against staging; additions in your checkout may be newer than the published GitHub preview. See [pricing](API-PRICING.md) and [independent pilot](INDEPENDENT-PILOT.md).

## Webhooks

Configure endpoints in the merchant console. Verify the exact body bytes, signature and timestamp before parsing. Use a durable inbox keyed by event ID, acknowledge only after saving, and process asynchronously. Delivery is at least once and can be out of order. See [webhook contract](../openapi/webhooks.json) and `examples/webhook-receiver/`. JS exports `verifyMagiBookingWebhook`; Python exports `verify_webhook` (its optional `now` uses Unix seconds; JS uses milliseconds). Payment events do not contain customer data or payment credentials.

## Assisted desktop OAuth pilot

For a staging merchant who wants a browser-based test application on their own computer, see `examples/desktop-pilot/`. It supports a loopback OAuth callback with mandatory PKCE/state/issuer checks, server-only in-memory tokens and synthetic booking actions. A protected local config and a separately provisioned signed receiver are required. Application registration and endpoint binding can still require operator assistance. The configured MagiBooking staging deployment now delivers automatically through a separate durable worker; do not count assisted setup as independent self-service acceptance.
