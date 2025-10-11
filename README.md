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
- 📊 At-a-glance remaining budget

### Vendors
- 📋 Vendor directory
- 🔍 Quick search
- 📞 Contact information

### User Management
- 👥 3 roles: Admin, Manager, User
- ✅ Active/inactive status
- 🔑 Simple permissions

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

**8 Core Models**:
1. User
2. Department (flat structure)
3. BudgetItem
4. Vendor
5. PurchaseOrder
6. POLineItem
7. TimeclockEntry
8. Document

## 🐳 **Deployment** (Coming Soon)

- Docker Compose for NAS deployment
- One-command setup on Synology/QNAP
- No database server required

## 📈 **Upgrade Path**

This is **Tier 1: Core**. Future tiers available:
- **Tier 2: Standard** - Advanced approvals, reporting
- **Tier 3: Enterprise** - Multi-region, complex permissions

## 📝 **License**

Private/Proprietary

---

**Built for SMBs who need simplicity, not complexity.**
