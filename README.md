# ITS Business System - Core Edition

> **Lightweight SMB solution for 1-250 employees**

A streamlined business management system built for small to medium businesses. Replaces Excel spreadsheets and paper receipts with a simple, powerful web application.

## 🎯 **Core Philosophy**

- **Simple**: 3 user roles, 4-state workflow, no complexity
- **Fast**: SQLite database, runs on NAS devices
- **Essential**: Only the features SMBs actually use daily

## ✨ **Features**

### Timeclock
- ⏰ Clock in/out tracking
- 📊 Daily summaries
- 📝 Time history

### Purchase Orders
- 📑 Create and manage POs
- 💰 Budget tracking per line item
- 📎 Attach receipts (eliminates paper!)
- 🖨️ Print-friendly templates
- Simple workflow: Draft → Pending → Approved → Completed

### Budget Management
- 💵 Budget line items with spend tracking
- 🏢 Department organization (optional)
- 📊 Real-time encumbered and actual spend tracking
- 📅 Fiscal year support
- 🗂️ Budget categories and amendments
- 📈 Budget dashboard with remaining funds

### Vendors
- 📋 Vendor directory
- 🔍 Quick search
- 📞 Contact information

### User Management
- 👥 3 roles: Admin, Manager, User
- ✅ Active/inactive status
- 🔑 Simple permissions

### System Features
- 📋 Audit logging (track all changes)
- ⚙️ System settings management
- 🔍 Activity monitoring

## 🚀 **Quick Start**

```bash
# Install dependencies
npm install

# Setup database
npx prisma db push
npx prisma db seed

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

**Default login**: admin@example.com / admin123

## 📦 **Tech Stack**

- **Framework**: Next.js 15
- **Database**: SQLite (via Prisma)
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## 🎭 **User Roles**

| Role | Permissions |
|------|------------|
| **User** | Clock in/out, view own POs, create draft POs |
| **Manager** | All User + approve POs, manage budgets, view department data |
| **Admin** | Full access + user management |

## 📊 **PO Workflow**

```
Draft → Pending Approval → Approved → Completed
           ↓
      (Cancelled)
```

## 🗂️ **Database Schema**

**Core Models**:
1. User - Staff accounts and authentication
2. Role - Permission management (Admin, Manager, User)
3. Department - Organizational structure (flat)
4. FiscalYear - Budget year management
5. BudgetCategory - Budget organization
6. BudgetItem - Individual budget line items with tracking
7. BudgetAmendment - Budget adjustment history
8. Vendor - Supplier directory
9. PurchaseOrder - PO management with workflow
10. POLineItem - PO line items linked to budgets
11. TimeclockEntry - Time tracking
12. Document - File attachments
13. AuditLog - Activity tracking
14. SystemSettings - Application configuration

## 🐳 **Docker Deployment**

Deploy with Docker for production environments:

```bash
# Development/Testing (port 3003)
docker-compose -f docker-compose.local.yml up -d

# Production
docker-compose up -d
```

**Features**:
- Persistent data volumes for database and uploads
- Automatic database initialization and seeding
- Health checks and auto-restart
- Ready for NAS deployment (Synology/QNAP)
- No separate database server required (SQLite)

## 📈 **Upgrade Path**

This is **Tier 1: Core**. Future tiers available:
- **Tier 2: Standard** - Advanced approvals, reporting
- **Tier 3: Enterprise** - Multi-region, complex permissions

## 📝 **License**

Private/Proprietary

---

**Built for SMBs who need simplicity, not complexity.**
