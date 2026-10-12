import type { Metadata } from "next";
import "../frontend/styles/global.css";
import "../frontend/styles/styles.css";
import "../frontend/styles/polaris.css";
import "../frontend/styles/access.css";
import "../frontend/styles/login.css";
import "../frontend/styles/cinema.css";
export const metadata: Metadata = {
  title: "Polaris UES",
  description: "Gestión de inventario, pedidos y operaciones multicloud.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
