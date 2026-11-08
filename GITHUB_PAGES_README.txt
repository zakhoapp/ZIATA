ZIATA - GitHub Pages static website (V58)

1. Extract this ZIP to a folder on your computer.
2. Upload the files (not the ZIP itself) into repository zakhoapp/ZIATA on branch main.
3. Open Settings > Pages > Build and deployment > Source: GitHub Actions.
4. Expected site: https://zakhoapp.github.io/ZIATA/
5. Add https://zakhoapp.github.io/ZIATA/** to Supabase Auth URL Configuration redirect allow list.
6. To enable Transactions and Engineers modules, deploy the separate
   ziata-gas-proxy/index.ts Supabase Edge Function with proper JWT verification.
7. Enable push subscription again for the new GitHub Pages origin. Existing Netlify
   subscriptions do not automatically transfer to a different origin.
8. Test login, approvals, permissions, and notification deep-links before retiring Netlify.

IMPORTANT: GitHub Pages DOES NOT execute Netlify Functions or access-protection
Edge Functions. Supabase RLS is the actual security boundary; review RLS before launch.
The original Netlify deployment remains the fallback.
