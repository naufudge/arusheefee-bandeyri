# Arusheefee Bandeyri

Budget and corporate portal for the National Archives of Maldives: payment vouchers, petty cash, GSR forms, reconciliation reports, procurement (price evaluations, asset creation forms), the asset register and settings. New modules will keep being added and existing ones improved.

## Rules

- **Keep it simple, but foolproof.** If a simpler design does the job, use it instead of complex logic. Simple must still be reliable and complete:
  - validate on the server;
  - handle edge cases;
  - wrap multi-step writes in a transaction.
- **Stay consistent.** New features, functions and modules must be consistent with the system's existing logic, architecture and features. Before building, look at how comparable modules already do it and follow them: reuse shared helpers and components, and mirror their behaviour. For example, signatories are staff selects that default to the logged-in user.
- **Short comments.** One or two lines on *why*. No essays, and don't restate the code.
- **Security first.** This is a government budget portal:
  - Every tRPC procedure is `permissionProcedure("module:action")`, or a `protectedProcedure` with an explicit assignee check. Never use `publicProcedure` for data.
  - API routes (`app/api/**`) check `auth()` and `hasPermission` before doing anything.
  - Validate all input with zod on the server. Client-side validation is only a convenience.
  - Workflow actions check the status, the assigned signatory and a signature on file (`server/lib/approval.ts`).
  - Keep secrets (`MMA_TOKEN`, database URL, Azure credentials) server-side only. Never use `NEXT_PUBLIC_` for them, and never log them.
  - Don't send user or record data to third-party services.
  - Record workflow steps and identity changes (renumbering, signatory changes) as `ApprovalEvent` rows.
  - Use Prisma queries. Raw SQL only as tagged templates.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack).
- **Data and API:** tRPC + React Query, Prisma 7 on PostgreSQL.
- **Auth:** NextAuth v5 with Azure Entra ID.
- **UI:** react-hook-form + zod, shadcn/Radix + Tailwind.
- **Documents:** `@react-pdf/renderer` for PDFs, `exceljs` for spreadsheets.
- **Environment:**
  - Development is on Windows.
  - `npm install` needs `--legacy-peer-deps`.

## Layout

| Path | What's there |
|---|---|
| `app/(home)/<module>-register`, `<module>/[num]`, `<module>/create`, `<module>/edit/[num]` | Pages |
| `server/routers/<module>.ts` | tRPC routers, registered in `server/routers/_app.ts` |
| `server/schemas/` | zod input schemas |
| `server/lib/` | Server-only helpers |
| `lib/` | Logic shared by client and server |
| `lib/permissions.ts` | Permission catalogue |
| `components/<module>/` | Module components |
| `components/approval/` | Action bars, `StatusPill`, `event-display.ts` |
| `proxy.ts` | Gates every page behind sign-in |

## Adding a module

1. Add the Prisma model and a new migration. The migration also grants new permissions to the Administrator role; users get them after signing out and back in.
2. Add permissions to `PERMISSIONS` and `PERMISSION_GROUPS` in `lib/permissions.ts`.
3. Write the router and zod schemas, and register the router in `server/routers/_app.ts`.
4. If the module is signed, add:
   - a status enum;
   - `ApprovalEventKind` values, with entries in all three tables in `event-display.ts`;
   - a `StatusPill` and an action bar;
   - its pending items to `server/routers/approvals.ts` (`pendingCount`, `pending`, `history`) and to the Pending Approvals page.
5. If it belongs to a purchase, add a `procurementId` FK and a stage in `lib/procurement.ts`, and cover it in the switches in `server/routers/procurement.ts`.
6. Add a sidebar entry in `components/layout/AppSidebar.tsx`, for the register only. Create buttons live in the register.
7. Render PDFs with `renderPdfBlob` from `lib/pdf-render.ts`.

## Conventions

- **React Compiler lint:**
  - use `useWatch`, not `watch()`;
  - don't read refs during render;
  - pass `onSuccess` to each `mutate` call when it uses refs.
- **Dhivehi text:** Faruma font with `dir="rtl"`.
- **Page styling:** Poppins, `rounded-md border bg-card` sections, uppercase eyebrow labels.
- **Money:** MVR with 2 decimals. Foreign currency converts at the MMA rate.

## Database and migrations

The dev database is remote.

To add a migration:
1. Generate the SQL:
   `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
2. Put it in a new `prisma/migrations/<timestamp>_<name>/migration.sql`.
3. Run `npx prisma migrate deploy`, then `npx prisma generate`.

Rules for existing migrations:
- Never edit a committed migration.
- An uncommitted migration may be edited. When you do, apply the difference to dev yourself and update `_prisma_migrations.checksum` (the sha256 of the file with LF line endings).

## Before handing work over

- `npx tsc --noEmit -p .` and `npm run lint` must both be clean.
- Test server logic headlessly with `appRouter.createCaller`, on throwaway records that are cleaned up afterwards:
  `NODE_PATH="$PWD/node_modules" TS_NODE_BASEURL=. TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","jsx":"react","esModuleInterop":true,"target":"es2020"}' node -r dotenv/config -r ts-node/register/transpile-only -r tsconfig-paths/register <script.ts>`
- Run `npx next build` for larger changes.
- Don't commit unless asked.
