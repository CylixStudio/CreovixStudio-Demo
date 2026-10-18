# PRODUCTION_RELEASE_PLAN

## Wave A (this run) — bot reply cancel/defer
1. Evidence: canceled webhook + webhook_received receipts
2. Fix Demo → test → merge Main (no DEMO_BUILD)
3. Deploy Worker `cylixstudio` only (existing wrangler)
4. User types `!commands` then `!points` once each — agent does not send
5. Rollback: previous live before defer deploy (currently `ced4bc52` until defer ships; prior known good attempt `9f501420` / older `7eebe6a4`)

## Out of scope for this deploy
- Payments, auth, DNS, secrets, migrations, Demo mocks

## Waves B–D
- Demo-only investigation; no production deploy until separately approved
