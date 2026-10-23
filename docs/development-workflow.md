# Development workflow

Future work starts in CylixStudio-Demo. Port a change to CylixStudio (Main) only after explicit approval.

Never port Demo's no-login auth, DemoUser, or Pro unlock into Main. Never copy secrets from either project.

Keep two projects: Demo and Main. Do not create a third full copy.

Do not deploy to production, and do not apply a production database migration, without a separate approval.

## Demo administration

Open **Settings → Demo administration** to preview releases, Early Access
grant/revoke, code generation, editing, status filters, CSV export and subscription
revocation with fictional accounts. The existing real Admin check remains unchanged;
this separate sandbox never calls admin RPCs, sends emails or alters actual roles,
subscriptions or feature entitlements.

The sandbox uses the validated fixtures in `src/lib/demoAdmin.ts` and saves edits
under `cylixstudio-demo:admin:v1` in browser localStorage. The existing Demo data
export/import/reset includes this key. **Reset admin demo** resets only this section.
Invalid or unavailable storage displays an explicit error rather than reporting
successful persistence.

Run focused state tests with:

```sh
node --experimental-transform-types --test scripts/demo-admin.test.ts
```

Do not port this publicly accessible fictional sandbox to Main.

## Public Demo points store

Open `/store/demouser`, `/store/novaplays` or `/store/atlastv`. The public storefront
uses the existing channel-specific Demo catalog, loyalty members and sales tables.
Catalog/image/stock changes made in Loyalty management appear in the same channel's
store. The published slug for the personal channel is also supported.

The store starts signed out. **Sign in to demo** explicitly selects a fictional
viewer, independently of the studio's owner/moderator identity. Viewer selection is
saved under `cylixstudio-demo:store-viewer:v1`; balances and redemptions use the
existing `cylixstudio-demo:db:v1` channel overlays. Membership fixtures on other
channels have separate balances and do not fabricate watch time or levels.
There are no configured earning rules in these fixtures.

Redemption rechecks the viewer, current reward price, enabled status, balance and
stock inside a per-channel Web Lock. One localStorage write saves the updated
member, stock, sale and idempotency receipt together. Repeated confirmation of the
same request cannot charge twice. Web Locks require a modern secure-context browser
(HTTPS or localhost); unavailable storage/locking fails explicitly, without a
success message or in-memory-only purchase. Different devices and browser profiles
do not share balances or inventory. There is no real authentication, fulfillment,
bot action, payment or production API call.

The existing Demo data export/import/reset includes all storefront keys.
Run storefront state tests with:

```sh
node --experimental-transform-types --import ./scripts/register-alias.mjs --test scripts/demo-storefront.test.ts
```

### Platform-specific shop URLs

The shared public storefront uses a compact, bounded layout: a 200px viewer
sidebar on the physical left at desktop/tablet widths, a 26px sidebar gap, and
205×274px reward cards separated by 14px. The content cap allows at most five
fixed-width columns; fewer rewards never stretch. Small screens use one or two
columns, and individual cards retain RTL/LTR text direction independently of
the sidebar placement. Search, filters and redemption remain unchanged.

The same storefront is available at `/k/{username}/shop` (Kick) and
`/t/{username}/shop` (Twitch). Bundled mappings:

- `/k/DemoUser/shop` and `/t/demouser_tv/shop`: the personal demo channel.
- `/t/novaplays/shop`: Streamer A.
- `/k/atlastv/shop`: Streamer B.

The old `/store/{channelId}` and published-slug links return temporary 307
redirects when a unique platform identity is known. Without a usable platform
identity, an identifiable channel can still use its legacy store. Unknown or
ambiguous names and wrong-platform names return HTTP 404 using the existing
store's missing state. Platform lookups are case-insensitive; canonical URLs
preserve the account's display casing. A platform identity maps to a stable
channel ID, which remains the balance/inventory storage key.

Loyalty → Shop provides copy/open buttons for the active channel's supported
platforms. Copies use the current Demo/localhost origin, not the production
domain. Store footer links and the demo `!shop` directory also use short URLs.

For the personal channel, routing reads the existing active
`platform_connections`. A previous username is accepted only from that
connection's `metadata.previous_usernames`, or from a bundled username whose
stable `platform_user_id` still matches. Existing current-name assignments take
priority over old aliases; conflicting aliases are rejected. No rename history
is inferred from display names, and renaming never moves points or inventory.

A small public, validated routing cookie mirrors only the personal channel's
platform IDs, names and aliases so SSR redirects/404s remain correct after a
local rename and refresh. It contains no credentials, balances or permissions;
it cannot authorize redemption or grant access. The actual catalog and balances
remain in localStorage and are rechecked there. Responses are private/no-store.
These local renames are not global: another browser retains its own Demo fixtures.
Do not copy this Demo-only routing mechanism to Main.

```sh
node --experimental-transform-types --import ./scripts/register-alias.mjs --test scripts/demo-shop-links.test.ts scripts/demo-storefront.test.ts
```
