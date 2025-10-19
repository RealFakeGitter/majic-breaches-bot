import { useAuthActions } from "@convex-dev/auth/react";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  return (
    <button
      className="auth-button"
      onClick={() => void signOut()}
    >
      Sign out
    </button>
  );
}
