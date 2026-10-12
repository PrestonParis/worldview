import type { Metadata } from "next";
import { Geist_Mono, Public_Sans } from "next/font/google";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/theme";
import { SITE_URL } from "@/lib/site";

// Public Sans is the U.S. federal government's typeface (USWDS).
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Worldview",
  description: "Explore American public issues, political power, elections, government, demographics, and the public records behind them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${geistMono.variable} h-full antialiased`}
      // THEME_SCRIPT sets the dark class before hydration.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full bg-[#f7f8fa] text-slate-900 dark:bg-[#080b12] dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
