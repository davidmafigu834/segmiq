"use client";

import { secureSignOut } from "@/components/auth/SessionLifecycle";

type Props = {
  className?: string;
  callbackUrl?: string;
  children?: React.ReactNode;
};

/** Client sign-out that POSTs via next-auth (skips the GET confirmation page). */
export function SecureSignOutLink({
  className,
  callbackUrl = "/login",
  children = "Sign out",
}: Props) {
  return (
    <button
      type="button"
      className={["cursor-pointer bg-transparent p-0 font-inherit", className]
        .filter(Boolean)
        .join(" ")}
      onClick={() => void secureSignOut(callbackUrl)}
    >
      {children}
    </button>
  );
}
