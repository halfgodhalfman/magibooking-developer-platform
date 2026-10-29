# MagiBooking javascript

Preview client integration package, MIT licensed. See the repository cloud quickstart for authentication, release status and complete examples.

Server-side credentials only. Cloud origin must be supplied explicitly; do not assume preview endpoints are deployed to production. No automatic write retries.

Production catalog responses may omit the preview-only deposit fields and `updated_at`; read types mark them optional. Staging catalog writes return `VersionedService` / `VersionedStaff` with a required version. Obtain a current versioned response before a write; never synthesize one. Production basic BOOK_ONLY creation is distinct from the payment-required staging preview.
