import { useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { signIn } from "./store";
export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="login-page">
      <section className="login-intro">
        <span className="login-eyebrow">UNIVERSIDAD DE EL SALVADOR</span>
        <h1>
          Polaris <span>UES</span>
        </h1>
        <p>
          Una operación conectada.
          <br />
          Cada movimiento, bajo control.
        </p>
        <div className="login-note">
          <ShieldCheck size={20} />
          <span>Inventario · Pedidos · Trazabilidad</span>
        </div>
      </section>
      <section className="login-card">
        <span className="login-eyebrow">ESPACIO DE TRABAJO</span>
        <h2>Iniciar sesión</h2>
        <p>Ingresa con tu cuenta de Polaris UES.</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              await signIn(username, password);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "No se pudo iniciar sesión.",
              );
            } finally {
              setBusy(false);
              setPassword("");
            }
          }}
        >
          <label>
            Usuario
            <input
              name="username"
              autoComplete="username"
              required
              maxLength={100}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Validando…" : "Entrar al espacio"}
            <ArrowRight size={17} />
          </button>
        </form>
        <small>
          El acceso y las operaciones dependen del rol asignado a tu cuenta.
        </small>
      </section>
      <footer className="login-footer">
        Polaris UES · Gestión de operaciones
      </footer>
    </main>
  );
}
