import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Finalize sua compra com segurança.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
