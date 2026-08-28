import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { DesktopShell } from "@/components/layout/DesktopShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "CallAudit AI — Call Quality Assurance",
  description:
    "AI-powered call auditing and QA evaluation platform with Ubuntu desktop UI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <DesktopShell>{children}</DesktopShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
