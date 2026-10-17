"use client";

import { useState } from "react";
import { Download, Copy, ArrowRight, Check, FileUp } from "lucide-react";
import rubric from "./rubric.json";
import styles from "./StudentLab.module.css";

type Config = {
  version: number;
  name: string;
  localPort: number;
  databasePort: number;
  awsProfile: string;
  awsAccountId: string;
  gcpAccount: string;
  gcpProjectId: string;
  domainMode: string;
  domain: string;
  budgetReviewedOn: string;
  gcpTrialExpiresOn: string;
};
type Result = {
  id: string;
  status: string;
  summary: string;
  observedAt: string | null;
};
const defaults: Config = {
  version: 1,
  name: "",
  localPort: 8082,
  databasePort: 3309,
  awsProfile: "",
  awsAccountId: "",
  gcpAccount: "",
  gcpProjectId: "",
  domainMode: "none",
  domain: "",
  budgetReviewedOn: "",
  gcpTrialExpiresOn: "",
};
function save(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function Commands({ children }: { children: string }) {
  const [notice, setNotice] = useState("");
  return (
    <div className={styles.commands}>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(children);
            setNotice("Copiado");
          } catch {
            setNotice("Selecciona el texto para copiarlo");
          }
        }}
      >
        <Copy size={14} /> Copiar
      </button>
      <pre>
        <code>{children}</code>
      </pre>
      <span role="status">{notice}</span>
    </div>
  );
}
export default function StudentLab() {
  const [config, setConfig] = useState(defaults);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reportLab, setReportLab] = useState("");
  const validName =
    /^[a-z][a-z0-9-]{2,17}$/.test(config.name) &&
    !["polaris-ues", "multicloudto-practica"].includes(config.name);
  const name = validName ? config.name : "mi-carnet";
  const cloudValid =
    validName &&
    /^\d{12}$/.test(config.awsAccountId) &&
    config.awsAccountId !== "117425831688" &&
    /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(config.awsProfile) &&
    !["default", "polaris-ues"].includes(config.awsProfile) &&
    /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.gcpProjectId) &&
    config.gcpProjectId !== "project-dba46330-c40e-432b-9ad" &&
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
      config.gcpAccount,
    ) &&
    config.gcpAccount !== "developerengineer545@gmail.com";
  const domainValid =
    config.domainMode === "none" ||
    (/^(?=.{1,180}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      config.domain,
    ) &&
      ![
        "polarisenterprisesv.com",
        "multicloud.polarisenterprisesv.com",
      ].includes(config.domain));
  const portsValid =
    [config.localPort, config.databasePort].every(
      (p) => Number.isInteger(p) && p >= 1024 && p <= 65535,
    ) && config.localPort !== config.databasePort;
  const set = (key: keyof Config, value: string | number) => {
    setConfig((c) => ({ ...c, [key]: value }));
    setNotice("");
    if (["name", "awsAccountId", "gcpProjectId"].includes(key)) {
      setResults([]);
      setReportLab("");
      setNotes({});
    }
  };
  const input = (
    key: keyof Config,
    label: string,
    placeholder: string,
    type = "text",
  ) => (
    <label className={styles.field}>
      {label}
      <input
        type={type}
        value={config[key]}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) =>
          set(key, type === "number" ? Number(e.target.value) : e.target.value)
        }
      />
    </label>
  );
  async function importReport(file?: File) {
    if (!file) return;
    try {
      if (file.size > 500_000) throw Error();
      const data = JSON.parse(await file.text());
      if (
        data.version !== 1 ||
        data.lab !== config.name ||
        data.accounts?.aws !== config.awsAccountId ||
        data.accounts?.gcp !== config.gcpProjectId ||
        !Array.isArray(data.results)
      )
        throw Error();
      const rows: Result[] = [];
      for (const r of data.results) {
        if (
          !rubric.some((item) => item.id === r.id) ||
          !["pass", "fail", "pending"].includes(r.status) ||
          typeof r.summary !== "string" ||
          r.summary.length > 1000 ||
          !(
            r.observedAt === null ||
            (typeof r.observedAt === "string" &&
              Number.isFinite(Date.parse(r.observedAt)))
          )
        )
          throw Error();
        if (rows.some((row) => row.id === r.id)) throw Error();
        rows.push({
          id: r.id,
          status: r.status,
          summary: r.summary,
          observedAt: r.observedAt,
        });
      }
      setResults(rows);
      setReportLab(data.lab);
      setNotice(
        "Informe importado en este navegador. La revisión del profesor sigue siendo necesaria.",
      );
    } catch {
      setNotice(
        "Informe inválido o de otro laboratorio/cuenta. Usa informe.json creado por npm run lab -- report y conserva la misma configuración.",
      );
    }
  }
  async function importConfig(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10000) throw Error();
      const data = JSON.parse(await file.text());
      if (
        Object.keys(data).some((key) => !(key in defaults)) ||
        Object.keys(defaults).some(
          (key) => typeof data[key] !== typeof defaults[key as keyof Config],
        ) ||
        data.version !== 1
      )
        throw Error();
      setConfig(data);
      setResults([]);
      setReportLab("");
      setNotes({});
      setNotice(
        "Configuración cargada en este navegador. Revisa carnet, cuentas y dominio.",
      );
    } catch {
      setNotice(
        "Configuración inválida. Importa únicamente lab.json, sin claves ni campos adicionales.",
      );
    }
  }
  const steps = [
    "1. Mi laboratorio",
    "2. Docker local",
    "3. Mis cuentas",
    "4. Crear y desplegar",
    "5. Mis evidencias",
  ];
  return (
    <section id="mi-laboratorio" className={styles.section}>
      <div className={styles.heading}>
        <div>
          <span>CONSTRUIR DESDE CERO</span>
          <h2>Tu carnet. Tus cuentas. Tu laboratorio.</h2>
        </div>
        <p>
          Crea tu copia, entiende cada comando y comprueba sus resultados.
          Empieza en Docker; después utiliza tus propios créditos cloud.
        </p>
      </div>
      <nav className={styles.steps} aria-label="Pasos de mi laboratorio">
        {steps.map((label, i) => (
          <button
            key={label}
            aria-current={step === i ? "step" : undefined}
            onClick={() => setStep(i)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className={styles.panel}>
        {step === 0 && (
          <>
            <h3>Prepara tu copia independiente</h3>
            <p>
              Necesitas Git, Node.js 24 y Docker Desktop con contenedores Linux.
              Usa una carpeta nueva. RTK es opcional: estos comandos funcionan
              sin él.
            </p>
            <label className={styles.upload}>
              <FileUp size={18} /> Ya tengo lab.json: cargar mi configuración
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => void importConfig(e.target.files?.[0])}
              />
            </label>
            <div className={styles.fields}>
              {input("name", "Carnet o nombre del laboratorio", "ca21062")}
              {input("localPort", "Puerto web local", "8082", "number")}
              {input("databasePort", "Puerto MariaDB local", "3309", "number")}
            </div>
            <p>
              Usa entre 3 y 18 letras minúsculas, números o guiones. Si un
              puerto está ocupado, elige otro antes de iniciar.
            </p>
            <Commands>{`git clone https://github.com/ga22038/MultiCloud.git multicloud-${name}\ncd multicloud-${name}\nnpm ci`}</Commands>
            <p>
              Descarga <strong>lab.json</strong> y colócalo en esa carpeta,
              junto a package.json. Contiene configuración, nunca claves o
              contraseñas.
            </p>
            <button
              className={styles.primary}
              disabled={!validName || !portsValid}
              onClick={() => {
                save("lab.json", config);
                setNotice(
                  "Guarda lab.json en la raíz de tu clon. Luego ejecuta init.",
                );
              }}
            >
              <Download size={16} /> Descargar mi configuración local
            </button>
            <Commands>{"npm run lab -- init\nnpm run lab -- doctor"}</Commands>
            <p>
              <strong>Comprueba:</strong> proyecto Docker lab-{name}, secretos
              nuevos y puertos propios. Clonar no crea servidores ni concede
              acceso a otra cuenta.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <h3>Enciende, prueba y recupera</h3>
            <p>
              Ejecuta un comando, lee su resultado y continúa. La primera
              compilación puede tardar varios minutos.
            </p>
            <Commands>
              {
                "npm run lab -- local up\nnpm run lab -- local status\nnpm run lab -- local test"
              }
            </Commands>
            <p>
              Abre <code>http://localhost:{config.localPort}/aprender</code>.
              Espera cuatro servicios saludables y API sin sesión 401. El
              usuario admin y su contraseña nueva pertenecen a tu laboratorio;
              la clave está en el archivo privado runtime.env. No la incluyas en
              capturas.
            </p>
            <Commands>
              {"npm run lab -- local failover\nnpm run lab -- report"}
            </Commands>
            <p>
              <strong>Observa:</strong> aws-lab, luego gcp-lab y otra vez
              aws-lab. El comando detiene el primario local e intenta
              recuperarlo incluso si falla la prueba. Las aplicaciones comparten
              una MariaDB local.
            </p>
            <Commands>
              {
                "# Al terminar, conserva los datos y detén tu laboratorio:\nnpm run lab -- local down"
              }
            </Commands>
            <p>
              <strong>Explícalo:</strong> ¿qué seleccionó el respaldo?, ¿qué
              permaneció encendido?, ¿qué cambiaría si fallara MariaDB?
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <h3>Conecta tus propias cuentas</h3>
            <p>
              Instala AWS CLI, Google Cloud CLI y Terraform. Estos campos son
              identificadores públicos; las contraseñas y tokens se introducen
              únicamente en los inicios de sesión oficiales.
            </p>
            <div className={styles.fields}>
              {input("awsProfile", "Nombre de mi perfil AWS", "ca21062")}
              {input("awsAccountId", "Mi ID de cuenta AWS", "12 dígitos")}
              {input("gcpAccount", "Mi correo Google", "mi-correo@example.com")}
              {input("gcpProjectId", "Mi project ID GCP", "mi-laboratorio-123")}
            </div>
            <label className={styles.field}>
              Nombres DNS
              <select
                value={config.domainMode}
                onChange={(e) => {
                  set("domainMode", e.target.value);
                  set("domain", "");
                }}
              >
                <option value="none">Comenzar sin dominio: IP y Docker</option>
                <option value="delegated">
                  Subdominio delegado por carnet
                </option>
                <option value="own">Dominio que compré y controlo</option>
              </select>
            </label>
            {config.domainMode !== "none" &&
              input(
                "domain",
                "Mi zona DNS exclusiva, sin https",
                config.domainMode === "delegated"
                  ? `${name}.multicloud.polarisenterprisesv.com`
                  : "laboratorio.mi-dominio.com",
              )}
            <div className={styles.note}>
              {config.domainMode === "none"
                ? "Puedes crear redes, VM, VPN y réplica sin comprar dominio. Probar por HTTP/IP no acredita HTTPS ni conmutación DNS. Completa esa parte después en una nueva configuración revisada."
                : config.domainMode === "delegated"
                  ? "Solicita una subzona por carnet. Después de crear tu zona, entrega sus cuatro servidores NS al dueño del dominio. Tus máquinas y créditos siguen en tus cuentas. El subdominio no está creado por escribirlo aquí."
                  : "Puedes comprar un dominio a un registrador y administrar sus DNS. El taller no compra ni renueva dominios. También puedes delegar una subzona de un dominio que ya controlas."}
            </div>
            <div className={styles.fields}>
              {input(
                "budgetReviewedOn",
                "Revisé hoy planes y créditos (fecha UTC)",
                "",
                "date",
              )}
              {input("gcpTrialExpiresOn", "Mi prueba GCP termina", "", "date")}
            </div>
            <p>
              AWS debe conservar FREE activo; GCP debe conservar su prueba. RDS,
              VPN, NAT, IP, DNS y discos pueden consumir créditos. Revisa
              servicios, saldo y vencimiento en ambas consolas; nunca actualices
              a pago para continuar este taller.
            </p>
            <button
              className={styles.primary}
              disabled={!cloudValid || !domainValid || !portsValid}
              onClick={() => {
                save("lab.json", config);
                setNotice(
                  "Reemplaza lab.json en tu clon. Conserva el nombre y puertos del laboratorio local.",
                );
              }}
            >
              <Download size={16} /> Descargar configuración con mis cuentas
            </button>
            {cloudValid && (
              <Commands>{`aws login --profile ${config.awsProfile} --region us-east-2\ngcloud auth login ${config.gcpAccount}\nnpm run lab -- cloud identity`}</Commands>
            )}
            <p>
              El ID de AWS debe ser el tuyo y el proyecto GCP debe coincidir con
              lab.json. Las cuentas del propietario son rechazadas por esta
              ruta.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <h3>Construye una capa y compruébala</h3>
            <p>
              Trabajamos en Ohio (AWS) e Iowa (GCP). Primero prepara tus
              cuentas, sus permisos y créditos. El estado Terraform permanece
              privado en tu computadora.
            </p>
            <Commands>
              {
                "npm run lab -- cloud enable-apis\nnpm run lab -- cloud prepare\nnpm run lab -- terraform gcp-only init\nnpm run lab -- terraform gcp-only validate\nnpm run lab -- terraform gcp-only plan"
              }
            </Commands>
            <p>
              <strong>Lee el plan:</strong> nombres lab-{name}, proyecto propio,
              VM web, VM privada y red. Si corresponde a tus recursos y aceptas
              el consumo de tus créditos, aplica ese plan guardado.
            </p>
            <Commands>
              {
                "npm run lab -- terraform gcp-only apply\nnpm run lab -- terraform gcp-only outputs\n# Repite init, validate, plan y apply para aws-only; después vpn-only."
              }
            </Commands>
            <p>
              La{" "}
              <a href="/laboratorio-personal.md" download>
                guía completa
              </a>{" "}
              contiene los comandos restantes, permisos, DNS, errores frecuentes
              y cierre del laboratorio. No ejecutes los helpers antiguos del
              propietario.
            </p>
            <Commands>
              {
                "npm run lab -- cloud deploy build\nnpm run lab -- cloud access\nnpm run lab -- cloud deploy database\nnpm run lab -- cloud replica\nnpm run lab -- cloud deploy aws\nnpm run lab -- cloud deploy gcp"
              }
            </Commands>
            <p>
              La inicialización de base solo acepta una base nueva vacía. Las
              imágenes se construyen en tu equipo y se transfieren a tus VM; los
              secretos se generan de nuevo. Ambas aplicaciones usan RDS y la
              réplica GCP queda read-only.
            </p>
            {config.domainMode !== "none" && (
              <>
                <p>
                  Delega los NS de tu zona y comprueba los registros aws, gcp y
                  app. Después emite certificados propios:
                </p>
                <Commands>{"npm run lab -- cloud deploy tls"}</Commands>
              </>
            )}
            <Commands>
              {
                "npm run lab -- cloud runtime\nnpm run lab -- cloud test\nnpm run lab -- cloud replica\nnpm run lab -- report"
              }
            </Commands>
            <p>
              Después de coordinar el horario en tu laboratorio, prueba NGINX
              con <code>npm run lab -- cloud failover nginx</code>. Con dominio
              y TLS, prueba DNS con{" "}
              <code>npm run lab -- cloud failover dns</code>. Interrumpen
              temporalmente tu servicio AWS e intentan recuperarlo siempre.
              Carga, promoción y retorno siguen el guion supervisado del manual.
            </p>
          </>
        )}
        {step === 4 && (
          <>
            <h3>Demuestra cada requisito</h3>
            <p>
              La guía académica no asigna puntos. Esta lista cubre sus
              requisitos y distingue pruebas locales, verificaciones cloud y
              ensayos supervisados.
            </p>
            <Commands>{"npm run lab -- report"}</Commands>
            <label className={styles.upload}>
              <FileUp size={18} /> Importar mi informe.json
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => void importReport(e.target.files?.[0])}
              />
            </label>
            <p>
              Archivo: <code>.secrets/labs/{name}/informe.json</code>. Se lee en
              tu navegador. Solo se admite el nombre y las cuentas configuradas
              arriba. Guarda los apuntes antes de cerrar esta página.
            </p>
            <div className={styles.rubric}>
              {rubric.map((item) => {
                const r = results.find((row) => row.id === item.id);
                return (
                  <details key={item.id}>
                    <summary>
                      <span>{item.title}</span>
                      <span className={styles.badge}>
                        {r?.status === "pass"
                          ? "CLI: pasó"
                          : r?.status === "fail"
                            ? "CLI: falló"
                            : "Pendiente"}
                      </span>
                    </summary>
                    <p>
                      <strong>Guía:</strong> {item.section} ·{" "}
                      {item.scope === "local"
                        ? "Local"
                        : item.scope === "cloud"
                          ? "Cloud"
                          : "Local y cloud"}
                    </p>
                    <p>
                      <strong>Evidencia requerida:</strong> {item.expected}
                    </p>
                    <p>
                      <strong>Prueba:</strong> {item.test}
                    </p>
                    {r && (
                      <p>
                        {r.summary} ·{" "}
                        {r.observedAt
                          ? new Date(r.observedAt).toLocaleString("es-SV")
                          : "Sin ejecutar"}
                      </p>
                    )}
                    <p>
                      <strong>Pregunta del profesor:</strong> {item.question}
                    </p>
                    <label className={styles.field}>
                      Mi explicación, fecha y referencia a captura (sin
                      secretos)
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={notes[item.id] || ""}
                        onChange={(e) =>
                          setNotes((n) => ({ ...n, [item.id]: e.target.value }))
                        }
                      />
                    </label>
                  </details>
                );
              })}
            </div>
            <p>
              “CLI: pasó” reproduce el informe importado; no es una
              certificación ni acredita pruebas pendientes. Las notas manuales
              se entregan para revisión del profesor.
            </p>
            <button
              className={styles.primary}
              disabled={!validName}
              onClick={() =>
                save(`defensa-${name}.json`, {
                  version: 1,
                  lab: name,
                  accounts: {
                    aws: config.awsAccountId,
                    gcp: config.gcpProjectId,
                  },
                  importedLab: reportLab || null,
                  results,
                  notes,
                  exportedAt: new Date().toISOString(),
                  scope:
                    "Apuntes del alumno y resultados importados; pendientes sujetos a revisión del profesor.",
                })
              }
            >
              <Download size={16} /> Guardar evidencias y mis explicaciones
            </button>
          </>
        )}
        <p role="status" className={styles.status}>
          {notice}
        </p>
        <div className={styles.next}>
          <span>
            <Check size={16} /> Explica el resultado antes de avanzar.
          </span>
          {step < 4 && (
            <button onClick={() => setStep((s) => s + 1)}>
              Siguiente paso <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
