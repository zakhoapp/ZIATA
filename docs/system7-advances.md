# ZIATA — System 7: پێشینەیان

Live page: https://zakhoapp.github.io/ZIATA/advances.html

## Current data sources
- Project catalogue: public.ziata_advance_projects (AA + AR), synchronized by Google Apps Script → Edge Function.
- Advances: public.ziata_advances, written only through public.ziata_save_advance RPC.
- Auth: existing ZIATA Supabase login and user_permissions.

## Permissions
Admins are allowed automatically by public.ziata_advance_allowed().
For another approved employee, the existing user_permissions table must contain (user_id, system_key='advances', can_access=true). If user_permissions has a fixed check constraint restricting system_key to six modules, update that constraint first. Review your existing schema before altering it.

## Validation checklist
1. Check AA 264 / AR 194 in public.ziata_advance_projects.
2. Open advances.html as an approved admin and confirm project suggestions.
3. Select a test project and save a test advance; verify its amount and identity in Supabase.
4. Edit a test AA/AR row in Sheets, confirm Apps Script trigger and Supabase sync, and verify the change on reopening/refreshing the page.
5. Confirm that an unauthorized employee cannot read or insert advances (RLS + RPC).

## Notes
- This release shows at most the latest 1000 advances; dashboard totals are limited to loaded records.
- Supabase Realtime requires the two tables in the supabase_realtime publication; otherwise the page refreshes on manual refresh or when returning to the tab.
- Sync currently identifies projects by sheet tab + row. Sorting rows in Sheets can change project identities. A stable permanent ID is needed before sorting.
- Only AR permits a manual project name in the current SQL RPC.
