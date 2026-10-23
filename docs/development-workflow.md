# Development workflow

Future work starts in CylixStudio-Demo. Port a change to CylixStudio (Main) only after explicit approval.

Never port Demo's no-login auth, DemoUser, or Pro unlock into Main. Never copy secrets from either project.

Keep two projects: Demo and Main. Do not create a third full copy.

Do not deploy to production, and do not apply a production database migration, without a separate approval.

## Demo layout plans

The existing Demo `user_subscriptions` fixture is the source of truth for layout
access. `useSubscription(userId)` reads the local Demo database and reacts to
subscription changes, including changes from other tabs. The named
`DemoLayoutPlanSwitch` component in `src/components/widgets/DemoLayoutPlanSwitch.tsx`
accepts `{ userId: string; className?: string }` for builder integration.
`setDemoSubscriptionPlan(userId, "free" | "pro")` from `src/lib/demoSubscription.ts`
changes only the local Demo account; it never starts billing or activates a real license.

Free rejects newly saved or imported Pro layouts at the Demo store/database
write boundary. Existing saved values are preserved on load and downgrade;
runtime state-only updates remain available. Resetting local Demo database data
restores the seeded Pro fixture.
Whole-Demo JSON imports are checked before replacing any localStorage entries.
Access is evaluated against the current local subscription, not a Pro row
contained in the imported file.

Run the fixture regression tests from the Demo directory on Node 24:

```powershell
$hook = ([uri](Resolve-Path scripts\register-alias.mjs).Path).AbsoluteUri
node --experimental-transform-types --import $hook --test scripts\demo-layout-access.test.ts
```

## Prediction: Particle Clash

Prediction's Layout tab offers the unchanged Classic renderer and Particle Clash
(Arabic: صراع الدوائر). The layout picker, editor preview and `/overlay/{token}`
all use `PredictionOverlay` and the same Canvas renderer. Save the widget to
persist its layout and Display/Extra controls in the existing local Demo store.

The eight supplied `public/widgets/prediction/Prediction_*.svg` files contain
static circles/groups. Particle Clash draws individual circles rather than
tiling these whole images; its default colors are their actual fills,
`#2bfbb7` and `#fe8a8a`. Seeded varying sizes and positions persist across votes.
The first two runtime outcomes define left/right sides regardless of their names;
their existing point shares drive spread, population and limited smooth overlap.
Open no-vote data shows a waiting message and no particles or invented percentages.
Idle and closed/waiting states are fully transparent, including after source refresh.
The actual title, first two outcome names, points, voters, status and available
countdown come from the existing `PredictionRuntime`; all displayed numbers use
Latin digits, including in Arabic. Long names wrap within bounded lower-third text.

Display controls size, density, height, colors and overlap; Extra controls motion,
speed, bounce, low-power mode and reset. Local test presets (50/50, 70/30, 90/10
and their reverses) update the widget's existing `state.prediction`, including
custom outcome IDs/names. The same explicitly labeled test panel can edit test
titles/names and create a zero-point state. It saves to the existing widget state,
not a second Prediction store. Lock/Resolve/Idle are simulations, not Kick requests
or point settlement. The Demo stream reads saved Prediction state. Without it,
Particle Clash stays hidden instead of displaying Classic's historical showcase fixture.
Layout-picker samples are explicitly marked as test previews and defer to actual
runtime data when present. A saved local test is also marked "Local test" in its
overlay; external runtime data is not relabeled or replaced.

The transparent 1920×1080 canvas starts empty. Individual circles spawn above the
top of the source, fall under gravity, collide with the floor/other circles,
bounce slightly and stack. The fixed 120Hz solver uses a spatial contact grid;
rendering is capped at 40fps (24fps in low-power mode, with fewer circles).
Resting bodies sleep with exactly zero velocity. After the contact island settles,
the animation loop stops completely: there is no idle drift, repeated spawning or
opacity-only entrance. Hidden/offscreen renderers pause without accumulating time.
Disabled animation and reduced-motion use the same solver to show a settled pile
without displaying the fall. Unmount cancels frames and observers.
Same-origin tabs in one browser profile receive the existing local store's storage
events. Separate browser profiles/devices, including OBS's separate browser
storage, do not share local Demo tests or settings. Demo does not connect to a
live Kick/Twitch prediction provider. Export/import can transfer a local snapshot,
but it does not provide live synchronization.
This is not a claim of validation inside the OBS application.

The rebuilt small-circle engine follows the supplied Illustrator reference:
most default diameters are 10–22px, with some 6–9px and rare 28–32px circles.
Diameter is capped at 32px even with Size increased; vote share never changes it.
Seeded continuous spawn distributions create unequal organic piles through actual
contacts, not predetermined final Y coordinates or repeated SVG groups.
Height is bounded to 70–160px; older saved heights (such as 300px) are safely
clamped on read, without altering saved voting data. Existing Display/Extra
controls remain available. Height controls the preferred concentration of spawn
positions; it is not an invisible ceiling that interferes with falling bodies.

A changed point share drops a small batch (3–16 circles) for the gaining side,
never one circle per vote. A temporary horizontal force redistributes the existing
pile toward its new share, then turns off. New circles interact with existing
circles without recreating them. Unchanged shares and text-only updates do not
restart motion. The pool is capped at 320 bodies; at capacity, outermost bodies
roll off the side before their slots are reused for the new top-spawned batch.
There is no fade or teleport retirement. The final resting contact projection
prevents overlaps from being frozen into sleeping bodies.

The presentation state machine follows source events:
`IDLE -> OPENING -> VOTING -> CLOSING -> WAITING_FOR_RESULT`, then only an
official `resolved` runtime with a valid `winnerId` can trigger
`REVEALING_WINNER -> RESULT_DISPLAY -> CLOSING -> HIDDEN`.
The existing `locked` runtime is the closed-voting event; it never implies a
winner. Cancellation (`idle` or resolution without a winner) exits without one.
Text enters with a 450ms fade/slide. Closing freezes vote input, lets in-flight
physics continue beneath a 750ms fade/down exit, then unmounts the canvas.
Neither idle nor waiting renders any placeholder, title, numbers or particles.

Winner announcements are separate scenes using the same physics engine and
approved small circles. A short batch falls from the top and settles first,
then `winnerRevealMode = "cover"` advances the winner color across the losing
circles. This decorative sample includes both colors even with zero/unanimous
votes; the displayed data still comes unmodified from the actual runtime.
The last segment contains the 250ms pause and 850ms cover transition;
the total announcement defaults to 2600ms (Extra: 2000–3000ms). The winning
outcome's actual label is shown. Original numbers/percentages are never changed
to 100/0. The final scene sleeps for 6000ms (Extra: 5000–8000ms), then fades out.
Extra also provides Opening Animation and Winner Reveal Animation toggles and
Falling Speed (the existing speed setting). Disabled winner motion/reduced motion
shows the final cover immediately; disabling opening shows the initial settled
pile immediately while retaining subsequent vote batches.

Browser Sources save a compact replay receipt in per-tab `sessionStorage`,
scoped by source pathname. The current runtime has no top-level Prediction ID,
so identity uses its outcome IDs; the observed OPEN cycle's timestamp/revision
distinguishes successive predictions with reused IDs. The chosen winner is
claimed at announcement start, so refresh/reconnect cannot replay it. Closed
reloads stay hidden; voting reloads open the current scene; a late official
result still starts its announcement. Repeated data/title/count updates do not
restart transitions. A new observed OPEN after close/cancel/result starts a new
cycle. An expired source `hideAt` suppresses stale announcements.
Unseen cycles with reused outcome IDs cannot be distinguished without a provider
Prediction ID or event history; clearing/denying session storage also removes
replay protection (storage errors are logged explicitly).
Editor previews keep in-memory receipts so layout-card previews cannot consume
the actual source's receipt. Receipts are not shared across OBS profiles/devices,
and do not add a shared backend or change Demo's local-only synchronization.

```sh
node --experimental-transform-types --import ./scripts/register-alias.mjs --test scripts/prediction-particles.test.ts scripts/prediction-particle-lifecycle.test.ts
```

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
