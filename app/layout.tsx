import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import ShellLayout from "@/components/ShellLayout";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KB Manager",
  description: "AEM Knowledge Base Ingestion System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${dmMono.variable} font-sans antialiased`}
        style={{ background: "#f8f7fc" }}
      >
        <ToastProvider>
          <ShellLayout>{children}</ShellLayout>
        </ToastProvider>
      </body>
    </html>
  );
}
