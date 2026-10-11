import { useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { signIn } from "./store";
import { PolarisMark } from "./PolarisMark";
export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="login-brand">
          <span className="polaris-monogram">P</span> Polaris <span>UES</span>
        </div>
        <PolarisMark />
        <div className="login-story">
          <span className="login-eyebrow">UNIVERSIDAD DE EL SALVADOR</span>
          <h1>
            Un mismo norte.
            <br />
            <span>Todo bajo control.</span>
          </h1>
          <p>
            Las personas, el inventario y cada pedido.
            <br />
            Conectados en un solo espacio.
          </p>
        </div>
        <div className="login-note">
          <ShieldCheck size={20} />
          <span>Inventario · Pedidos · Trazabilidad</span>
        </div>
      </section>
      <div className="login-form-side">
        <section className="login-card">
          <span className="login-access-mark">
            <ShieldCheck size={22} strokeWidth={1.5} />
          </span>
          <span className="login-eyebrow">POLARIS UES / ACCESO</span>
          <h2>
            Tu espacio.
            <br />
            Tu equipo.
          </h2>
          <p>Inicia sesión para continuar tus operaciones.</p>
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
          <span>Un mismo equipo, en cada movimiento.</span>
        </footer>
      </div>
    </main>
  );
}
