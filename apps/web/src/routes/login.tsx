import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(false);
  const showSignUpForm = useCallback(() => setShowSignIn(false), []);
  const showSignInForm = useCallback(() => setShowSignIn(true), []);

  return showSignIn ? (
    <SignInForm onSwitchToSignUp={showSignUpForm} />
  ) : (
    <SignUpForm onSwitchToSignIn={showSignInForm} />
  );
}
