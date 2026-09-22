import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeGetSessionFromHeaders } from "@/lib/auth/session";
import { getUserProfile } from "@/lib/db/queries/userProfile";
import { generateRequestId } from "@/lib/utils/requestId";

import { ChangePasswordPageClient } from "./ChangePasswordPageClient";

export const dynamic = "force-dynamic";

// Forced vs voluntary comes from the profile row, not the JWT claim, which can
// lag right after an admin reset. No profile → treat as forced (no Cancel).
export default async function ChangePasswordPage() {
  const session = await safeGetSessionFromHeaders(await headers());
  if (!session) redirect("/auth/sign-in");

  const profile = await getUserProfile(generateRequestId(), session.user.id);
  return <ChangePasswordPageClient forced={profile?.mustChangePassword ?? true} />;
}
