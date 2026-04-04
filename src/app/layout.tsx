import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@/trpc/client";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "padh.ai — AI-Powered Learning for Class 9–12",
  description:
    "Learn smarter with an AI tutor that explains your NCERT textbooks chapter by chapter, highlights what it's teaching, and prepares you for exams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <NuqsAdapter>
        <TRPCReactProvider>
          <html lang="en">
            <body className={`${inter.className} antialiased`}>
              <Toaster />
              {children}
            </body>
          </html>
        </TRPCReactProvider>
      </NuqsAdapter>
    </ClerkProvider>
  );
}
