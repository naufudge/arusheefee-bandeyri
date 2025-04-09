import type { Metadata } from "next";
import localFont from "next/font/local";
import { Poppins } from "next/font/google";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/toaster";
import "@/app/globals.css";

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


export const faruma = localFont({
  src: "../fonts/Faruma.ttf",
  variable: "--font-faruma",
});

export const waheed = localFont({
  src: "../fonts/MVWaheed.otf",
  variable: "--font-waheed",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Arusheefee Bandeyri",
  description: "Budget portal of Archives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${faruma.variable} ${waheed.variable} ${poppins.variable} antialiased`}
      >
        <SidebarProvider className="font-poppins">
          <AppSidebar />
          <main className="w-full">
            <SidebarTrigger className="mx-5 mt-5" />
            <div className="py-5 px-10 h-full">
              {children}
            </div>
          </main>
          <Toaster />
        </SidebarProvider>
      </body>
    </html>
  );
}
