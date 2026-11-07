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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (!sessionStorage.getItem('accordly_intro_seen') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                  document.documentElement.classList.add('intro-active');
                }
              } catch (e) {}
            `,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html.intro-active #accordly-shell {
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
              }
              #accordly-shell {
                transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.8s;
              }
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-[#090A0C] text-[#F5F3ED]">
        {children}
      </body>
    </html>
  );
}
