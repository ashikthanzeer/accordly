import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accordly — Scope to Cash",
  description: "From agreement to payment, seamlessly.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#090A0C] text-[#F5F3ED]">
        {children}
      </body>
    </html>
  );
}
