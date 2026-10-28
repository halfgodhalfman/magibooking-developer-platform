# Security

Never place merchant API tokens, webhook secrets or provider keys in browsers, repositories, URLs or screenshots. SDK credentials belong on your server. Keep each merchant/location grant separate. Do not accept a merchant ID from an untrusted browser as authorization.

The clients require HTTPS (loopback HTTP for tests only), reject redirects, validate resource IDs and require explicit idempotency keys for writes. They do not automatically retry writes. Verify Webhooks over exact bytes within the timestamp window, then durably deduplicate event IDs.

The booking component accepts only the canonical MagiBooking HTTPS public merchant route. It renders text using textContent, sends no API token, and uses noopener/noreferrer. The hosted page's existing anti-framing policy remains enabled.

Report vulnerabilities privately via the merchant support portal at https://www.magibooking.com/support/ . Do not open public issues containing credentials or customer data. If a credential is exposed, revoke it through its issuing service.

The local sandbox is a disposable loopback-only simulator and is not a production backend. Release archives must use the explicit public file allowlist; private cloud source, operational records and environment files are excluded.
