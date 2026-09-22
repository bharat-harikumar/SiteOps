import { ROLES, type Role } from "@/lib/auth/roles";
import type { AdminUserListItem } from "@/lib/db/queries/adminUsers";

export type AdminUser = AdminUserListItem;
export type UserFilter = "all" | "pending" | Role;

// Client-side search + filter: the account list is small and fully loaded.
export function filterUsers(users: AdminUser[], query: string, filter: UserFilter): AdminUser[] {
  const q = query.trim().toLowerCase();
  return users.filter((user) => {
    if (filter === "pending" && !user.mustChangePassword) return false;
    if (filter !== "all" && filter !== "pending" && user.role !== filter) return false;
    if (!q) return true;
    return [user.email, user.designation].some((value) => value?.toLowerCase().includes(q));
  });
}

export function userStats(users: AdminUser[]) {
  return {
    total: users.length,
    admins: users.filter((u) => u.role === ROLES.ADMIN).length,
    supervisors: users.filter((u) => u.role === ROLES.SUPERVISOR).length,
    pending: users.filter((u) => u.mustChangePassword).length,
  };
}

export function sortUsers(users: AdminUser[]): AdminUser[] {
  return [...users].sort((a, b) => {
    if (!a.email) return b.email ? 1 : 0;
    if (!b.email) return -1;
    return a.email.localeCompare(b.email);
  });
}

export function initialsFor(email: string | null): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.replace(/[^a-z]/gi, "").slice(0, 2);
  return (letters || "?").toUpperCase();
}

// Demoting an admin revokes their sessions immediately (role route), so the
// dropdown asks first rather than acting on a mis-tap.
export function needsDemoteConfirm(current: Role, next: Role): boolean {
  return current === ROLES.ADMIN && next !== ROLES.ADMIN;
}
