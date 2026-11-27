# Modular project control – release candidate

This branch is a development candidate. Do not publish until the database schema is installed and access checks and app build pass.

## Modules

Dashboard: schedule indicators, stale reports, weekly change, task-count and work-hour progress (only complete plan work data), forecast date when all incomplete tasks have a forecast. The forecast is not a critical-path calculation.

Terminplanung: plan import for PM, MS Project Baseline 0 retained once available; existing changes shown per task. Work and duration imported from XML. Existing tasks, progress and media remain unchanged.

Fortschritt: existing reporting and task history. Observer, Managing Level and Controlling have read-only operational access.

Qualität: create a defect for an assigned active leaf task, PM updates status; project readers read all project defects.

Reporting: existing Excel export, print-to-PDF weekly report with rule-based text summary, no finance data. No e-mail delivery or AI service yet.

Controlling: PM and Controlling only. Stichtag, BAC, PV, EV, AC manually entered. SPI=EV/PV and CPI=EV/AC; denominator zero yields no value. Separate RLS-protected table.

Administration: PM assigns observer/managing/controlling to existing Auth accounts by project. Removing a project role may restore previously existing resource access; revoke the resource separately where necessary.

Managing Level: project portfolio only for explicitly assigned managing memberships. No finance queries.

## Release sequence

1. Run npm ci, npm run lint and npm run build in branch.
2. Apply supabase/modular_project_control.sql to test schema. Verify existing PM and resource flows and role-specific select/insert/update, storage and import RPC.
3. Test one resource with existing assignment + observer membership: project read access, no report creation. Test observer of a second project: no access outside membership, no finance. Test managing for multiple explicitly assigned projects. Test Controlling + PM finance access and all other roles denied. Verify unauthorized users cannot assign memberships or alter the finance table. Verify no anonymous data access.
4. Apply migration to the target DB after verified checks; then merge/deploy frontend.
5. Update the illustrated user manual only after successful release.

## Remaining scope

Offline mode requires a decision on temporary device-local storage (previous requirement forbids local synchronization). Automated weekly delivery, true AI-generated summaries, push/email notifications, language switch and richer quality assignments are follow-up work. Existing server snapshots are retained, not replaced.
