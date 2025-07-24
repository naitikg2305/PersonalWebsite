import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { HiOutlineMail } from "react-icons/hi";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Naitik Gupta",
  description: "Portfolio and projects by Naitik Gupta",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}

        {/* 🔗 Footer with Socials */}
        <footer
          style={{
            marginTop: "5rem",
            padding: "2rem",
            textAlign: "center",
            borderTop: "1px solid #444",
            color: "#888",
            fontFamily: "monospace",
          }}
        >
          <p style={{ marginBottom: "1rem" }}>Connect with me!</p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "2rem",
              fontSize: "2rem",
            }}
          >
            <a
              href="https://github.com/naitikg2305"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#fff" }}
            >
              <FaGithub />
            </a>
            <a
              href="https://www.linkedin.com/in/naitikg2305/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0077b5" }}
            >
              <FaLinkedin />
            </a>
            <a
              href="mailto:naitikg2305@gmail.com"
              style={{ color: "#00ff00" }}
            >
              <HiOutlineMail />
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
