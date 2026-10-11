"use client";
import dynamic from "next/dynamic";
const App = dynamic(() => import("../frontend/App"), {
  ssr: false,
  loading: () => (
    <main className="login-page">
      <p>Cargando Polaris UES…</p>
    </main>
  ),
});
export default function PolarisClient() {
  return <App />;
}
