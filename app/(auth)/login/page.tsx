"use client";

import React, { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, Loader2 } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Your account isn't permitted to sign in. Contact your administrator.",
  Configuration: "The sign-in service is misconfigured. Try again later.",
  Verification: "The verification link is invalid or has expired.",
  OAuthSignin: "Could not start the sign-in flow. Try again.",
  OAuthCallback: "Microsoft returned an error during sign-in.",
  OAuthAccountNotLinked: "This account is already linked to another login.",
  Default: "Something went wrong. Try signing in again.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default)
    : null;

  const [pending, setPending] = useState(false);

  const handleSignIn = () => {
    setPending(true);
    signIn("microsoft-entra-id", { callbackUrl });
  };

  return (
    <div className="font-poppins relative flex min-h-screen items-center justify-center bg-background p-6">
      {/* Subtle dot grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,rgba(0,0,0,0.05)_1px,transparent_1px)] [background-size:24px_24px]"
      />

      <div className="relative w-full max-w-md">
        {/* Brand block */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-md border bg-card">
            <Image
              src="/logo.png"
              alt="Arusheefee Bandeyri"
              width={32}
              height={32}
              className="size-8 object-contain"
            />
          </div>
          <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Budget Portal
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Arusheefee Bandeyri
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            National Archives of Maldives
          </p>
        </div>

        {/* Sign-in card */}
        <div className="rounded-md border bg-card p-8 shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Sign in
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Use your Microsoft account
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Restricted to authorised National Archives staff.
          </p>

          {errorMessage && (
            <div className="mt-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={pending}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-3 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MicrosoftIcon className="size-4" />
            )}
            {pending ? "Redirecting..." : "Sign in with Microsoft"}
          </button>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            By signing in you agree to internal acceptable-use policies.
          </p>
        </div>

        <div className="mt-6 text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Fiscal Year{" "}
          <span className="font-mono tabular-nums text-foreground">
            {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 23 23"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="10" height="10" fill="#F25022" />
      <rect x="13" width="10" height="10" fill="#7FBA00" />
      <rect y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
