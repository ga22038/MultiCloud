import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PolarisMark } from "./PolarisMark";
import type { Role } from "../domain";

export function Welcome({
  name,
  role,
  onComplete,
}: {
  name: string;
  role: Role;
  onComplete: () => void;
}) {
  const [seconds, setSeconds] = useState(6);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const deadline = performance.now() + 6000;
    const timer = window.setTimeout(onComplete, 6000);
    const countdown = window.setInterval(
      () =>
        setSeconds(
          Math.max(0, Math.ceil((deadline - performance.now()) / 1000)),
        ),
      250,
    );
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(countdown);
    };
  }, [onComplete]);
  return (
    <main className="welcome-page" aria-labelledby="welcome-heading">
      <div className="welcome-brand">
        <span className="polaris-monogram">P</span> Polaris <span>UES</span>
      </div>
      <section className="welcome-content">
        <PolarisMark compact />
        <span className="login-eyebrow">TU EQUIPO. UN MISMO NORTE.</span>
        <h1 id="welcome-heading" ref={heading} tabIndex={-1}>
          Bienvenido, <span>{name}.</span>
        </h1>
        <p>
          Tu equipo conectado.
          <br />
          Cada operación, bajo control.
        </p>
        <div className="welcome-identity">
          <ShieldCheck size={16} />
          <span>{role}</span>
          <span className="welcome-divider" />
          Polaris UES
        </div>
        <button className="button primary welcome-enter" onClick={onComplete}>
          Entrar ahora <ArrowRight size={17} />
        </button>
        <div className="welcome-timing">
          <span>Entrarás automáticamente en {seconds} s</span>
          <div className="welcome-progress" aria-hidden="true">
            <span />
          </div>
        </div>
      </section>
      <footer className="welcome-footer">
        Inventario · Pedidos · Trazabilidad
        <span>UNIVERSIDAD DE EL SALVADOR</span>
      </footer>
    </main>
  );
}
