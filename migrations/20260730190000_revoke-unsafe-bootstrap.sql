-- Provision profiles only through the server-side administrator workflow.
-- This closes the empty-project takeover path where any authenticated account
-- could call bootstrap_primary_admin before the first profile existed.
REVOKE EXECUTE ON FUNCTION public.bootstrap_primary_admin(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
