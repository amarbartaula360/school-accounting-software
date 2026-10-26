# Accounting Software Starter

A beginner-friendly starter project for a web-based school + business accounting system.

## Technology
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL (schema starter included)

## Important
This is a development starter, not production-ready accounting software. The dashboard uses sample figures. Do not enter real financial or student data until authentication, permissions, database persistence, audit logs, backups, and accounting tests are implemented.

## 1. Requirements
Install Node.js LTS from https://nodejs.org/en/download and restart PowerShell/VS Code after installation. Current Vite requires a supported recent Node.js version; check https://vite.dev/guide/.

Check:
```powershell
node -v
npm -v
```

Install PostgreSQL from https://www.postgresql.org/download/ (can be done in a later step; the dashboard can run before database setup).

## 2. Run the frontend
Open PowerShell in this folder:
```powershell
cd client
npm install
npm run dev
```
Open the local URL printed by Vite, usually http://localhost:5173.

## 3. Run the backend (second terminal)
```powershell
cd server
npm install
Copy-Item .env.example .env
npm run dev
```
The API health check is http://localhost:4000/api/health.

The backend will run without PostgreSQL configured, but database routes are not yet connected.

## Project roadmap
1. Dashboard and navigation (included; sample data only)
2. PostgreSQL connection and user login
3. Chart of accounts and double-entry journal vouchers
4. Ledger, trial balance, profit/loss and balance sheet
5. School fees, scholarships and receipts
6. Hostel/canteen, sales, purchases, inventory and suppliers
7. Payroll, cash/bank reconciliation, tax records and exports
8. Permissions, audit trail, backups, testing and secure deployment
