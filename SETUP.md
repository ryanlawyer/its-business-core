# Setup Guide - ITS Business Core

## 🚀 **Quick Start (5 minutes)**

### 1. **Install Dependencies**

```bash
cd its-business-core
npm install
```

### 2. **Setup Database**

```bash
# Initialize SQLite database with schema
npx prisma db push

# Seed with sample data
npm run db:seed
```

### 3. **Start Development Server**

```bash
npm run dev
```

Visit: **http://localhost:3000**

### 4. **Login**

Use one of these test accounts:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@example.com | admin123 |
| **Manager** | manager@example.com | manager123 |
| **User** | user@example.com | user123 |

---

## 📊 **What's Included (Sample Data)**

### Departments (3)
- Administration
- IT
- Finance

### Users (3)
- Admin User (ADMIN role)
- Department Manager (MANAGER role)
- Regular User (USER role)

### Budget Items (4)
- ADMIN-001: Office Supplies ($5,000)
- IT-001: Hardware & Equipment ($25,000)
- IT-002: Software Licenses ($15,000)
- FIN-001: Professional Services ($10,000)

### Vendors (4)
- Office Depot
- Dell Technologies
- Microsoft
- Acme Consulting

### Purchase Orders (4)
- **DRAFT**: Office supplies order ($450)
- **PENDING_APPROVAL**: New laptops ($4,500)
- **APPROVED**: Microsoft 365 licenses ($3,600)
- **COMPLETED**: Tax preparation services ($2,500)

### Timeclock Entries (2)
- Sample entries for yesterday

---

## 🎭 **Testing the 3-Role System**

### As **USER** (user@example.com)
✅ Can:
- Clock in/out
- View own purchase orders
- Create draft POs
- View budget items and vendors

❌ Cannot:
- Approve POs
- Edit/delete others' POs
- Manage users or budgets

### As **MANAGER** (manager@example.com)
✅ Can:
- Everything USER can do
- Approve POs
- View department POs
- Manage budget items
- Manage vendors

❌ Cannot:
- View ALL POs (only own department)
- Manage users

### As **ADMIN** (admin@example.com)
✅ Can do **EVERYTHING**:
- Full access to all features
- User management
- View all POs across departments
- System configuration

---

## 🔧 **Development Commands**

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database commands
npm run db:push      # Apply schema changes
npm run db:seed      # Seed sample data
npm run db:studio    # Open Prisma Studio (database GUI)

# Lint code
npm run lint
```

---

## 📁 **Project Structure**

```
its-business-core/
├── prisma/
│   ├── schema.prisma    # Database schema (8 models)
│   └── seed.ts          # Sample data
├── src/
│   ├── app/             # Next.js pages (to be created)
│   ├── components/      # React components (to be created)
│   ├── lib/
│   │   └── permissions.ts  # 3-role permission system
│   ├── types/
│   │   └── next-auth.d.ts  # TypeScript definitions
│   ├── auth.ts          # NextAuth configuration
│   └── middleware.ts    # Route protection
├── .env                 # Environment variables
├── package.json
└── README.md
```

---

## 🗄️ **Database Schema**

### 8 Core Models:
1. **User** - User accounts with 3 roles
2. **Department** - Simple flat department list
3. **BudgetItem** - Budget line items
4. **Vendor** - Vendor directory
5. **PurchaseOrder** - PO header
6. **POLineItem** - PO line items
7. **Document** - File uploads
8. **TimeclockEntry** - Clock in/out records

---

## 🔐 **Environment Variables**

`.env` file (already created):

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="supersecretkey12345changethisinproduction"
```

**⚠️ For production**: Generate a secure secret:
```bash
openssl rand -base64 32
```

---

## 📱 **Next Steps**

After setup is complete, you can:

1. ✅ **Explore the data** - Use Prisma Studio:
   ```bash
   npm run db:studio
   ```

2. ✅ **Test authentication** - Login with different roles

3. ✅ **Build the UI** - Next task is creating the frontend pages

4. ✅ **Customize** - Modify seed data or schema as needed

---

## 🐛 **Troubleshooting**

### Database locked error
```bash
# Stop dev server and run:
rm prisma/dev.db
npx prisma db push
npm run db:seed
```

### Port 3000 already in use
```bash
# Kill the process or use a different port:
npm run dev -- -p 3001
```

### Permission denied
```bash
# On Windows, make sure you're running terminal as regular user (not admin)
```

---

## 📚 **Compare to Full System**

| Feature | Core | Full System |
|---------|------|-------------|
| Models | 8 | 30 |
| Roles | 3 | 90 permissions |
| Admin Pages | 2 (planned) | 17 |
| Complexity | ⭐ Simple | ⭐⭐⭐⭐⭐ Complex |
| Setup Time | 5 min | 30+ min |
| Database | SQLite | PostgreSQL |
| Deployment | Docker/NAS | Cloud/Server |

---

**Ready to build the UI? Let me know when you're ready to continue!**
