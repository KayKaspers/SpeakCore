# @speakcore/web

SpeakCore WebUI + API (Next.js App Router, TypeScript, TailwindCSS, next-intl, Prisma).

> **NDF Step 002 – nur Skeleton.** Keine fachlichen Funktionen, keine TS3-Verbindung,
> keine produktiven Auth-Flows. Nur Platzhalter-Dashboard.

## Entwicklung

```bash
# aus dem Repo-Root
pnpm install
cp apps/web/.env.example apps/web/.env   # DATABASE_URL etc.
pnpm --filter @speakcore/web db:generate # Prisma Client
pnpm --filter @speakcore/web dev         # http://localhost:3000  → /de
```

## Struktur

- `src/app/[locale]/` – lokalisierte Routen (DE/EN), Root-Layout + Platzhalter-Dashboard
- `src/i18n/` – next-intl Routing & Request-Konfiguration
- `src/middleware.ts` – Locale-Middleware
- `messages/` – Übersetzungen `de.json` / `en.json`
- `prisma/schema.prisma` – SQLite-Stub-Schema (User, Setting, AuditLog, ServerInstance)
- `tailwind.config.ts` – bindet die Branding-Tokens aus `branding/design-tokens/` ein

## Design

Enterprise-Dark gemäß [BRANDING.md](../../project-brain/BRANDING.md); Farben/Typografie kommen
ausschließlich aus den Design-Tokens.
