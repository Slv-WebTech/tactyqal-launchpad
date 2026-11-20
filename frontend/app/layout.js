import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tactyqal-launchpad.vercel.app";
const TAGLINE = "From idea to launched app, in 8 weeks.";
const DESCRIPTION =
  "Tactyqal Labs: 1:1 mentoring that turns a teen's idea into a launched full-stack app in 8 weeks, with a fast, accessible Next.js site and a secure, tested blog API.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `Tactyqal Labs: ${TAGLINE}`, template: "%s | Tactyqal Labs" },
  description: DESCRIPTION,
  applicationName: "Tactyqal Labs",
  keywords: ["teen entrepreneurship", "app building mentoring", "no-code", "startup program", "Tactyqal Labs"],
  authors: [{ name: "Tactyqal Labs" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Tactyqal Labs",
    title: `Tactyqal Labs: ${TAGLINE}`,
    description: DESCRIPTION,
    url: "/",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: `Tactyqal Labs: ${TAGLINE}`, description: DESCRIPTION },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: [{ color: "#455230" }],
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
