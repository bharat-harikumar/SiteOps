import { PASSWORD_MIN, isPasswordLongEnough } from "@/lib/auth/passwordPolicy";

export type ChangePasswordCopy = {
  heading: string;
  intro: string;
  currentLabel: string;
  canCancel: boolean;
};

// Forced = signed in with a temp password (new account or admin reset); the
// proxy keeps them here until they change it. Voluntary = came from Profile.
export function changePasswordCopy(forced: boolean): ChangePasswordCopy {
  return forced
    ? {
        heading: "Set a new password",
        intro: "You're using a temporary password. Choose a new one to continue.",
        currentLabel: "Current / temporary password",
        canCancel: false,
      }
    : {
        heading: "Change password",
        intro: "Choose a new password for your account.",
        currentLabel: "Current password",
        canCancel: true,
      };
}

export function validateChangePassword(input: {
  current: string;
  next: string;
  confirm: string;
}): string | null {
  if (!input.current) return "Enter your current password";
  if (!isPasswordLongEnough(input.next)) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (input.next !== input.confirm) return "Passwords do not match";
  if (input.next === input.current) return "New password must be different from your current password";
  return null;
}
