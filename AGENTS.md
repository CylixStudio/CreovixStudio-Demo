# CylixStudio

Standalone TanStack Start (Vite + Nitro) app. Run it on Node.js with `npm run dev` in development and `npm run build` then `npm start` in production.

## Source layout

```
src/
  routes/           # File-based URLs only — do not add src/pages or app/
    __root.tsx
    _authenticated/ # Pathless layout (no extra URL segment)
    api/            # HTTP handlers
  router.tsx        # getRouter()
  start.ts          # Global middleware
  server.ts         # Node server entry
  routeTree.gen.ts  # Generated — do not edit
  components/
    ui/             # shadcn primitives
    layout/         # App chrome
    overlay/        # OBS/preview surfaces
    widgets/
    ...
  hooks/
  lib/
    supabase/       # Auth clients + types
    *.server.ts     # Server-only helpers
    *.functions.ts  # createServerFn wrappers (safe to import from the client)
  styles.css
```

Do not create `src/pages/`, `app/layout.tsx`, or Next.js `utils/supabase` files.
