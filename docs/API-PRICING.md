# API and MCP pricing

Commercial pricing approved by the project owner. This document defines the agreed prices; production charging remains disabled until its separate release approval and live billing configuration checks.

| Item | Price | Included usage |
|---|---:|---|
| Developer sandbox | Free | One isolated sandbox per account, 500 business API requests per UTC calendar month, expires after 30 days. No real payments, appointment email or SMS. |
| API / MCP plan | USD 19 per location per month | 10,000 successful business API requests per UTC calendar month, shared by applications authorized for that location. |
| API request extension | USD 5 | 10,000 additional requests for the current UTC calendar month. Requires an active API plan; unused units expire at month end. No automatic purchase or overage charging. |

## What a request means

Catalog, staff, availability, appointment creation/read/rescheduling/cancellation and other successful authorized business API operations each count as one request. For example, querying services, staff and availability, then creating one booking normally uses four requests, not one. MCP booking tools consume the same location allowance.

Failed transactions do not consume usage. A completed idempotent operation replayed with the same key/body returns its stored result without another booking or another quota debit. OAuth login/consent/token management and outbound Webhook deliveries/retries do not consume this business-request allowance. Webhook receiver hosting and end-user traffic are not included hosting services.

**10,000 requests are not 10,000 text messages.** SMS uses the merchant's separately purchased/eligible messaging balance and region/provider rules. No free SMS allocation is introduced by this API plan. Website software subscriptions, payment processor fees, and SMS charges remain separate. Payment success must come from a verified provider callback; the platform does not take a booking transaction commission under this pricing policy.

Stripe subscription renewal and the quota calendar are different: included and extension usage resets on UTC month boundaries. Buying an extension close to month end does not extend its expiry. API access requires current entitlement and an active plan; buying credits alone does not restore a cancelled or risk-blocked plan. Cancellation and eligible refunds follow the checkout terms; no new refund policy is introduced here.

## Release controls

Staging uses Stripe test-mode products/prices only. Before production, verify dedicated live price IDs and the exact USD amounts/units, monthly renewal interval, tax presentation if applicable, legal checkout copy, verified webhook signature and server-side entitlement handling. Never reuse a test price ID in live mode. No live price/product, subscription or payment is created by approving this document.

Partner pilots remain approval-based: 30-day partner approval, up to three merchants/apps; each eligible invited store may have a separate seven-day/500-request trial with no automatic conversion or charging. Merchant authorization is still required. Partner billing and multi-store volume discounts are not approved by this plan and require a separate offer.
