import type { Metadata } from "next";
import localFont from "next/font/local";
import { Poppins } from "next/font/google";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Toaster } from "@/components/ui/toaster";
import { TRPCReactProvider } from "@/providers/trpc-provider";
import AuthSessionProvider from "@/providers/session-provider";
import { auth } from "@/lib/auth";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-side fetch the session once so SessionProvider hydrates with
  // the right initial state (skips a client-side flash of "logged out").
  // Strip server-only fields (accessToken) so they never reach the
  // browser via SessionProvider's serialised props.
  const session = await auth();
  const clientSession = session
    ? {
        ...session,
        accessToken: undefined,
        accessTokenExpiresAt: undefined,
      }
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${faruma.variable} ${waheed.variable} ${poppins.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthSessionProvider session={clientSession}>
          <TRPCReactProvider>
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
          </TRPCReactProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
