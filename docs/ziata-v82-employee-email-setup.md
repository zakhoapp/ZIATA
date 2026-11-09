# ZIATA V82 — employee-only account decision emails

This setup is REQUIRED before the new Approve / Reject buttons can complete their work. Deploying GitHub Pages alone does not deploy Supabase Edge Functions.

## 1. Resend
- Verify a sending domain in Resend and create a transactional-email API key.
- In Supabase project `sifiezyovmihfjrbjqep`: **Edge Functions → Secrets** set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (example: `ZIATA <notifications@your-verified-domain.com>`).
- NEVER put these secrets in GitHub Pages, HTML, or client-side JavaScript.

## 2. Deploy the function
Use the Supabase CLI with access to the project:
```bash
supabase login
supabase link --project-ref sifiezyovmihfjrbjqep
supabase functions deploy ziata-account-decision --no-verify-jwt
```
The function is implemented with `withSupabase({auth:'user'})`, which independently validates the authenticated user JWT and administrator role. `--no-verify-jwt` disables only the platform gateway check, for modern publishable-key compatibility.

Function source: `supabase/functions/ziata-account-decision/index.ts`

## 3. Test
- Log in as an approved admin and open `admin.html`.
- Approve or reject a *test* employee account that has a valid email.
- The decision endpoint updates the account then asks Resend to send **only** to that employee email (the email is fetched server-side from Auth).
- On successful provider response, the admin sees confirmation. If Resend fails, the admin sees that the account changed but email failed. No admin copy or BCC is sent.
- If Resend is not configured, the endpoint makes no account status change.
- Repeating the same decision does not send an additional email.
- Suspension remains status-only, with no email.

Notes: Successfully accepted for delivery by Resend does not guarantee arrival in inbox; delivery/bounce status is available in Resend. Deploying Supabase functions and configuring provider secrets must be performed by a project administrator; these have not been done by the repository commit alone.
