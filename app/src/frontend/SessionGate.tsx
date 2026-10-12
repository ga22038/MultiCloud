import { Sparkle } from "lucide-react";
import styles from "./SessionGate.module.css";
export function SessionGate({
  error,
  onRetry,
}: {
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <main className={styles.gate} aria-busy={!error}>
      <div className={styles.brand}>
        <Sparkle aria-hidden="true" size={26} /> Polaris <span>UES</span>
      </div>
      <p role={error ? "alert" : "status"}>
        {error || "Comprobando tu sesión…"}
      </p>
      {error && <button onClick={onRetry}>Volver a comprobar</button>}
      <a href="/aprender">Explorar el laboratorio multicloud</a>
    </main>
  );
}
