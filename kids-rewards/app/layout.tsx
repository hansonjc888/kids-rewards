import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kids Rewards",
  description: "Track achievements, earn stars, and celebrate success together!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased app-root">
        {children}
      </body>
    </html>
  );
}
