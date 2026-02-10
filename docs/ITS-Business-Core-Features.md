# ITS Business Core

**The all-in-one business management platform built for small and mid-size businesses.**

Replace spreadsheets, paper timesheets, and scattered receipts with a single, self-hosted application your whole team can use from any device.

---

## Why ITS Business Core?

Most business software forces you to choose: pay steep monthly fees for cloud tools you don't fully control, or cobble together spreadsheets and paper processes that don't scale.

ITS Business Core is different. It's a single application that runs on your own hardware — a NAS, a server, or any Docker host — with no recurring subscription fees, no cloud lock-in, and no separate database server to manage. Deploy it in minutes with one command and a guided setup wizard.

It's built for teams of 1 to 250, covering the core workflows every business needs without the bloat of enterprise platforms.

---

## Core Capabilities

### Employee Time Tracking & Payroll Export

A complete timeclock system from punch-in to payroll — no more paper timesheets.

- **One-tap clock in/out** with live session tracking and real-time hours display
- **Manager approval workflow** with bulk approve, reject with notes, and pending queue badges
- **Configurable overtime rules** — daily and weekly thresholds, alerts before employees hit OT
- **Flexible pay periods** — weekly, bi-weekly, semi-monthly, or monthly
- **Payroll export** in CSV, Excel, or professional PDF timesheets with custom column templates that map to your payroll system
- **Smart rules engine** — automatic break deductions, time rounding, minimum duration filtering, missed punch detection, and pay period locking
- **Department-based management** — assign managers to departments, each sees only their team
- **Installable mobile punch clock** — a standalone Progressive Web App your employees add to their home screen for instant clock-in, no app store required

### Purchase Orders & Procurement

Streamline purchasing with digital POs, approval workflows, and real-time budget visibility.

- **Create multi-line purchase orders** with vendor selection and budget line assignment
- **Draft, submit, approve** — a clean workflow with rejection notes and audit trail
- **Real-time budget impact** — see remaining budget before approving, with automatic encumbrance tracking
- **Vendor directory** — maintain contacts, track spending by vendor
- **Receipt attachment** — link uploaded receipts directly to POs for a complete paper trail
- **Mobile-friendly** — create and approve POs from your phone

### Budget Management & Financial Planning

Track every dollar from budget to spend with live dashboards and variance analysis.

- **Budget line items** with codes, descriptions, categories, and department assignments
- **Three-stage spend tracking** — budgeted, encumbered (approved POs), and actual (completed)
- **Executive dashboard** with category breakdowns, department comparisons, and monthly trends
- **Budget amendments** — increase, decrease, or transfer funds between lines with full history
- **Fiscal year management** — define years, soft/hard close, and copy structure year-to-year
- **Drill-down capability** — click any category or department to see underlying line items

### AI-Powered Receipt Processing

Snap a photo. The AI does the rest.

- **Drag-and-drop upload** for images and PDFs, or photograph receipts directly from your phone
- **Automatic data extraction** — merchant name, date, total, tax, and individual line items pulled from the image using AI vision
- **Smart categorization** — AI suggests the right budget category based on the merchant and items
- **Flexible AI providers** — choose Anthropic Claude, OpenAI, OpenRouter, local Ollama models, or any OpenAI-compatible endpoint
- **Usage tracking** — monitor AI API calls, token consumption, and estimated costs per task
- **Works without AI too** — manual entry is always available; AI features are optional enhancements

### Bank Statement Reconciliation

Upload your bank statement. See what's matched and what's missing.

- **Multi-format import** — CSV, Excel, and PDF bank statements with automatic column detection
- **AI-powered transaction matching** — automatically pairs bank transactions with receipts and purchase orders using amount, date, and description similarity
- **Confidence scoring** — each match is ranked so you review the uncertain ones, not all of them
- **Reconciliation dashboard** — visual progress bar and summary cards showing matched, unmatched, and flagged transactions
- **One-click resolution** — accept a match, search for the right receipt, or mark as no receipt needed

### Reporting & Audit Trail

Visibility into spending, activity, and compliance.

- **Expense reports** by date range, category, vendor, or department with CSV/Excel export
- **Budget vs. actual reports** with variance analysis and trend charts
- **Complete audit log** — every create, update, and delete is recorded with user, timestamp, IP address, and before/after values
- **Exportable audit history** for compliance reviews and external audits

---

## What Sets It Apart

### Self-Hosted, Zero Recurring Cost

Your data lives on your hardware. No monthly per-user fees. No surprise price increases. Deploy on a NAS, a Proxmox VM, or any machine that runs Docker.

### One Container, No Dependencies

ITS Business Core uses an embedded SQLite database — there's no PostgreSQL, MySQL, or Redis to install and maintain. One Docker container is the entire system.

### Five-Minute Setup

Run one command. Open the browser. A guided wizard walks you through creating your admin account, naming your organization, and optionally connecting an AI provider. You're operational before the coffee gets cold.

### Mobile-First, Installable

Every page is responsive. The timeclock has a dedicated standalone app your employees install from their browser — no app store, no MDM. Bottom navigation, large touch targets, and camera-based receipt upload make it practical on any phone.

### AI That's Optional and Provider-Agnostic

AI powers OCR and categorization, but every feature works without it. When you do enable AI, you choose the provider — cloud or local. Swap between Anthropic, OpenAI, or a self-hosted Ollama instance without changing anything else.

### Granular Permissions Without the Complexity

Three core roles — User, Manager, Admin — cover most teams out of the box. Need more control? Create custom roles with 50+ individual permission flags across every module. Managers are scoped to their assigned departments.

### Built for the Workflows That Matter

No CRM. No project management. No marketing automation. ITS Business Core focuses on the operational workflows that every business needs and most businesses still do on paper: time tracking, purchasing, budgeting, receipts, and reconciliation. It does these well instead of doing everything poorly.

---

## Technical Overview

| | |
|---|---|
| **Stack** | Next.js 15, React 19, TypeScript, Tailwind CSS 4, Prisma ORM |
| **Database** | SQLite (embedded, NAS-compatible) |
| **Authentication** | NextAuth.js 5 with role-based access control |
| **Deployment** | Docker (single container), Docker Compose optional |
| **AI Providers** | Anthropic, OpenAI, OpenRouter, Ollama, custom endpoints |
| **File Support** | JPEG, PNG, WebP, GIF, PDF upload with image optimization |
| **Export Formats** | CSV, Excel (XLSX), PDF |
| **Backup** | Web UI or CLI backup/restore with encrypted secrets |
| **Requirements** | 512MB RAM minimum, any Docker host |

---

## Ideal For

- **Small businesses** replacing Excel timesheets and paper receipts
- **Growing teams** that need approval workflows and budget controls
- **Privacy-conscious organizations** that want data on their own servers
- **NAS owners** looking for a lightweight business app on existing hardware
- **Budget-conscious companies** that want enterprise features without enterprise pricing

---

*ITS Business Core — Simple. Self-hosted. Essential.*
