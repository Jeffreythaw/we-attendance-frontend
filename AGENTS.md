# Agent instructions

For project rules and database safety, read `../we-attendance-backend/PROJECT_SPEC.md` and `../we-attendance-backend/BACKUP.md` when working in the full workspace.

- Reuse the existing API client and existing UI styles before adding helpers or dependencies.
- Keep payroll calculations on the backend; the frontend must not recalculate pay.
- Preserve the admin `Payslips` tab as the single place to enter monthly fixed allowances and download payslips.
- Do not commit `.env`, Android keystores, local Android SDK settings, credentials, or generated debug screenshots.
- Before handoff run `npm run build` and lint the files changed.
