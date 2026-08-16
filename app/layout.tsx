import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./polish.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nodoryx — Building-energy digital twin",
  description:
    "Nodoryx is a building-energy digital twin that detects abnormal power usage, forecasts capacity risk, and tests corrective actions in real time.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Nodoryx — Building-energy digital twin",
    description:
      "Detect abnormal power usage, forecast capacity risk, and test corrective actions in real time.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
