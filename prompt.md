# ITS Business Core - Project Context

## Project Overview
**ITS Business Core** is a lightweight business management system built for small to medium businesses (1-250 employees). It replaces Excel spreadsheets and paper receipts with a simple, powerful web application.

**Repository**: https://github.com/ryanlawyer/its-business-core

## Current Status (as of October 13, 2025)
- **Version**: 1.1.0 (Production Ready)
- **Dev Server**: Port 3000 (currently stopped)
- **Docker Local**: Port 3003 (currently running)
- **GitHub**: All changes committed and pushed
- **Latest Commit**: d3d76d0

## Technology Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js v5
- **Styling**: Tailwind CSS
- **Charts**: Chart.js with react-chartjs-2
- **UI Components**: Headless UI
- **Deployment**: Docker with Docker Compose

## Core Features Implemented

### 1. Authentication & Authorization
- NextAuth.js v5 with credential provider
- 3 roles: Admin, Manager, User
- Granular permission system stored in Role model
- Session-based permission caching

### 2. Timeclock
- Clock in/out functionality
- Real-time duration tracking
- Recent entries display

### 3. Purchase Order System
- Complete CRUD operations
- 4-state workflow: DRAFT → PENDING → APPROVED → COMPLETED (+ CANCELLED)
- Line items with budget code assignment
- Document uploads for receipts
- Budget tracking integration (encumbered amounts)
- Print functionality
- Advanced filtering (status, vendor, date range, PO number)

### 4. Budget Management
- Budget items with fiscal year support
- Budget categories and amendments
- Real-time encumbered and actual spend tracking
- Budget dashboard with analytics
- Budget recalculation tool
- Department organization
- Color-coded budget health indicators

### 5. Vendor Management
- Vendor directory with CRUD operations
- Search functionality
- Contact information management
- Active/inactive status

### 6. User Management
- User CRUD operations
- Role and department assignment
- Active/inactive status management
- Password management

### 7. Department Management
- Department CRUD operations
- Flat organizational structure
- Active/inactive status

### 8. System Features
- Audit logging (track all changes)
- System settings management
- Activity monitoring

## Database Schema (14 Models)

1. **User** - Staff accounts and authentication
2. **Role** - Permission management (Admin, Manager, User)
3. **Department** - Organizational structure (flat)
4. **FiscalYear** - Budget year management
5. **BudgetCategory** - Budget organization
6. **BudgetItem** - Individual budget line items with tracking
7. **BudgetAmendment** - Budget adjustment history
8. **Vendor** - Supplier directory
9. **PurchaseOrder** - PO management with workflow
10. **POLineItem** - PO line items linked to budgets
11. **TimeclockEntry** - Time tracking
12. **Document** - File attachments
13. **AuditLog** - Activity tracking
14. **SystemSettings** - Application configuration

## Project Structure

```
its-business-core/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── admin/             # Admin pages (budget dashboard, roles, etc.)
│   │   ├── api/               # API routes
│   │   ├── auth/              # Authentication pages
│   │   ├── budget-items/      # Budget management
│   │   ├── purchase-orders/   # PO management
│   │   ├── users/             # User management
│   │   └── vendors/           # Vendor management
│   ├── components/            # React components
│   ├── lib/                   # Utility libraries
│   │   ├── prisma.ts         # Prisma client
│   │   ├── permissions.ts    # Permission checking
│   │   ├── budget-tracking.ts # Budget calculations
│   │   └── cache.ts          # In-memory caching
│   └── auth.ts               # NextAuth configuration
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Seed data script
├── docker-compose.local.yml  # Local Docker testing (port 3003)
├── docker-compose.yml        # Production Docker config
├── Dockerfile                # Multi-stage Docker build
├── docker-entrypoint.sh      # Container startup script
├── README.md                 # Project documentation
├── PROGRESS.md               # Development history
└── package.json              # Dependencies

```

## Key Files to Know

### Authentication & Permissions
- `src/auth.ts` - NextAuth configuration with `trustHost: true` for Docker
- `src/lib/permissions.ts` - Permission checking utilities
- `src/app/api/auth/[...nextauth]/route.ts` - Auth API handlers

### Budget Tracking
- `src/lib/budget-tracking.ts` - Budget calculation logic
  - `updateBudgetFromPO()` - Updates when PO status changes
  - `recalculateAllBudgets()` - Recalculates all budget values from POs
- `prisma/seed.ts` - **IMPORTANT**: Contains inlined budget recalculation logic for Docker compatibility

### Docker Configuration
- `Dockerfile` - Multi-stage build (deps → builder → runner)
  - Copies full `node_modules` to runner stage for seed dependencies
- `docker-compose.local.yml` - Local testing on port 3003
  - Environment: `AUTH_TRUST_HOST=true`
- `docker-entrypoint.sh` - Auto-seeds database on first run if `database.db` doesn't exist

## Recent Critical Fixes (October 13, 2025)

### Docker Budget Dashboard Fix
**Problem**: Docker container budget dashboard showed $0 for encumbered and actualSpent values

**Root Cause**: Seed file imported `recalculateAllBudgets` from `../src/lib/budget-tracking` which doesn't work in Next.js standalone builds (Docker)

**Solution**:
1. Removed external import from `prisma/seed.ts`
2. Inlined budget recalculation logic directly in seed file
3. Fixed console.log syntax error (broken string literal)

**Result**: Budget dashboard now shows correct values in Docker
- IT-002: $3,600 encumbered (1 approved PO)
- FIN-001: $2,500 actualSpent (1 completed PO)

**GitHub Commits**:
- `6117e91` - Final fix with inlined logic
- `ed4a9a0` - README.md documentation updates
- `d3d76d0` - PROGRESS.md session documentation

## Important Technical Notes

### Next.js Standalone Builds (Docker)
- Standalone output doesn't include `src/` directory structure
- Seed files must be self-contained or use absolute imports
- Use inlined logic for critical functions in seed files

### Docker Volumes
- Database: `its-business-core_its-data-local` (persistent)
- Uploads: `its-business-core_its-uploads-local` (persistent)
- Use `docker-compose down -v` to reset database for testing

### Budget Calculation Logic
**APPROVED POs** → Add line item amounts to `budgetItem.encumbered`
**COMPLETED POs** → Move from encumbered to `budgetItem.actualSpent`

**Available Budget** = `budget - encumbered - actualSpent`

## Environment Setup

### Development Server (Port 3000)
```bash
cd its-business-core
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

### Docker Local Testing (Port 3003)
```bash
cd its-business-core
docker-compose -f docker-compose.local.yml up -d --build

# Reset database
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up -d --build

# View logs
docker logs its-business-core-local

# Stop container (keeps data)
docker-compose -f docker-compose.local.yml down
```

### Production Docker
```bash
docker-compose up -d --build
```

## Login Credentials (Seeded Data)

| Role | Email | Password | Department |
|------|-------|----------|------------|
| **Admin** | admin@example.com | admin123 | IT |
| **Manager** | manager@example.com | manager123 | Finance |
| **User** | user@example.com | user123 | Operations |

## Sample Seeded Data

### Departments
1. IT Department
2. Finance Department
3. Operations Department

### Budget Items (FY 2025)
1. **IT-001** - Hardware Purchases ($50,000 budget)
2. **IT-002** - Software Licenses ($25,000 budget)
3. **FIN-001** - Professional Services ($15,000 budget)
4. **OPS-001** - Office Supplies ($10,000 budget)

### Purchase Orders
1. **PO-2025-001** - DRAFT ($5,000) - Office Furniture
2. **PO-2025-002** - PENDING ($2,100) - Laptop Purchase
3. **PO-2025-003** - APPROVED ($3,600) - Software Subscription (encumbers IT-002)
4. **PO-2025-004** - COMPLETED ($2,500) - Legal Services (actualSpent on FIN-001)

### Vendors
1. TechSupply Co.
2. Office Depot
3. Software Solutions Inc.
4. Legal Services LLC

## Common Tasks

### Recalculate All Budgets
```bash
# Via API (requires auth)
curl -X POST http://localhost:3000/api/budget-items/recalculate

# Via script
npx tsx scripts/recalculate-budgets.ts
```

### Reset Database
```bash
# Dev
npx prisma migrate reset --force

# Docker
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up -d
```

### Check Docker Logs
```bash
docker logs its-business-core-local
docker logs -f its-business-core-local  # follow mode
```

### Prisma Studio (Database GUI)
```bash
npx prisma studio
```

## API Endpoints Reference

### Key Endpoints
- `POST /api/auth/signin` - Sign in
- `GET /api/purchase-orders` - List POs (with filters)
- `POST /api/purchase-orders` - Create PO
- `POST /api/purchase-orders/[id]/status` - Change PO status
- `GET /api/purchase-orders/form-data` - Get vendors + budget items (cached)
- `POST /api/budget-items/recalculate` - Recalculate budget values
- `GET /api/budget-dashboard` - Dashboard analytics
- `GET /api/permissions/check` - Check user permissions

## Known Issues & Limitations

### None Currently
All critical bugs have been resolved as of October 13, 2025.

## Development Workflow

### Making Changes
```bash
# 1. Make code changes
# 2. Test in dev server
npm run dev

# 3. Test in Docker
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.local.yml up -d --build

# 4. Commit changes
git add .
git commit -m "Description"
git push
```

### Deployment
```bash
# On deployment machine
git pull origin main
docker-compose up -d --build
```

## Performance Optimizations

1. **In-memory caching** - 5-minute TTL for form data
2. **Session-based permissions** - Cached in JWT token
3. **Combined API endpoints** - Reduced HTTP requests
4. **Database indexes** - All foreign keys indexed
5. **Query optimization** - Select only needed fields

## Next Steps / Future Enhancements

Potential areas for expansion (Tier 2/3):
- Advanced approval workflows
- Multi-region support
- Email notifications
- Reporting engine
- 1099 tracking
- Mobile app

## Troubleshooting

### Docker Container Won't Start
- Check if port 3003 is already in use: `netstat -ano | findstr :3003`
- Check Docker Desktop is running
- View logs: `docker logs its-business-core-local`

### Budget Values Showing Zero
- Ensure seed script ran successfully (check Docker logs)
- Manually recalculate: POST to `/api/budget-items/recalculate`
- Verify POs have correct statuses (APPROVED or COMPLETED)

### NextAuth UntrustedHost Error
- Ensure `trustHost: true` in `src/auth.ts`
- Ensure `AUTH_TRUST_HOST=true` in docker-compose environment

### Module Not Found in Docker
- Check if import path works in standalone builds
- Consider inlining logic in seed file
- Verify files are copied in Dockerfile

## Project Philosophy

**Simple**: 3 user roles, 4-state workflow, no complexity
**Fast**: SQLite database, runs on NAS devices
**Essential**: Only the features SMBs actually use daily

Built for SMBs who need simplicity, not complexity.

---

## Quick Reference Commands

```bash
# Development
npm run dev                          # Start dev server (port 3000)
npx prisma studio                    # Open database GUI
npx prisma db seed                   # Reseed database

# Docker Local Testing
docker-compose -f docker-compose.local.yml up -d --build    # Build and start
docker-compose -f docker-compose.local.yml down             # Stop (keep data)
docker-compose -f docker-compose.local.yml down -v          # Stop and delete data
docker logs its-business-core-local                         # View logs

# Database
npx prisma migrate reset --force     # Reset dev database
npx prisma generate                  # Regenerate Prisma client

# Git
git status                          # Check status
git add .                           # Stage all changes
git commit -m "message"             # Commit with message
git push                            # Push to GitHub
```

---

**Last Updated**: October 13, 2025
**Current State**: Production Ready, Docker tested and working
**GitHub**: https://github.com/ryanlawyer/its-business-core
