import React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Poppins } from 'next/font/google'
import "@/app/globals.css";

export const metadata: Metadata = {
    title: "PV Printing - Arusheefee Bandeyri",
    description: "Print view for PVs",
};
  
export const faruma = localFont({
    src: "../fonts/Faruma.ttf",
    variable: "--font-faruma"
})
  
export const waheed = localFont({
    src: "../fonts/MVWaheed.otf",
    variable: "--font-waheed"
})

const poppins = Poppins({subsets: ["latin"], weight: "400", variable: "--font-poppins"})

export default function PrintLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return(
        <html lang="en" className={`${faruma.variable} ${waheed.variable} ${poppins.variable}`}>
        <body>
            {children}
        </body>
        </html>
    )
}