import { useState } from "react";
import {
  ArrowRight,
  CircleHelp,
  Eye,
  EyeOff,
  Laptop,
  LockKeyhole,
  Sparkle,
  UserRound,
} from "lucide-react";
import { signIn } from "./store";

const rememberedUserKey = "polaris-ues:remembered-username";
function readRememberedUser() {
  try {
    return typeof window === "undefined"
      ? ""
      : localStorage.getItem(rememberedUserKey) || "";
  } catch {
    return "";
  }
}
function rememberUser(username: string) {
  try {
    if (username) localStorage.setItem(rememberedUserKey, username.trim());
    else localStorage.removeItem(rememberedUserKey);
  } catch {
    // Browser storage restrictions must not prevent signing in.
  }
}

export function Login() {
  const [username, setUsername] = useState(readRememberedUser);
  const [remember, setRemember] = useState(() => !!readRememberedUser());
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="access-page">
      <div className="access-shell">
        <section className="access-visual" aria-label="Nuestro norte, Polaris">
          <svg
            className="access-curve"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M62 0 C90 20 72 35 40 51 C6 70 10 85 48 100 H100 V0 Z" />
          </svg>
          <span className="access-visual-label">
            UNIVERSIDAD DE EL SALVADOR
          </span>
          <div className="access-story">
            <span className="access-kicker">CADA MOVIMIENTO NOS CONECTA</span>
            <h2>
              Un mismo norte.
              <br />
              Un equipo conectado.
            </h2>
            <p>
              Tu inventario, tus pedidos y las personas.
              <br />
              Todo en un solo espacio.
            </p>
            <span className="access-visual-footer">
              POLARIS UES <span>Gestión de operaciones</span>
            </span>
          </div>
        </section>
        <section className="access-form-panel" aria-labelledby="access-heading">
          <div className="access-form-content">
            <div className="access-wordmark" aria-label="Polaris UES">
              <Sparkle size={31} strokeWidth={1.35} aria-hidden="true" />
              <span>
                Polaris <span>UES</span>
              </span>
            </div>
            <p className="access-brand-note">Un mismo norte para tu equipo.</p>
            <header className="access-heading">
              <h1 id="access-heading">Qué bueno tenerte aquí.</h1>
              <p>Inicia sesión en tu espacio de trabajo.</p>
            </header>
            <form
              className="access-form"
              aria-busy={busy}
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await signIn(username, password);
                  rememberUser(remember ? username : "");
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "No se pudo iniciar sesión.",
                  );
                } finally {
                  setBusy(false);
                  setPassword("");
                  setShowPassword(false);
                }
              }}
            >
              <label htmlFor="access-username">Usuario</label>
              <div className="access-input">
                <UserRound size={17} strokeWidth={1.6} aria-hidden="true" />
                <input
                  id="access-username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={100}
                  placeholder="Tu usuario o carnet"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              <label htmlFor="access-password">Contraseña</label>
              <div className="access-input">
                <LockKeyhole size={17} strokeWidth={1.6} aria-hidden="true" />
                <input
                  id="access-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={error ? "access-error" : undefined}
                />
                <button
                  className="access-password-toggle"
                  type="button"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.6} />
                  ) : (
                    <Eye size={18} strokeWidth={1.6} />
                  )}
                </button>
              </div>
              <label className="access-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => {
                    setRemember(event.target.checked);
                    if (!event.target.checked) rememberUser("");
                  }}
                />
                Recordar mi usuario
              </label>
              {error && (
                <p className="access-error" id="access-error" role="alert">
                  {error}
                </p>
              )}
              <button className="access-submit" disabled={busy}>
                {busy ? "Iniciando sesión…" : "Iniciar sesión"}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
            <details className="access-help">
              <summary>
                <CircleHelp size={15} strokeWidth={1.6} aria-hidden="true" />
                ¿Necesitas ayuda para entrar?
              </summary>
              <div>
                Usa el usuario o carnet asignado a tu cuenta. Si olvidaste tu
                contraseña, solicita ayuda al administrador del equipo.
                «Recordar mi usuario» guarda únicamente tu usuario en este
                navegador.
              </div>
            </details>
            <div className="access-device-note">
              <Laptop size={17} strokeWidth={1.5} aria-hidden="true" />
              <span>Tu espacio, desde computadora o móvil.</span>
            </div>
            <p className="access-account-note">
              Acceso exclusivo para usuarios autorizados.
              <br />
              Cada operación conserva el registro de su responsable.
            </p>
            <a className="access-learning-link" href="/aprender">
              Aprender y comprobar la arquitectura multicloud
              <ArrowRight size={14} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
