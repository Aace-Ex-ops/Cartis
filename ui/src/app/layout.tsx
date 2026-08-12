import type { Metadata } from "next";
import { Inter, Playfair_Display, JetBrains_Mono, Anybody, Inclusive_Sans, Gantari, Instrument_Serif } from "next/font/google";
import { SmoothScrollProvider } from "@/components/providers/smooth-scroll-provider";
import { Preloader } from "@/components/shared/preloader";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  preload: false,
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  preload: false,
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  preload: false,
});

const anybody = Anybody({
  variable: "--font-anybody",
  subsets: ["latin"],
  preload: false,
});

const inclusiveSans = Inclusive_Sans({
  variable: "--font-inclusive",
  subsets: ["latin"],
  preload: false,
});

const gantari = Gantari({
  variable: "--font-gantari",
  subsets: ["latin"],
  preload: false,
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

export const metadata: Metadata = {
  title: "Cartis — AI Financial Coach",
  description: "Buy with confidence. Cartis analyzes products against your financial health.",
  icons: [{ rel: "icon", url: "/favicon.png", type: "image/png" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${jetbrains.variable} ${anybody.variable} ${inclusiveSans.variable} ${gantari.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Preloader />
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}

