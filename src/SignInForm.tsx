import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"signIn" | "signUp">("signIn");

  return (
    <div className="max-w-md mx-auto">
      <form
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          signIn("password", formData).catch(() => {
            setStep("signUp");
          });
        }}
      >
        <label htmlFor="email">Email</label>
        <input name="email" id="email" className="auth-input-field" />
        <label htmlFor="password">Password</label>
        <input
          type="password"
          name="password"
          id="password"
          className="auth-input-field"
        />
        <input
          type="hidden"
          name="flow"
          value={step}
        />
        <button type="submit" className="auth-button">
          {step === "signIn" ? "Sign in" : "Sign up"}
        </button>
      </form>
    </div>
  );
}
