import React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Poppins } from 'next/font/google'
import "@/app/globals.css";
import { TRPCReactProvider } from "@/providers/trpc-provider";
import AuthSessionProvider from "@/providers/session-provider";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
    title: "PV Printing - Arusheefee Bandeyri",
    description: "Print view for PVs",
};
  
const faruma = localFont({
    src: "../fonts/Faruma.ttf",
    variable: "--font-faruma"
})
  
const waheed = localFont({
    src: "../fonts/MVWaheed.otf",
    variable: "--font-waheed"
})

const poppins = Poppins({subsets: ["latin"], weight: "400", variable: "--font-poppins"})

export default async function PrintLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();
    return(
        <html lang="en" className={`${faruma.variable} ${waheed.variable} ${poppins.variable}`} suppressHydrationWarning>
        <body suppressHydrationWarning>
            <AuthSessionProvider session={session}>
                <TRPCReactProvider>
                    {children}
                </TRPCReactProvider>
            </AuthSessionProvider>
        </body>
        </html>
    )
}