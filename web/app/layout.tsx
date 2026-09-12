import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ripcord — Parametric wallet insurance",
  description:
    "Add a wallet, get a live risk score, get a quote, get covered. Submit a transaction ID and an automated adjuster pays out in seconds — no human review, no vote.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
