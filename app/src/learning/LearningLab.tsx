"use client";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  Cloud,
  Copy,
  Database,
  Download,
  ExternalLink,
  GitBranch,
  Globe,
  Server,
  ShieldCheck,
  Sparkle,
  Terminal,
} from "lucide-react";
import { lessons, manualUrl, repository, requirements } from "./content";
import styles from "./LearningLab.module.css";

type Probe = {
  observedAt: string;
  observer: string;
  results: {
    endpoint: string;
    origin: string;
    httpStatus: number;
    site: string | null;
    ready: boolean;
    elapsedMs: number;
  }[];
};
type Scenario = "normal" | "app" | "region";
function Code({
  text,
  label = "Copiar comandos",
}: {
  text: string;
  label?: string;
}) {
  const [notice, setNotice] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copiado");
    } catch {
      setNotice("Selecciona y copia el texto");
    }
  }
  return (
    <div className={styles.code}>
      <div>
        <span>
          <Terminal size={13} /> PowerShell
        </span>
        <button onClick={() => void copy()} aria-label={label}>
          <Copy size={14} />
          {notice || "Copiar"}
        </button>
      </div>
      <pre>
        <code>{text}</code>
      </pre>
      <span role="status" className={styles.srOnly}>
        {notice}
      </span>
    </div>
  );
}

export default function LearningLab() {
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [track, setTrack] = useState<"probar" | "replicar">("probar");
  const [lessonId, setLessonId] = useState("http");
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [checking, setChecking] = useState(false);
  const [probeError, setProbeError] = useState("");
  const [domain, setDomain] = useState<"no" | "team" | "own">("no");
  const [answer, setAnswer] = useState<number | null>(null);
  const [question, setQuestion] = useState(0);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("polaris:learning:v1") || "[]",
      );
      if (Array.isArray(saved))
        setCompleted(
          saved.filter(
            (id) => typeof id === "string" && lessons.some((l) => l.id === id),
          ),
        );
    } catch {
      /* Progress is optional when storage is unavailable. */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem("polaris:learning:v1", JSON.stringify(completed));
      } catch {
        /* Keep progress in memory. */
      }
    }
  }, [completed, loaded]);
  const active = lessons.find((l) => l.id === lessonId) || lessons[0];
  async function check() {
    setChecking(true);
    setProbeError("");
    try {
      const response = await fetch("/api/learning/health", {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error();
      setProbe(await response.json());
    } catch {
      setProbeError(
        "No se pudo completar la consulta. Usa los enlaces directos o el observador PowerShell.",
      );
    } finally {
      setChecking(false);
    }
  }
  function download() {
    if (!probe) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...probe,
            scope: "Public HTTP readiness only; not database disaster recovery",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polaris-consulta-salud.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const questions = [
    {
      title:
        "Si GCP devuelve los mismos datos que AWS, ¿la réplica está comprobada?",
      options: [
        "Sí, porque hay dos URL.",
        "No. Las dos API consultan RDS; debo leer la base GCP.",
      ],
      correct: 1,
      explain:
        "El verificador de réplica entra a la VM MariaDB GCP y consulta GTID, IO/SQL, read-only y revisión.",
    },
    {
      title: "Detengo el contenedor app de AWS. ¿Qué estoy demostrando?",
      options: [
        "Conmutación de aplicación; RDS sigue siendo el escritor.",
        "Recuperación ante pérdida total de AWS y su base.",
      ],
      correct: 0,
      explain:
        "Route 53 puede elegir GCP. Su API necesita todavía RDS y VPN; no hay promoción de base en este ensayo.",
    },
    {
      title: "¿Necesito comprar un dominio para empezar?",
      options: [
        "Sí, hasta para Docker local.",
        "No. Empiezo local o por IP; después resuelvo nombres DNS/TLS.",
      ],
      correct: 1,
      explain:
        "Un subdominio cedido por el equipo puede servir para la arquitectura completa. HTTP por IP no acredita TLS.",
    },
    {
      title: "¿Qué demuestra terraform validate?",
      options: [
        "Que los servidores existen y están saludables.",
        "Que la configuración es estructuralmente válida.",
      ],
      correct: 1,
      explain:
        "Para demostrar recursos, consulta los proveedores. plan muestra cambios previstos; apply los ejecuta.",
    },
  ];
  const quiz = questions[question];
  return (
    <div className={styles.lab}>
      <a className={styles.skip} href="#learning-main">
        Ir al contenido
      </a>
      <header className={styles.header}>
        <a href="/aprender" className={styles.brand}>
          <Sparkle size={23} />
          Polaris <span>UES</span>
          <small>LAB</small>
        </a>
        <nav aria-label="Secciones del laboratorio">
          <a href="#arquitectura">Arquitectura</a>
          <a href="#taller">Taller</a>
          <a href="#pruebas">Pruebas</a>
          <a href="#requisitos">Requisitos</a>
        </nav>
        <a href="/" className={styles.back}>
          Ir al sistema <ArrowRight size={15} />
        </a>
      </header>
      <main id="learning-main">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              UN MISMO NORTE. APRENDER EN EQUIPO.
            </span>
            <h1>
              No lo memorices.
              <br />
              <span>Compruébalo.</span>
            </h1>
            <p>
              De una línea de Terraform a dos nubes conectadas. Entiende cómo se
              construyó Polaris UES, observa sus pruebas y prepara tu propio
              laboratorio.
            </p>
            <div className={styles.actions}>
              <a href="#taller" className={styles.primary}>
                Empezar el recorrido <ArrowRight size={16} />
              </a>
              <a href={repository} target="_blank" rel="noreferrer">
                Ver el código <GitBranch size={16} />
              </a>
            </div>
            <div className={styles.heroFoot}>
              <span>01 · Entender</span>
              <span>02 · Probar</span>
              <span>03 · Replicar</span>
            </div>
          </div>
          <div
            className={styles.heroVisual}
            aria-label="Vista conceptual: AWS y Google Cloud conectadas por VPN"
          >
            <span className={styles.visualLabel}>
              EL LABORATORIO DEL EQUIPO
            </span>
            <div className={styles.orbitBrand}>
              <Sparkle size={38} strokeWidth={1} />
              <span>Polaris UES</span>
            </div>
            <div className={styles.cloudPair}>
              <div>
                <Server size={23} />
                <strong>AWS</strong>
                <span>Aplicación · RDS primario</span>
              </div>
              <span className={styles.connection}>
                IPsec
                <br />
                <ArrowRight size={25} />
                <small>GTID</small>
              </span>
              <div>
                <Cloud size={23} />
                <strong>Google Cloud</strong>
                <span>Aplicación · Réplica</span>
              </div>
            </div>
            <p>
              Dos aplicaciones. Un escritor activo.
              <br />
              La recuperación de datos aún debe ensayarse.
            </p>
          </div>
        </section>
        <section id="arquitectura" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>01 / ENTENDER</span>
              <h2>Sigue el recorrido de una petición.</h2>
            </div>
            <p>
              Cambia el escenario y observa qué capa continúa funcionando. Esto
              es una simulación educativa; no controla servidores.
            </p>
          </div>
          <div className={styles.scenarios} aria-label="Escenario simulado">
            {(
              [
                ["normal", "Operación normal"],
                ["app", "Falla la aplicación AWS"],
                ["region", "Se pierde AWS y RDS"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                aria-pressed={scenario === id}
                onClick={() => setScenario(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.topology}>
            <div className={styles.dnsNode}>
              <Globe size={22} />
              <strong>Cliente + Route 53</strong>
              <span>
                {scenario === "normal"
                  ? "DNS selecciona AWS"
                  : scenario === "app"
                    ? "DNS puede seleccionar GCP"
                    : "DNS puede cambiar; los datos no se promueven solos"}
              </span>
            </div>
            <div className={styles.nodeArrow}>
              <ArrowDown size={19} />
            </div>
            <div className={styles.topologyClouds}>
              <div data-state={scenario === "normal" ? "active" : "down"}>
                <span className={styles.nodeLabel}>AWS / PRIMARIO</span>
                <h3>
                  <Server size={19} /> NGINX + API
                </h3>
                <p>
                  {scenario === "normal"
                    ? "Atiende el tráfico principal."
                    : "Aplicación fuera de servicio en este escenario."}
                </p>
                <div className={styles.dataNode}>
                  <Database size={17} />
                  <div>
                    <strong>RDS MariaDB</strong>
                    <span>
                      {scenario === "region"
                        ? "Escritor inaccesible"
                        : "Único escritor · Read / Write"}
                    </span>
                  </div>
                </div>
              </div>
              <div
                data-state={
                  scenario === "app"
                    ? "active"
                    : scenario === "region"
                      ? "down"
                      : "standby"
                }
              >
                <span className={styles.nodeLabel}>GCP / RESPALDO</span>
                <h3>
                  <Cloud size={19} /> NGINX + API
                </h3>
                <p>
                  {scenario === "app"
                    ? "Puede atender y escribir en RDS por VPN."
                    : scenario === "region"
                      ? "La API no puede operar sin su escritor RDS."
                      : "Lista para recibir tráfico si falla la aplicación AWS."}
                </p>
                <div className={styles.dataNode}>
                  <Database size={17} />
                  <div>
                    <strong>MariaDB réplica</strong>
                    <span>Read-only · No promovida</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.vpnLine}>
              <ShieldCheck size={16} />
              {scenario === "region"
                ? "Recuperación pendiente: aislar, promover y cambiar el destino de la API."
                : "VPN privada cifrada · Replicación asíncrona GTID de RDS a GCP"}
            </div>
          </div>
          <div className={styles.explanation} aria-live="polite">
            <strong>
              {scenario === "region"
                ? "Esta es la diferencia que debes explicar en la defensa."
                : scenario === "app"
                  ? "Cambia la aplicación; la base primaria sigue en AWS."
                  : "NGINX y DNS cumplen funciones diferentes."}
            </strong>
            <p>
              {scenario === "region"
                ? "La copia GCP existe, pero no está automatizada su promoción. No prometemos continuidad ante la pérdida total de AWS."
                : scenario === "app"
                  ? "El ensayo histórico observó GCP a los 127.677 segundos. No es un SLA ni una prueba de desastre de base de datos."
                  : "Route 53 elige la nube. NGINX publicado envía al backend local; el upstream remoto backup de la guía sigue pendiente."}
            </p>
          </div>
        </section>
        <section id="taller" className={`${styles.section} ${styles.workshop}`}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>02 / HACER Y EXPLICAR</span>
              <h2>Un comando. Una evidencia.</h2>
            </div>
            <p>
              Lee el propósito, ejecuta en el entorno correcto y contrasta el
              resultado. Tu progreso es personal; no certifica requisitos.
            </p>
          </div>
          <div className={styles.trackRow}>
            <div className={styles.scenarios}>
              {(
                [
                  ["probar", "Demostrar nuestro proyecto"],
                  ["replicar", "Construir mi laboratorio"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={track === id}
                  onClick={() => {
                    setTrack(id);
                    setLessonId(lessons.find((l) => l.track === id)!.id);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <span>
              {completed.length} / {lessons.length} prácticas revisadas
            </span>
          </div>
          <div className={styles.lessonGrid}>
            <nav aria-label="Prácticas del taller">
              {lessons
                .filter((l) => l.track === track)
                .map((l, i) => (
                  <button
                    key={l.id}
                    className={lessonId === l.id ? styles.selectedLesson : ""}
                    aria-current={lessonId === l.id ? "step" : undefined}
                    onClick={() => setLessonId(l.id)}
                  >
                    <span>
                      {completed.includes(l.id) ? (
                        <Check size={14} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    {l.title}
                    <ChevronRight size={14} />
                  </button>
                ))}
            </nav>
            <article className={styles.lesson} aria-labelledby="lesson-title">
              <span className={styles.eyebrow}>
                {active.track === "probar"
                  ? "LABORATORIO ACTUAL"
                  : "TU CUENTA / TU ENTORNO"}
              </span>
              <h3 id="lesson-title">{active.title}</h3>
              <p>{active.goal}</p>
              {(active.command.includes("scripts/") ||
                active.command.includes("scripts\\") ||
                active.command.includes("infra/") ||
                active.id === "deploy") && (
                <details className={styles.terminalHelp} open>
                  <summary>
                    Primero: abre PowerShell en tu carpeta del repositorio
                  </summary>
                  <ol>
                    <li>
                      En el Explorador de Windows, abre la carpeta donde
                      clonaste MultiCloud. Debe contener package.json y la
                      carpeta scripts. Cada compañero puede tener una ruta
                      diferente.
                    </li>
                    <li>
                      En la barra de dirección del Explorador escribe powershell
                      y presiona Enter. No uses una terminal ubicada en
                      C:\Windows\System32.
                    </li>
                    <li>
                      Ejecuta la comprobación de abajo. Ambos Test-Path deben
                      devolver True. Si aparece False, estás en otra carpeta o
                      debes actualizar tu copia del repositorio.
                    </li>
                  </ol>
                  <Code
                    text={
                      "Get-Location\nTest-Path .\\package.json\nTest-Path .\\scripts\\run-aws-script.ps1"
                    }
                    label="Copiar comprobación de carpeta"
                  />
                  <p>
                    Después copia la línea completa del comando, desde
                    powershell. -NoProfile por sí solo no es un programa. El
                    prefijo .\ significa «dentro de la carpeta actual».
                  </p>
                  <dl>
                    <div>
                      <dt>powershell</dt>
                      <dd>Ejecuta PowerShell.</dd>
                    </div>
                    <div>
                      <dt>-NoProfile</dt>
                      <dd>Omite las personalizaciones de PowerShell.</dd>
                    </div>
                    <div>
                      <dt>-File</dt>
                      <dd>Selecciona el script local que se ejecutará.</dd>
                    </div>
                    <div>
                      <dt>-ScriptPath</dt>
                      <dd>
                        Indica el script que el helper enviará al servidor.
                      </dd>
                    </div>
                  </dl>
                  <p>
                    Para el laboratorio compartido necesitas una sesión cloud
                    autorizada. Tu carnet del ERP no concede permisos AWS/GCP.
                    En una copia propia adapta cuenta, proyecto e instancia
                    antes de ejecutar los helpers.
                  </p>
                </details>
              )}
              {active.risk && (
                <div className={styles.caution}>
                  <strong>Antes de ejecutarlo</strong>
                  <p>{active.risk}</p>
                </div>
              )}
              <ol>
                {active.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <Code key={active.id} text={active.command} />
              <div className={styles.resultNotes}>
                <div>
                  <span>QUÉ DEBES OBSERVAR</span>
                  <p>{active.expected}</p>
                </div>
                <div>
                  <span>QUÉ NO DEMUESTRA</span>
                  <p>{active.limit}</p>
                </div>
              </div>
              <label className={styles.complete}>
                <input
                  type="checkbox"
                  checked={completed.includes(active.id)}
                  onChange={(e) =>
                    setCompleted((ids) =>
                      e.target.checked
                        ? [...ids, active.id]
                        : ids.filter((id) => id !== active.id),
                    )
                  }
                />
                Ya lo revisé y puedo explicar su resultado
              </label>
            </article>
          </div>
        </section>
        <section id="pruebas" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>03 / OBSERVAR</span>
              <h2>Consulta el proyecto que está en línea.</h2>
            </div>
            <p>
              Solo lecturas HTTP de los tres endpoints públicos del equipo. No
              apaga servicios, no escribe datos y no utiliza credenciales cloud.
            </p>
          </div>
          <div className={styles.probeBar}>
            <button
              className={styles.primary}
              onClick={() => void check()}
              disabled={checking}
            >
              {checking ? "Consultando…" : "Consultar salud ahora"}
              <ArrowRight size={16} />
            </button>
            {probe && (
              <button className={styles.download} onClick={download}>
                <Download size={16} />
                Guardar resultado JSON
              </button>
            )}
            <span role="status">
              {probe
                ? `Observado ${new Date(probe.observedAt).toLocaleString("es-SV")} · consulta desde ${probe.observer}`
                : "Todavía no has consultado. No mostramos un estado supuesto."}
            </span>
          </div>
          {probeError && (
            <p className={styles.caution} role="alert">
              {probeError}
            </p>
          )}
          <div className={styles.probeGrid}>
            {(["app", "aws", "gcp"] as const).map((endpoint) => {
              const row = probe?.results.find((r) => r.endpoint === endpoint);
              return (
                <article key={endpoint}>
                  <span className={styles.eyebrow}>
                    {endpoint === "app"
                      ? "DOMINIO COMÚN"
                      : endpoint.toUpperCase()}
                  </span>
                  <h3>
                    {row
                      ? row.ready
                        ? "Disponible"
                        : "Revisar respuesta"
                      : "Sin consultar"}
                  </h3>
                  <p>
                    {row
                      ? `HTTP ${row.httpStatus || "sin respuesta"} · sitio ${row.site || "sin identificar"} · ${row.elapsedMs} ms`
                      : "Resultado real cuando ejecutes la consulta."}
                  </p>
                  <a
                    href={`https://${endpoint}.multicloud.polarisenterprisesv.com/api/health/ready`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir endpoint directo <ExternalLink size={13} />
                  </a>
                </article>
              );
            })}
          </div>
          <p className={styles.scope}>
            La consulta sale del servidor que atiende esta página. Para observar
            DNS desde tu computadora usa Resolve-DnsName y
            scripts/observe-multicloud.ps1. Una API saludable no acredita
            Multi-AZ, réplica, RPO cero ni recuperación total.
          </p>
        </section>
        <section className={`${styles.section} ${styles.domainSection}`}>
          <div>
            <span className={styles.eyebrow}>04 / TU PROPIO LABORATORIO</span>
            <h2>¿Y si no tengo dominio?</h2>
            <p>
              Comprar uno no es el primer paso. Elige tu situación y mira qué
              puedes practicar.
            </p>
            <div className={styles.scenarios}>
              {(
                [
                  ["no", "No tengo dominio"],
                  ["team", "Me ceden un subdominio"],
                  ["own", "Tengo mi propio dominio"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={domain === id}
                  onClick={() => setDomain(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.domainAnswer} aria-live="polite">
            <Globe size={25} />
            <h3>
              {domain === "no"
                ? "Empieza con localhost y tus IP."
                : domain === "team"
                  ? "Un nombre propio para cada compañero."
                  : "Controla tus registros y certificados."}
            </h3>
            <p>
              {domain === "no"
                ? "Docker y NGINX locales, API por IP de una VM, redes, VPN y réplica no requieren comprar un dominio. HTTP por IP es una práctica y no satisface TLS."
                : domain === "team"
                  ? "El propietario puede darte nombres o delegar una subzona. Debe crear los registros para tus IP; tus servidores necesitan sus propios certificados y health checks."
                  : "Crea registros para AWS, GCP y el dominio común; configura PRIMARY/SECONDARY y TLS con renovación. Comprueba DNS y certificado antes de probar el corte."}
            </p>
            <small>
              {domain === "no"
                ? "Para reproducir nuestro HTTPS y failover DNS necesitas controlar nombres DNS. Puede ser un subdominio del equipo. Una URL vercel.app no se puede apuntar automáticamente a tu EC2."
                : "Esta página no crea registros ni compra dominios. Esas acciones se hacen con el dueño de DNS en una práctica acordada."}
            </small>
          </div>
        </section>
        <section id="requisitos" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>
                05 / DEFENDER CON EVIDENCIA
              </span>
              <h2>Lo implementado. Lo que falta probar.</h2>
            </div>
            <p>
              Estado documentado el 11 de octubre de 2026. La guía tiene
              requisitos, pero no una rúbrica porcentual. El cumplimiento es
              parcial.
            </p>
          </div>
          <div className={styles.requirements}>
            {requirements.map(([name, state, note]) => (
              <article key={name}>
                <h3>{name}</h3>
                <span data-state={state}>{state}</span>
                <p>{note}</p>
              </article>
            ))}
          </div>
          <div className={styles.quiz}>
            <div>
              <span className={styles.eyebrow}>
                ENSAYA TU EXPLICACIÓN · {question + 1} / {questions.length}
              </span>
              <h3>{quiz.title}</h3>
            </div>
            <div className={styles.quizAnswers}>
              {quiz.options.map((option, i) => (
                <button
                  key={option}
                  onClick={() => setAnswer(i)}
                  aria-pressed={answer === i}
                >
                  {option}
                </button>
              ))}
            </div>
            {answer !== null && (
              <div role="status">
                <strong>
                  {answer === quiz.correct
                    ? "Correcto."
                    : "Revisa esta diferencia."}
                </strong>
                <p>{quiz.explain}</p>
                <button
                  onClick={() => {
                    setQuestion((question + 1) % questions.length);
                    setAnswer(null);
                  }}
                >
                  Siguiente pregunta <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </section>
        <section className={styles.resources}>
          <div>
            <span className={styles.eyebrow}>PARA SEGUIR APRENDIENDO</span>
            <h2>El código y las pruebas son del equipo.</h2>
            <p>
              Comparte esta página. Cada compañero trabaja con su identidad
              cloud y sus secretos. Un carnet del ERP no concede acceso a las
              consolas.
            </p>
          </div>
          <div>
            <a href={manualUrl} target="_blank" rel="noreferrer">
              Guía completa de la defensa <ArrowRight size={16} />
            </a>
            <a
              href={`${repository}/blob/main/docs/evidence-design-release.json`}
              target="_blank"
              rel="noreferrer"
            >
              Evidencia del despliegue <ExternalLink size={14} />
            </a>
            <a
              href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html#Welcome.FreeTier"
              target="_blank"
              rel="noreferrer"
            >
              AWS: límite Single-AZ del plan gratuito <ExternalLink size={14} />
            </a>
            <a
              href="https://docs.cloud.google.com/sql/docs"
              target="_blank"
              rel="noreferrer"
            >
              Google: motores disponibles en Cloud SQL{" "}
              <ExternalLink size={14} />
            </a>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <span>Polaris UES · Universidad de El Salvador</span>
        <span>Creado para comprender, probar y compartir.</span>
        <a href={repository}>
          ga22038 / MultiCloud <GitBranch size={14} />
        </a>
      </footer>
    </div>
  );
}
