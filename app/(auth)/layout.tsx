import React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Poppins } from "next/font/google";
import "@/app/globals.css";
import AuthSessionProvider from "@/providers/session-provider";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in - Arusheefee Bandeyri",
  description: "Sign in to the Arusheefee Bandeyri budget portal",
};

const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const faruma = localFont({
  src: "../fonts/Faruma.ttf",
  variable: "--font-faruma",
});
const waheed = localFont({
  src: "../fonts/MVWaheed.otf",
  variable: "--font-waheed",
});
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
});

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  // Strip server-only fields before serialising to the client.
  const clientSession = session
    ? { ...session, accessToken: undefined, accessTokenExpiresAt: undefined }
    : null;
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${faruma.variable} ${waheed.variable} ${poppins.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthSessionProvider session={clientSession}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
