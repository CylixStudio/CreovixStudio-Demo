# PERFORMANCE_BASELINE (Demo)

Date: 2026-10-16

## Measured
- `kick-bot-reply-tests` synthetic: p50≈91ms, p95≈101ms, max≈103ms (fixture CPU-ish, not Lighthouse)
- coldParseMs≈0.3–0.4
- Production canceled webhook: wall≈3794ms, cpu≈27ms (I/O bound before Kick cancel)
- Pre-claim work on that event ≈2.4s (incoming → claim 201)

## Not measured
- Lighthouse / browser Core Web Vitals (no browser run this session)
- Full route SSR timings for marketing pages

## Notes after fix
- Target: ACK Kick <~500ms after claim; send under waitUntil
