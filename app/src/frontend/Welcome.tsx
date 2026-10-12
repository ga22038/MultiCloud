import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Sparkle } from "lucide-react";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () => window.matchMedia(motionQuery).matches;

export function Welcome({
  name,
  onComplete,
}: {
  name: string;
  onComplete: () => void;
}) {
  const [seconds, setSeconds] = useState(6);
  const [videoFailed, setVideoFailed] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    prefersReducedMotion,
    () => true,
  );
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
    <main className="arrival-page" aria-labelledby="welcome-heading">
      <div className="arrival-poster" aria-hidden="true" />
      {!reducedMotion && !videoFailed && (
        <video
          className="arrival-film"
          src="/videos/polaris-welcome-v1.mp4"
          poster="/images/polaris-welcome-poster.png"
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setVideoFailed(true)}
        />
      )}
      <header className="arrival-header">
        <div className="arrival-brand">
          <Sparkle size={27} strokeWidth={1.35} aria-hidden="true" />
          Polaris <span>UES</span>
        </div>
        <button className="arrival-skip" onClick={onComplete}>
          Entrar ahora <ArrowRight size={17} aria-hidden="true" />
        </button>
      </header>
      <section className="arrival-content">
        <span className="arrival-kicker">TU EQUIPO. UN MISMO NORTE.</span>
        <h1 id="welcome-heading" ref={heading} tabIndex={-1}>
          Bienvenido, <span>{name}.</span>
        </h1>
        <p>Tu espacio está listo. Sigamos conectados.</p>
        <span className="arrival-message">
          Un mismo norte. Un equipo conectado.
        </span>
      </section>
      <footer className="arrival-footer">
        <span>INVENTARIO · PEDIDOS · TRAZABILIDAD</span>
        <span>Entrarás automáticamente en {seconds} s</span>
      </footer>
    </main>
  );
}
