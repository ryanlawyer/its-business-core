# ITS Business Core Development Instructions

You are developing ITS Business Core, an SMB management system for small-to-medium businesses (1-250 employees).

## Project Context

**Tech Stack:**
- Frontend: Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Backend: Next.js API Routes + Prisma ORM
- Database: SQLite (NAS-compatible, no separate DB server)
- Auth: NextAuth.js 5 (Credentials provider)
- UI: React 19, Headless UI, Heroicons

**Design Philosophy:**
- Simple, fast, and essential features only
- Lightweight alternative to Excel and paper-based processes
- 3 core roles: USER, MANAGER, ADMIN

## Your Task

1. Read `prd.json` to understand all user stories and their status
2. Read `progress.txt` to see what was accomplished in previous iterations
3. Find the FIRST user story where `"passes": false`
4. Implement ONLY that single story
5. Run all tests and linting
6. If all acceptance criteria pass, update `prd.json` to set `"passes": true` for that story
7. Update `progress.txt` with what you accomplished
8. Commit your changes with a meaningful message
9. If ALL stories have `"passes": true`, output `<promise>COMPLETE</promise>`

## Critical Rules

### Single Story Per Iteration
- Work on exactly ONE user story per iteration
- Do not skip ahead even if you see opportunities
- Each iteration = one story = one commit

### Quality Gates
Before marking a story as complete:
- [ ] All acceptance criteria are implemented
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] TypeScript has no errors
- [ ] Prisma migrations run without errors (if schema changed)

### Code Standards
- Use TypeScript strict mode
- Follow Next.js 15 App Router conventions
- Use server components by default, client components only when needed
- Prisma for all database operations
- Follow existing permission patterns in `lib/check-permissions.ts`
- Match existing UI patterns and styling (Tailwind CSS variables)

### Commit Messages
Use conventional commits:
- `feat(TC-001): add pay period config model`
- `feat(TC-005): extend timeclock permissions`
- `fix(TC-007): handle locked entry validation`

## File Structure Reference

```
src/
  app/
    api/timeclock/           # Timeclock API routes
    timeclock/               # Timeclock pages (new)
    admin/timeclock/         # Admin config pages (new)
  lib/
    prisma.ts                # Prisma client
    check-permissions.ts     # Permission utilities
    permissions.ts           # Permission types
    overtime.ts              # Overtime calculation (new)
  components/
    Navbar.tsx               # Navigation (update)
prisma/
  schema.prisma              # Database schema
```

## Progress Tracking

After completing a story:

1. Update `prd.json`:
```json
{
  "id": "TC-001",
  "passes": true  // Change from false to true
}
```

2. Update `progress.txt`:
```
## Iteration N - [Story ID]
- What was implemented
- Key decisions made
- Any issues encountered
- Files created/modified
```

3. Commit with: `git add -A && git commit -m "feat(STORY-ID): description"`

## When All Stories Complete

When you check `prd.json` and ALL user stories have `"passes": true`:

Output exactly: `<promise>COMPLETE</promise>`

This signals the Ralph loop to exit.

## Helpful Commands

```bash
# Development
npm run dev

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Build
npm run build

# Database
npx prisma generate
npx prisma db push
npx prisma studio
npx prisma migrate dev --name <migration-name>
```

## Design Reference

See `docs/plans/2026-02-04-timeclock-enhancements-design.md` for:
- Complete data model specifications
- API endpoint details
- UI mockups and flows
- Approval workflow rules
- Overtime calculation logic

## Current Iteration

Read `progress.txt` and `prd.json` now to determine your next task.
