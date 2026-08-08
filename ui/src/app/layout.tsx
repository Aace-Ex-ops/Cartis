import type { Metadata } from "next";
import { Inter, Gantari, Inclusive_Sans, Instrument_Serif } from "next/font/google";
import { SmoothScrollProvider } from "@/components/providers/smooth-scroll-provider";
import { Preloader } from "@/components/shared/preloader";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  preload: false,
});

const gantari = Gantari({
  variable: "--font-gantari",
  subsets: ["latin"],
  preload: false,
});

const inclusive = Inclusive_Sans({
  variable: "--font-inclusive",
  subsets: ["latin"],
  preload: false,
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Cartis — AI Financial Coach",
  description: "Buy with confidence. Cartis analyzes products against your financial health.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${gantari.variable} ${inclusive.variable} ${instrument.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Preloader />
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}

