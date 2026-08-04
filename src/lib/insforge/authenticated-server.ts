import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";

/**
 * Creates a user-scoped database client only after the current session and
 * application profile have been validated.
 *
 * App layouts and pages can render in parallel in Next.js, so validating only
 * in the parent layout is not enough to protect a child data loader.
 */
export async function createAuthenticatedInsForgeServerClient() {
  await getAppProfile();
  return createInsForgeServerClient();
}
