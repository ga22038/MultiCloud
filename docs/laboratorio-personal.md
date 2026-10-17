# Tu laboratorio: Docker, AWS y Google Cloud

Cada integrante utiliza su clon, cuentas, créditos, secretos, recursos y evidencias. El taller `/aprender`, sección **Mi laboratorio**, genera `lab.json` con identificadores públicos. Nunca recibe contraseñas o tokens. No copies `.secrets` ni estados de otro compañero.

Esta ruta usa AWS Ohio `us-east-2` y GCP Iowa `us-central1-a`. Conserva AWS FREE y la prueba GCP. Los recursos consumen créditos: VPN, NAT, RDS, discos, IP y DNS no son gratuitos ilimitados. El mínimo de USD15 exigido por el script es un control de entrada, **no una estimación suficiente para todo el ejercicio**. No se activa facturación de pago.

## 1. Tu clon y Docker

Instala Git, Node.js 24 y Docker Desktop con motor Linux. Desde PowerShell en una carpeta nueva, sustituye el carnet por el tuyo. RTK es opcional para compañeros; si lo tienes, antepone `rtk proxy`.

```powershell
git clone https://github.com/ga22038/MultiCloud.git multicloud-ca21062
cd multicloud-ca21062
npm ci
npm run lab -- init --name ca21062
npm run lab -- doctor
npm run lab -- local up
npm run lab -- local status
npm run lab -- local test
```

Alternativamente descarga `lab.json` del taller antes de ejecutar init. El archivo no se sobrescribe. Elige puertos libres antes de iniciar; los iniciales son 8082 y 3309. Se crea `lab-ca21062` con secretos nuevos en `.secrets/labs/ca21062/runtime.env`. No se leen credenciales ni sesiones privadas del propietario.

Abre `http://localhost:8082` y `/aprender`. Espera cuatro servicios saludables; migrate termina con código 0. La API sin sesión debe devolver 401. El usuario es `admin`; su nueva clave está en BOOTSTRAP_ADMIN_PASSWORD dentro de runtime.env. Consúltala en privado, nunca en capturas.

```powershell
npm run lab -- local failover
npm run lab -- report
# Al terminar, detén tu proyecto conservando los datos:
npm run lab -- local down
```

La prueba observa aws-lab, detiene app-primary, observa gcp-lab y recupera en finally. Si cierras la terminal, recupera con `local up`. Comparten MariaDB local: esto enseña NGINX, no replicación cloud. No uses `down -v`.

## 2. Tus identidades y créditos

Para cloud instala AWS CLI v2 compatible con `aws login`, Google Cloud CLI y Terraform 1.10 o posterior. Usa identidades propias autorizadas en tus cuentas. Necesitas permisos de EC2/VPC, RDS, IAM, ECR, S3, Route 53, Secrets Manager y SSM; en GCP, Compute/redes, IAP/OS Login, IAM, Storage, Artifact Registry y Monitoring. Un usuario del ERP no concede estos permisos.

Configura `lab.json`, conservando nombre y puertos:

```json
{
  "version": 1,
  "name": "ca21062",
  "localPort": 8082,
  "databasePort": 3309,
  "awsProfile": "ca21062",
  "awsAccountId": "TU_ID_DE_12_DIGITOS",
  "gcpAccount": "TU_CORREO_GOOGLE",
  "gcpProjectId": "TU_PROJECT_ID",
  "domainMode": "none",
  "domain": "",
  "budgetReviewedOn": "AAAA-MM-DD",
  "gcpTrialExpiresOn": "AAAA-MM-DD"
}
```

Reemplaza los marcadores. Revisa en ambas consolas créditos, servicios, cuotas y vencimiento. `budgetReviewedOn` es la fecha UTC de esa revisión; se exige el mismo día de plan/apply/despliegue. Para GCP se registra la fecha real de fin de prueba; `billingEnabled` no demuestra que sea gratuita. AWS debe reportar FREE activo y vigente. Si un servicio exige pago, registra la limitación y detén esa etapa.

```powershell
aws login --profile ca21062 --region us-east-2
gcloud auth login TU_CORREO_GOOGLE
npm run lab -- cloud identity
```

Comprueba tus identificadores. La nueva ruta limpia variables de autenticación heredadas, selecciona explícitamente tu perfil/cuenta y rechaza las identidades conocidas del propietario. No utiliza los helpers antiguos `terraform-aws.ps1`, `terraform-gcp.ps1`, `run-aws-script.ps1` o `run-gcp-script.ps1`. Usa exclusivamente `npm run lab -- ...`.

## 3. Dominio: elige antes de preparar cloud

| Modalidad           | Campos                                          | Lo que permite                                                     |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| Sin dominio         | domainMode=none, domain vacío                   | Docker, HTTP por IP, redes, VPN y réplica. TLS web/DNS pendientes. |
| Subdominio delegado | domainMode=delegated, zona exclusiva por carnet | Tus propios nombres, certificados y conmutación DNS.               |
| Dominio comprado    | domainMode=own, zona que controlas              | Controlas dominio y delegación; no se compra automáticamente.      |

No necesitas comprar un dominio para comenzar. Un subdominio prestado evita registrar otro dominio, pero no elimina consumo cloud. El dominio no comparte credenciales. Ejemplo propuesto: `ca21062.multicloud.polarisenterprisesv.com`, con nombres `aws`, `gcp` y `app` debajo. **Todavía no está delegado.**

Terraform crea la zona en tu cuenta AWS. Entrega al propietario los cuatro NS de `multicloud_nameservers` de tus outputs; él crea un registro NS del carnet en la zona padre. No entrega credenciales ni modifica la delegación del dominio completo. Comprueba `Resolve-DnsName TU_ZONA -Type NS` y después los registros A. Véase [subdominios por carnet](subdominios-alumnos.md).

Cambiar cuentas o dominio después de generar estados necesita revisión; el asistente no reasigna estados automáticamente. Decide la modalidad antes de cloud prepare.

## 4. Construir infraestructura por capas

```powershell
npm run lab -- cloud enable-apis
npm run lab -- cloud prepare
npm run lab -- terraform gcp-only init
npm run lab -- terraform gcp-only validate
npm run lab -- terraform gcp-only plan
```

Lee el plan: debe contener exclusivamente tus nombres, proyecto y recursos. Si aceptas el consumo de tus créditos, aplica ese plan:

```powershell
npm run lab -- terraform gcp-only apply
npm run lab -- terraform gcp-only outputs
npm run lab -- terraform aws-only init
npm run lab -- terraform aws-only validate
npm run lab -- terraform aws-only plan
# Revisa el plan AWS antes de aplicar.
npm run lab -- terraform aws-only apply
npm run lab -- terraform aws-only outputs
npm run lab -- terraform vpn-only init
npm run lab -- terraform vpn-only validate
npm run lab -- terraform vpn-only plan
# Revisa el plan VPN antes de aplicar.
npm run lab -- terraform vpn-only apply
```

Esperado: GCP crea VPC, VM web, VM privada, disco, NAT y auxiliares. AWS crea EC2, RDS privado, red, grupos, bucket privado, ECR y, con dominio, zona/health checks. VPN crea cuatro túneles IPsec/BGP entre redes no solapadas 10.10.0.0/16 y 10.20.1.0/24. No conectes redes de alumnos distintos sin revisar sus rangos.

`init` prepara proveedores, `validate` estructura, `plan` propone y `apply` crea/modifica. Cada apply verifica identidad, créditos, hash del plan guardado y antigüedad menor de una hora; rechaza planes con eliminación/reemplazo.

La copia Terraform está en `.secrets/labs/TU_CARNET/terraform` y usa estados **locales privados separados por root**. No copia estados del propietario. Respáldalos cifrados; no compartas ni ejecutes el mismo laboratorio desde dos computadoras. Este inicio no equivale a backend remoto colaborativo. No apliques el root superior de referencia.

## 5. Tu código, escritor y réplica

```powershell
npm run typecheck
npm run lint
npm test
npm run lab -- cloud deploy build
npm run lab -- cloud access
npm run lab -- cloud deploy database
npm run lab -- cloud replica
```

Se construyen web y migrate y se transfieren con docker save/load, sin imágenes históricas del propietario. ECR/Artifact Registry quedan disponibles para una práctica posterior; la transferencia directa no acredita publicar en esos registros.

Database acepta únicamente un RDS nuevo vacío. Genera secretos, consulta tu contraseña administrada RDS, crea esquema/usuarios y toma respaldo consistente antes de levantar aplicaciones. Compara GTID antes/después para detectar escrituras concurrentes. Restaura solo una réplica nueva e inicia GTID con TLS verificado y read-only. Un marcador bloquea repetir inicializaciones completas o parciales; si falla, revisa el log privado, no borres el marcador para forzar.

Esperado: IO/SQL Yes, errores 0, GTID, TLS y firma idéntica al primario en una ventana sin escrituras. El archivo privado rds-client.cnf queda restringido en la VM para consultas; no lo captures.

```powershell
npm run lab -- cloud deploy aws
npm run lab -- cloud deploy gcp
```

AWS recibe el paquete por su bucket privado y el rol EC2; GCP usa SCP por IAP. Los tokens AWS/Google del alumno no se envían a las VM. Las dos aplicaciones usan RDS por TLS. GCP publica backend 3000 solo en su IP privada, con firewall desde AWS para el respaldo NGINX.

Con dominio, primero delega NS y verifica A de aws/gcp/app; después:

```powershell
npm run lab -- cloud deploy tls
```

Emite certificados propios mediante ACME, activa HTTPS y redirección. El puerto 80 debe ser accesible; el desafío del dominio común se reenvía entre ambas VM. **La renovación periódica aún debe programarse y probarse:** registra vencimientos y repite la emisión antes de vencer. No se marca renovación automática como comprobada.

Sin dominio, prueba HTTP por las IP de outputs y usa datos ficticios. RDS/replicación mantienen TLS; HTTPS web/DNS siguen pendientes.

## 6. Pruebas y recuperación

```powershell
npm run lab -- cloud runtime
npm run lab -- cloud test
npm run lab -- cloud replica
npm run lab -- report
```

Runtime comprueba imágenes, contenedores y nginx -t. Test consulta endpoints propios, 401, RDS, Multi-AZ, túneles y BGP. Replica consulta la base GCP y RDS directamente. Una consulta API no prueba réplica.

Estos ensayos interrumpen temporalmente **tu laboratorio**. Coordina con quienes lo usen, confirma GCP/RDS saludables y conserva acceso a SSM:

```powershell
# Detiene app AWS y observa GCP en la URL fija AWS: NGINX backup.
npm run lab -- cloud failover nginx
# Detiene NGINX AWS y observa el dominio app: requiere DNS/TLS.
npm run lab -- cloud failover dns
```

Intentan recuperar en finally. Si se cierra la terminal o falla acceso, entra a tu EC2 por SSM y ejecuta, con tu carnet:

```bash
cd /opt/lab-ca21062
sudo docker compose --env-file site.env up -d --wait
```

NGINX backup puede mantener HTTP 200 al caer app AWS; por eso el ensayo DNS detiene NGINX. Una transición de salud no demuestra una operación completa ni RPO cero. El criterio DNS queda pendiente hasta completar escritura única y recuperación de datos.

## 7. Todos los criterios de evaluación

`app/src/learning/rubric.json` contiene 19 comprobaciones basadas en secciones/fases de la guía académica y preparación local. La guía no asigna puntos; no se inventan ponderaciones. Cada alumno empieza pendiente; evidencias históricas del equipo nunca se convierten en resultados personales.

Las verificaciones automáticas cubren identidad, Docker local, API, conmutación local, endpoints propios, TLS, RDS, estado Multi-AZ, VPN/BGP, réplica e imagen. NGINX backup tiene un ensayo ejecutable. Completa estos otros criterios con supervisión:

| Criterio         | Evidencia para cerrarlo                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DNS y operación  | UUID ficticio nuevo escrito durante conmutación, conservado una sola vez al recuperar. Tiempos de corte y operación completa, errores y caché.                          |
| Carga y lag      | Duración, concurrencia, operaciones, latencias/errores y muestreo continuo de GTID/lag. Una muestra 0 no demuestra <1 s sostenido.                                      |
| Túnel individual | Ruta/túnel propios identificados, corte controlado, continuidad SQL por otras rutas y recuperación BGP. No eliminar conexiones para improvisar.                         |
| Promoción GCP    | Respaldo, aislamiento del escritor AWS, último GTID, promoción GCP, cambio de destino, nuevas escrituras, automatización y RTO/RPO. No se ejecuta automáticamente aquí. |
| Failback         | Resincronizar AWS desde GCP promovido, conservar escrituras y cambiar con un único escritor. Volver DNS al mismo RDS no basta.                                          |
| Restauración     | Base aislada restaurada, firma y consultas verificadas; nunca sobrescribir una base activa.                                                                             |
| Multi-AZ         | MultiAZ=true o limitación/excepción documentada. El starter conserva Single-AZ y lo deja pendiente; no activa pago.                                                     |
| Informe          | Autor, commit, cuentas, fecha, comandos, capturas reales, resultados, fallos y límites.                                                                                 |

Promoción, failback, carga sostenida y corte de túnel requieren completar y validar el procedimiento personal. Tener el checklist no significa cumplirlo.

## 8. Evidencias, defensa y cierre

`npm run lab -- report` genera informe.json e informe.md en `.secrets/labs/TU_CARNET`. Registra resultados, fechas UTC, alcance e historial. Importa solamente informe.json en el taller con el mismo carnet/cuentas; añade tu explicación por requisito y descarga tus apuntes antes de cerrar la página. No tiene firma: el profesor contrasta evidencia. No subas paquetes, estados, .env, .cnf o SQL con contraseñas.

Guarda para cada prueba: autor, `git rev-parse HEAD`, fecha, comando, esperado, observado, captura, interpretación y límite. Roten ejecución/explicación/registro y después repitan individualmente.

Errores: puerto ocupado implica elegir uno libre antes de preparar; identidad incorrecta implica autenticar tu perfil; cuota/plan incompatible implica registrar la limitación sin pasar a pago; TLS inválido implica corregir DNS/certificado, nunca desactivar validación; réplica fallida implica revisar VPN/IO/SQL/CA en privado.

Al terminar revisa consumo y recursos propios. Detener VM no elimina consumo de discos, IP, NAT, VPN, RDS o DNS. Existen protecciones contra eliminación: respalda, revisa dependencias y prepara un retiro en tu cuenta antes de quitarlas. No hay borrado global automático.

El flujo cloud completo debe ensayarse con cuentas nuevas para acreditarlo de extremo a extremo. Tests de código, Terraform y Docker local no sustituyen ese ensayo ni garantizan cuotas/servicios en todas las cuentas.
