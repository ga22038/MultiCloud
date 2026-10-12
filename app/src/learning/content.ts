export const repository = "https://github.com/ga22038/MultiCloud";
export const manualUrl = `${repository}/blob/main/docs/taller-multicloud.md`;
export const requirements = [
  [
    "API + HTTPS en AWS y GCP",
    "Implementado",
    "Endpoints autenticados y dos despliegues comprobados.",
  ],
  [
    "RDS privado + réplica MariaDB GTID",
    "Implementado",
    "Réplica read-only, VPN y TLS verificado. Lag 0 observado en muestras.",
  ],
  [
    "VPN IPsec / BGP",
    "Implementado",
    "Cuatro túneles. El corte individual de túneles sigue sin ensayarse.",
  ],
  [
    "RDS Multi-AZ",
    "Pendiente",
    "El plan FREE conserva Single-AZ. Requiere resolver la excepción con el evaluador.",
  ],
  [
    "NGINX con backup remoto GCP",
    "Parcial",
    "NGINX publicado usa un backend local. Route 53 hace la conmutación entre nubes.",
  ],
  [
    "Lag < 1 s bajo carga",
    "Pendiente",
    "Una muestra de cero segundos no acredita el objetivo sostenido.",
  ],
  [
    "Promoción GCP y failback de datos",
    "Pendiente",
    "Falta automatización y ensayo ante pérdida completa de AWS/RDS.",
  ],
  [
    "Carga e informe de desastre",
    "Parcial",
    "Existe un corte de aplicación medido en 127.677 s; falta el desastre total.",
  ],
] as const;

export type Lesson = {
  id: string;
  track: "probar" | "replicar";
  title: string;
  goal: string;
  steps: string[];
  command: string;
  expected: string;
  limit: string;
  risk?: string;
};
export const lessons: Lesson[] = [
  {
    id: "http",
    track: "probar",
    title: "Encontrar las dos nubes",
    goal: "Relacionar una respuesta HTTP con una máquina real.",
    steps: [
      "Abre AWS en Ohio: EC2 > Instances > polaris-ues-app. Anota su IP.",
      "Abre GCP: Compute Engine > VM instances > polaris-ues-gcp-app. Anota su IP.",
      "Consulta los endpoints fijos y compara DNS con esas IP. El dominio app selecciona una nube.",
    ],
    command:
      "Invoke-RestMethod https://aws.multicloud.polarisenterprisesv.com/api/health/ready\nInvoke-RestMethod https://gcp.multicloud.polarisenterprisesv.com/api/health/ready\nResolve-DnsName app.multicloud.polarisenterprisesv.com -Type A",
    expected:
      "AWS devuelve site=aws; GCP devuelve site=gcp. Contrasta las IP con las consolas.",
    limit:
      "Dos páginas iguales no prueban dos despliegues. Una consulta de salud tampoco prueba recuperación de datos.",
  },
  {
    id: "docker",
    track: "probar",
    title: "Ver Docker y NGINX dentro del servidor",
    goal: "Comprobar el código que realmente se está ejecutando.",
    steps: [
      "Abre PowerShell desde la carpeta de tu clon y comprueba que Test-Path .\\scripts\\run-aws-script.ps1 devuelve True. No uses C:\\Windows\\System32.",
      "Lee scripts/inspect-cloud-runtime.sh. Consulta contenedores y configuración pública; no imprime secretos.",
      "El helper AWS ejecuta el script por Systems Manager. El de GCP usa SSH por IAP.",
      "Compara el digest de la imagen app en ambos servidores; el nombre del registro puede ser distinto.",
    ],
    command:
      "powershell -NoProfile -File .\\scripts\\run-aws-script.ps1 -ScriptPath .\\scripts\\inspect-cloud-runtime.sh\npowershell -NoProfile -File .\\scripts\\run-gcp-script.ps1 -Instance polaris-ues-gcp-app -ScriptPath .\\scripts\\inspect-cloud-runtime.sh",
    expected:
      "app running/healthy, nginx running y el mismo sha256 en ambas nubes. nginx -t correcto.",
    limit:
      "El upstream publicado muestra app:3000. No contiene un backup remoto. Estas consultas requieren tu identidad cloud, no el carnet del ERP.",
  },
  {
    id: "private",
    track: "probar",
    title: "Distinguir API protegida y base privada",
    goal: "Mostrar qué está expuesto y qué está aislado.",
    steps: [
      "Consulta /api/v1/state sin iniciar sesión; espera HTTP 401.",
      "En RDS > polaris-ues-primary > Connectivity & security muestra Publicly accessible: No.",
      "Revisa además las reglas entrantes del security group: 3306 limitado a orígenes autorizados.",
    ],
    command:
      "curl.exe -i https://aws.multicloud.polarisenterprisesv.com/api/v1/state\npowershell -NoProfile -File scripts/Invoke-Aws.ps1 rds describe-db-instances --query 'DBInstances[].{Engine:Engine,Public:PubliclyAccessible,MultiAZ:MultiAZ}' --output json",
    expected: "API sin sesión: 401. RDS: Public=false y MultiAZ=false.",
    limit:
      "La API HTTPS es pública y autenticada; RDS es privado. Un timeout desde tu laptop no basta para demostrar seguridad.",
  },
  {
    id: "replica",
    track: "probar",
    title: "Leer la réplica, no la otra API",
    goal: "Demostrar que la base GCP recibe las transacciones.",
    steps: [
      "AWS: VPC > Site-to-Site VPN > Tunnel details. GCP: Hybrid Connectivity > VPN y Cloud Routers > BGP.",
      "Ejecuta el verificador directamente en la VM de base GCP.",
      "Interpreta IO (recibe), SQL (aplica), GTID, read-only, errores y TLS. Contrasta revisión y hash con el primario.",
    ],
    command:
      "powershell -NoProfile -File scripts/run-gcp-script.ps1 -Instance polaris-ues-gcp-mariadb -ScriptPath scripts/verify-gcp-replica.sh",
    expected:
      "IO y SQL Yes; errores 0; GTID Slave_Pos; TLS verificado; REPLICA_OK. La última línea contiene revisión:hash:operaciones:usuarios.",
    limit:
      "Las dos API consultan el mismo RDS. Compararlas no prueba la réplica. Lag 0 es una muestra, no una garantía bajo carga.",
  },
  {
    id: "failure",
    track: "probar",
    title: "Ensayar el corte de aplicación",
    goal: "Observar el cambio real de AWS a GCP y recuperar AWS.",
    steps: [
      "Acordar ventana con el equipo. Primero confirmar GCP y RDS saludables y tener la recuperación preparada.",
      "Terminal A: ejecuta el observador. Terminal B: ejecuta stop-aws-app.sh mediante SSM cuando se apruebe el corte.",
      "Espera que AWS falle, GCP siga ready y app pase a site=gcp. Lee los datos desde el dominio común.",
      "Recupera con recover-aws-app.sh incluso si el ensayo falla. Espera site=aws. Registra horarios y resultado.",
    ],
    command:
      "# Terminal A: solo observar\npowershell -NoProfile -File scripts/observe-multicloud.ps1 -Watch -Minutes 6\n\n# Terminal B: corte autorizado de aplicación\npowershell -NoProfile -File scripts/run-aws-script.ps1 -ScriptPath scripts/stop-aws-app.sh\n\n# Recuperar siempre\npowershell -NoProfile -File scripts/run-aws-script.ps1 -ScriptPath scripts/recover-aws-app.sh",
    expected:
      "Endpoint fijo AWS falla; fijo GCP sigue disponible; el común cambia a GCP y vuelve a AWS tras recuperar.",
    limit:
      "No detiene RDS ni VPN. No demuestra caída total de AWS ni failback de base. elapsedMs del observador es tiempo HTTP, no RTO.",
    risk: "Este comando interrumpe temporalmente la aplicación publicada. No ejecutarlo sin acordar horario y recuperación. Los botones de esta página nunca lo ejecutan.",
  },
  {
    id: "local",
    track: "replicar",
    title: "Construir un laboratorio local",
    goal: "Entender imagen, contenedor y upstream antes de gastar crédito cloud.",
    steps: [
      "Instala Git, Node.js 24 LTS y Docker Desktop con motor Linux. Clona el repositorio en tu carpeta propia.",
      "local:init genera secretos nuevos en .secrets/runtime.env. El administrador local es admin; no hereda cuentas del equipo.",
      "local:up construye imagen y arranca MariaDB, dos aplicaciones y NGINX. Abre localhost:8080.",
      "Detén app-primary en tu laboratorio y observa gcp-lab. Recupéralo con start app-primary.",
    ],
    command:
      "git clone https://github.com/ga22038/MultiCloud.git\ncd MultiCloud\nnpm ci\nnpm run local:init\nnpm run local:up\n# Practicar solo en tu laboratorio local:\ndocker compose --env-file .secrets/runtime.env stop app-primary\ndocker compose --env-file .secrets/runtime.env start app-primary",
    expected:
      "NGINX local sirve el backup cuando el primario se detiene. Las dos aplicaciones comparten MariaDB local.",
    limit:
      "Esta práctica no replica datos entre AWS y GCP. No copies .secrets del propietario ni borres volúmenes para repetirla.",
  },
  {
    id: "accounts",
    track: "replicar",
    title: "Preparar cuentas e identidades propias",
    goal: "Crear un laboratorio separado del proyecto del equipo.",
    steps: [
      "Para reproducir multicloud necesitas AWS y GCP. Solo GCP permite una primera práctica de servidor/API, no todo el requisito.",
      "Revisa créditos y vencimiento. Conserva el plan FREE/prueba; disponibilidad de crédito no garantiza servicio gratuito.",
      "Usa un perfil AWS y proyecto GCP propios. Los carnets del ERP no son permisos IAM.",
      "Define estados/buckets privados propios, dominio o nombres DNS y secretos generados nuevamente.",
    ],
    command:
      "aws sts get-caller-identity --profile TU_PERFIL --region us-east-2\ngcloud config get-value project\n# Sustituye los marcadores por tus valores antes de ejecutar.",
    expected:
      "La identidad y proyecto deben pertenecer a tu laboratorio. No deben mostrar las cuentas del propietario por accidente.",
    limit:
      "No hay un despliegue universal de un clic. El repositorio tiene referencias concretas que debes adaptar antes de apply.",
  },
  {
    id: "terraform",
    track: "replicar",
    title: "Adaptar Terraform antes de aplicar",
    goal: "Aprender qué crea plan/apply y dónde guarda el estado.",
    steps: [
      "En aws-only y vpn-only sustituye cuenta permitida, buckets y keys de estado. En gcp-only establece tu project_id.",
      "Adapta el proyecto GCP del VPN, dominio, IP del nuevo servidor, bucket de transferencia y helpers con correo/IDs fijos.",
      "Provisiona GCP, luego AWS y finalmente VPN. Cada root tiene estado propio; VPN lee el estado AWS de tu cuenta.",
      "Revisa el plan en detalle antes de apply. No apliques el root superior sobre los estados activos.",
    ],
    command:
      "# Validar estructura en tu clon; no aprovisiona:\nterraform -chdir=infra/terraform/gcp-only init -backend=false\nterraform -chdir=infra/terraform/gcp-only validate\n\n# init prepara; plan muestra; apply crea/modifica recursos.\n# El apply de cuentas nuevas requiere adaptación previa.",
    expected:
      "validate comprueba sintaxis. El futuro plan debe referirse a tus cuentas y estados propios.",
    limit:
      "validate no demuestra infraestructura existente. Los wrappers terraform-aws/terraform-gcp actuales contienen valores del propietario.",
  },
  {
    id: "deploy",
    track: "replicar",
    title: "Unir imagen, escritor y réplica",
    goal: "Construir el mismo recorrido de datos en tu infraestructura.",
    steps: [
      "Ejecuta pruebas y construye Dockerfile. Publica tu imagen en Artifact Registry y ECR; compara digest.",
      "Inicializa una base nueva con permisos mínimos. Configura ambas aplicaciones para usar el mismo escritor RDS por TLS.",
      "Haz un respaldo consistente del RDS propio y registra GTID. Restaura únicamente en la réplica GCP nueva.",
      "Configura usuario de replicación, VPN, certificado CA y read-only. Inicia GTID y verifica IO/SQL antes de activar DNS.",
    ],
    command:
      "npm run typecheck\nnpm run lint\nnpm test\nnpm run build\n# Lee Dockerfile, cloudbuild.yaml y scripts/setup-gcp-replica.mjs.\n# Adapta registros, endpoint, credenciales y GTID a tu cuenta.",
    expected:
      "Mismo digest de aplicación; RDS como único escritor; réplica GCP read-only conectada por VPN/TLS.",
    limit:
      "No reejecutes scripts de importación sobre bases activas. No copies digests, SQL o credenciales antiguas como configuración nueva.",
  },
  {
    id: "domain",
    track: "replicar",
    title: "Resolver HTTPS y DNS sin comprar a ciegas",
    goal: "Separar una práctica por IP de la arquitectura completa de la guía.",
    steps: [
      "Localhost funciona sin dominio. En una VM propia puedes probar HTTP/API por IP con datos ficticios.",
      "Para reproducir la configuración actual de HTTPS/DNS necesitas controlar nombres DNS; puede ser un subdominio cedido por el equipo.",
      "Cada laboratorio requiere sus IP, certificados y health checks. El dueño de DNS debe crear/delegar esos nombres.",
      "Una URL run.app o vercel.app puede servir una aplicación en ese proveedor; no reemplaza automáticamente Route 53, EC2, VPN ni RDS.",
    ],
    command:
      "# Práctica local sin dominio:\nInvoke-RestMethod http://127.0.0.1:8080/api/health/ready\n\n# VM propia: sustituir IP antes de usar (solo práctica HTTP).\n# Invoke-RestMethod http://TU_IP/api/health/ready",
    expected:
      "Pueden practicar sin comprar un dominio. Para la defensa completa deben resolver TLS y conmutación de nombres DNS.",
    limit:
      "Los scripts actuales de certificados usan nombres de dominio. HTTP por IP no cumple el requisito TLS de la guía.",
  },
];
