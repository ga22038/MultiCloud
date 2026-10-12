# Polaris UES: construir, comprobar y defender el laboratorio

Guía del equipo, 11 de octubre de 2026. Responsable del proyecto: ga22038.

El objetivo es aprender infraestructura multicloud y demostrarla con observaciones propias. El ERP es la aplicación transaccional usada para probar esa infraestructura. Las cuentas de los compañeros dentro del ERP no conceden acceso a AWS, Google Cloud, Terraform ni a los servidores.

## 1. Qué existe y qué todavía falta

La guía académica pide AWS como primario, GCP como respaldo, NGINX, MariaDB, VPN, conmutación y recuperación. No contiene una rúbrica numérica. Docker, Terraform, Next.js y GitHub Actions son herramientas elegidas para implementar y verificar el proyecto; tenerlas instaladas no demuestra los requisitos de disponibilidad.

| Requisito de la guía                                    | Estado demostrable | Prueba o diferencia                                                              |
| ------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| API HTTP con TLS, secciones 1 y 2                       | Implementado       | HTTPS y API autenticada en ambos sitios.                                         |
| Aplicación en ambas nubes, sección 2                    | Implementado       | EC2 y Compute Engine; contenedores con el mismo digest.                          |
| RDS MariaDB como escritor, secciones 1 y 4B             | Implementado       | RDS privado; ambas aplicaciones escriben en ese único destino.                   |
| MariaDB GCP read-only y GTID, sección 4B                | Implementado       | IO/SQL activos, TLS validado y modo read-only comprobados.                       |
| VPN IPsec de alta disponibilidad, fase 1                | Implementado       | Cuatro túneles y BGP; falta el ensayo de caída individual.                       |
| RDS Multi-AZ, sección 3                                 | No cumplido        | RDS Single-AZ para conservar el plan FREE.                                       |
| Upstream NGINX AWS con backup GCP, sección 4A y fase 3  | Parcial            | NGINX sirve la aplicación local. El failover multicloud actual lo hace Route 53. |
| Retraso de réplica inferior a 1 segundo, fase 2         | Parcial            | Muestras de 0 segundos; falta medición sostenida bajo carga.                     |
| Caída total AWS y promoción automatizada GCP, sección 5 | Pendiente          | Hay procedimiento, pero no automatización probada ni ensayo completo.            |
| Resincronización GCP a AWS, sección 5                   | Pendiente          | Retornar tráfico al mismo RDS no demuestra failback de datos.                    |
| Peticiones masivas y chaos engineering, fase 4          | Parcial            | Corte de aplicación medido; carga y desastre total siguen pendientes.            |
| Informe de failover, fase 4                             | Parcial            | Existe informe del corte de aplicación; faltan los escenarios anteriores.        |

Conclusión: **cumplimiento parcial**, no 100 %. No se ha eliminado todo punto único de fallo: las dos aplicaciones dependen actualmente del mismo RDS y de la conectividad hacia AWS.

La prueba histórica del corte de aplicación midió 127.677 segundos hasta la primera respuesta por GCP. Es una medición de ese ensayo, no un tiempo garantizado. La observación incluye ejecución SSM y DNS. No demuestra recuperación de la base ante una caída total de AWS.

AWS documenta que RDS Free Tier admite Single-AZ, no Multi-AZ. No cambiar de plan para ocultar esta diferencia: presentarla al ingeniero y solicitar una excepción académica o un laboratorio institucional. Google Cloud SQL ofrece MySQL, PostgreSQL y SQL Server; para MariaDB usamos Compute Engine, alternativa permitida por la guía.

## 2. Entender el recorrido antes de ejecutar comandos

En funcionamiento normal:

1. El navegador consulta DNS para `app.multicloud.polarisenterprisesv.com`.
2. Route 53 selecciona AWS si su comprobación de salud es correcta.
3. NGINX de AWS recibe HTTPS y lo envía al contenedor Next.js de AWS.
4. La API valida la sesión, los permisos y los datos; ejecuta una transacción en RDS MariaDB.
5. RDS genera binlogs. MariaDB GCP recibe y aplica cambios por GTID a través de la VPN.

Si se detiene solo la aplicación AWS, Route 53 puede dirigir el dominio común a GCP. Su API sigue escribiendo en RDS AWS por VPN. La réplica GCP no se promueve en ese escenario.

Si también se pierde RDS, GCP no puede seguir operando con la configuración actual. Harían falta aislamiento del escritor antiguo, promoción de la réplica, cambio del destino de la API y reconciliación. Esa automatización y sus pruebas están pendientes.

| Herramienta             | Qué hace aquí                                               | Dónde estudiarla                                   |
| ----------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| Terraform               | Crea redes, servidores, RDS, reglas, VPN, DNS e identidades | `infra/terraform/aws-only`, `gcp-only`, `vpn-only` |
| Docker                  | Empaqueta y ejecuta la aplicación y NGINX                   | `Dockerfile`, `infra/compose/site.yaml`            |
| NGINX                   | Termina TLS y envía HTTP al backend local                   | `infra/nginx/site.conf.template`                   |
| AWS CLI / gcloud        | Consultan o administran los servicios cloud                 | `scripts/Invoke-Aws.ps1`, `run-gcp-script.ps1`     |
| SSM / IAP               | Acceso administrativo a las máquinas                        | `run-aws-script.ps1`, `run-gcp-script.ps1`         |
| GitHub Actions          | Prueba código, SQL, Docker y Terraform                      | `.github/workflows/ci.yml`                         |
| Cloud Build y registros | Construyen y conservan imágenes versionadas                 | `cloudbuild.yaml`, Artifact Registry y ECR         |

Una imagen contiene código y dependencias; un contenedor es esa imagen ejecutándose. El digest SHA256 identifica la imagen exacta. Una VPN transporta tráfico privado cifrado; no replica datos por sí sola. GTID identifica transacciones; la réplica es asíncrona y puede retrasarse. Un respaldo permite restaurar datos y no sustituye una réplica.

## 3. Preparación y acceso del equipo

Cada compañero puede clonar el código y consultar las API de salud públicas sin conocer credenciales cloud. Para consultar las consolas necesita permisos IAM propios, por ejemplo lectura. Para detener servicios necesita permisos adicionales acordados con el propietario. No compartir sesiones de consola, contraseñas administrativas ni el directorio `.secrets`.

Antes de ejecutar un comando con `scripts/` o `infra/`, abrir en el Explorador la carpeta del clon propio: debe contener `package.json` y `scripts`. Escribir `powershell` en la barra de dirección y presionar Enter. Cada compañero tiene su propia ruta; no se requiere usar la carpeta del propietario. No ejecutar estas rutas relativas desde `C:\Windows\System32`.

```powershell
Get-Location
Test-Path .\package.json
Test-Path .\scripts\run-aws-script.ps1
```

Ambos `Test-Path` deben devolver `True`. Si devuelven `False`, corregir la carpeta o actualizar el clon antes de continuar. Copiar la línea completa, incluido `powershell`: `-NoProfile` es un parámetro y no funciona como comando independiente. `-File` indica el script local; `-ScriptPath` indica el script que el helper enviará al servidor. `./` o `.\` significa «desde la carpeta actual».

En Windows, instalar Git y PowerShell. Para trabajar con código: Node.js 24 LTS y Docker Desktop con motor Linux. Para cloud: AWS CLI v2, Google Cloud CLI y Terraform. Los comandos siguientes se escriben en PowerShell, desde la raíz del repositorio. RTK es opcional para los compañeros; si se usa, anteponer `rtk proxy` al programa.

```powershell
git clone https://github.com/ga22038/MultiCloud.git
cd MultiCloud
npm ci
```

Para administrar **el laboratorio actual**, el propietario puede iniciar su sesión temporal:

```powershell
powershell -NoProfile -File scripts/connect-aws.ps1 Login
powershell -NoProfile -File scripts/connect-aws.ps1 Identity
powershell -NoProfile -File scripts/connect-aws.ps1 Plan
gcloud auth login developerengineer545@gmail.com
```

`Login` abre autenticación, `Identity` muestra la identidad utilizada y `Plan` consulta el plan; ninguno actualiza la facturación. Un compañero con otra identidad debe usar sus propios permisos y adaptar los helpers que fijan ese correo. Las cuentas CA21062, LP21019, SE21003, SL21010 y JM21008 pertenecen a la aplicación, no al proveedor cloud.

## 4. Demostrar que hay dos despliegues reales

Abrir por separado las tres API de salud en el navegador o ejecutar:

```powershell
Invoke-RestMethod https://aws.multicloud.polarisenterprisesv.com/api/health/ready
Invoke-RestMethod https://gcp.multicloud.polarisenterprisesv.com/api/health/ready
Invoke-RestMethod https://app.multicloud.polarisenterprisesv.com/api/health/ready
```

Esperado: `status=ready`; el sitio fijo AWS dice `site=aws`, el fijo GCP dice `site=gcp` y el común normalmente dice `site=aws`. Esto comprueba respuestas HTTP, pero por sí solo no demuestra dónde se ejecutan. Contrastar con las consolas:

- **AWS:** seleccionar Ohio `us-east-2`, EC2 > Instances > `polaris-ues-app`. Ver ID `i-045241f9bd25d85b2`, estado Running e IP reservada `18.227.139.179`.
- **GCP:** seleccionar proyecto `project-dba46330-c40e-432b-9ad`, Compute Engine > VM instances. Ver `polaris-ues-gcp-app` con IP `34.122.222.237` y `polaris-ues-gcp-mariadb` sin IP pública.
- **DNS:** Route 53 > Hosted zones > `multicloud.polarisenterprisesv.com`. Ver registros fijos `aws`/`gcp` y dos registros failover para `app`, PRIMARY y SECONDARY, con health checks.

En PowerShell:

```powershell
Resolve-DnsName aws.multicloud.polarisenterprisesv.com -Type A
Resolve-DnsName gcp.multicloud.polarisenterprisesv.com -Type A
Resolve-DnsName app.multicloud.polarisenterprisesv.com -Type A
```

Relacionar las IP devueltas con las máquinas de cada consola. La configuración DNS no demuestra una conmutación: para eso hay que observar un fallo real y el cambio de respuesta.

Para comprobar Docker **dentro** de cada máquina:

```powershell
powershell -NoProfile -File scripts/run-aws-script.ps1 -ScriptPath scripts/inspect-cloud-runtime.sh
powershell -NoProfile -File scripts/run-gcp-script.ps1 -Instance polaris-ues-gcp-app -ScriptPath scripts/inspect-cloud-runtime.sh
```

El helper AWS envía un script público por SSM; el helper GCP lo ejecuta mediante SSH por IAP. El script consulta contenedores, prueba sintaxis NGINX y muestra el upstream activo. No lee claves privadas ni imprime archivos de entorno. Abrir su código antes de usarlo para entender cada instrucción.

Esperado: servicio `app` running/healthy y `nginx` running. La imagen tiene distinto nombre de registro, pero debe tener el mismo digest SHA256 en ambos servidores; contrastar con el [registro de publicación del taller](evidence-learning-release.json). `nginx -t` valida sintaxis; no demuestra por sí mismo failover. El upstream actual tiene `server app:3000`, sin backend remoto `backup`.

## 5. Demostrar privacidad, transacciones, VPN y réplica

**No llamar privadas a todas las API.** HTTPS está expuesto a Internet en 443. `/api/health/ready` es público; las API de negocio exigen sesión. La base y el tráfico de replicación están en redes privadas.

Sin iniciar sesión, desde terminal:

```powershell
curl.exe -i https://aws.multicloud.polarisenterprisesv.com/api/v1/state
curl.exe -i https://gcp.multicloud.polarisenterprisesv.com/api/v1/state
```

Esperado: HTTP 401. Después de iniciar sesión en uno de los sitios, abrir `/api/v1/session` en ese mismo dominio devuelve el usuario; `/api/v1/state` devuelve datos autorizados. Cada dominio fijo tiene su propia cookie del navegador. No grabar cookies ni contraseñas durante la demostración.

En AWS: RDS > Databases > `polaris-ues-primary` > Connectivity & security. Mostrar **Publicly accessible: No**, subredes privadas y el security group. Revisar reglas entrantes de 3306: deben limitar orígenes autorizados, no `0.0.0.0/0`. También mostrar Single-AZ, sin presentarlo como Multi-AZ.

Consulta equivalente, sin recuperar contraseñas:

```powershell
powershell -NoProfile -File scripts/Invoke-Aws.ps1 rds describe-db-instances --query 'DBInstances[].{Name:DBInstanceIdentifier,Engine:Engine,Public:PubliclyAccessible,MultiAZ:MultiAZ,Endpoint:Endpoint.Address,SecurityGroups:VpcSecurityGroups[].VpcSecurityGroupId}' --output json
```

Esperado: motor MariaDB, `Public=false`, `MultiAZ=false`. Public=false no prueba todas las reglas de red: revisar también los security groups. Un timeout desde la laptop, por sí solo, tampoco prueba aislamiento correcto.

En AWS: VPC > Site-to-Site VPN connections > Tunnel details. En GCP: Hybrid Connectivity > VPN y Cloud Routers > BGP sessions. Contrastar cuatro túneles y sesiones BGP activas. No mostrar configuraciones completas de VPN porque pueden contener claves compartidas.

Para comprobar la base GCP directamente:

```powershell
powershell -NoProfile -File scripts/run-gcp-script.ps1 -Instance polaris-ues-gcp-mariadb -ScriptPath scripts/verify-gcp-replica.sh
```

Interpretación: `Slave_IO_Running=Yes` recibe binlogs; `Slave_SQL_Running=Yes` los aplica; `Using_Gtid=Slave_Pos` usa GTID; errores 0 y TLS/certificado verificado indican una conexión correcta. El script exige read-only. La última línea compara revisión, hash, operaciones y usuarios.

En la revisión actual se comprobó revisión 9, nueve operaciones y siete usuarios. Las cifras pueden cambiar cuando el equipo escriba. **Dos API con el mismo estado no prueban la réplica**, porque ambas consultan RDS; la prueba anterior consulta MariaDB GCP.

Para una evidencia nueva de replicación: en una ventana acordada, crear un único registro ficticio identificable mediante la aplicación; volver a consultar la réplica y comprobar que avanzó su revisión y coincide el hash con el primario. Conservar el autor y no borrar auditoría. Una muestra de lag 0 no demuestra retraso inferior a un segundo bajo carga.

## 6. Ensayo manual de caída de aplicación y recuperación

**Esta prueba interrumpe temporalmente la aplicación AWS publicada.** Acordar horario, avisar al equipo y tener lista la recuperación antes de detener nada. No detener RDS, VPN ni la VM de base GCP. Aquí se demuestra fallo de aplicación, no desastre total de AWS.

Abrir dos terminales y el dominio común. Primero confirmar AWS y GCP saludables. En terminal A observar continuamente:

```powershell
powershell -NoProfile -File scripts/observe-multicloud.ps1 -Watch -Minutes 6
```

El observador hace exclusivamente GET. Muestra fecha UTC, destino consultado, HTTP, nube que atendió y tiempo de la petición. `elapsedMs` es duración HTTP, no RTO. Puede guardarse su salida con `Tee-Object` en `tmp/ensayo.jsonl`, conservando la carpeta fuera de Git.

En terminal B, solo cuando se apruebe el ensayo:

```powershell
powershell -NoProfile -File scripts/run-aws-script.ps1 -ScriptPath scripts/stop-aws-app.sh
```

El comando ejecutado en AWS es `docker compose ... stop app`. Solo detiene el contenedor de aplicación. EC2, NGINX, RDS y VPN siguen activos. Registrar la hora de solicitud del corte y la hora que devuelve el servidor; son dos medidas distintas.

Observar: el endpoint fijo AWS falla, el fijo GCP continúa ready y el común finalmente responde `site=gcp`. Route 53 tiene intervalo de 30 segundos, umbral de tres fallos y TTL de 60 segundos; cachés y detección añaden tiempo. No prometer cambio instantáneo. Si no cambia dentro del intervalo acordado, registrar el fallo y recuperar; no extender la interrupción indefinidamente.

Mientras el común indica GCP, abrir la sesión del dominio común y leer datos. Para probar escritura, acordar un registro ficticio con identificador nuevo, guardar una sola vez y registrar el UUID/comprobante y revisión. No reutilizar `UES-AWS-FAILOVER-001`: es evidencia histórica existente. El script automático antiguo rechaza repetir esa prueba.

Recuperar AWS incluso si falla la demostración:

```powershell
powershell -NoProfile -File scripts/run-aws-script.ps1 -ScriptPath scripts/recover-aws-app.sh
```

Esperar `site=aws` en el dominio común; consultar el registro creado durante el corte. Comprobar que existe una vez. Si no hubo escritura, el ensayo solo demuestra continuidad de lectura y enrutamiento. El retorno de tráfico al mismo RDS no es failback entre bases.

Registrar: fecha, versión/digest, alcance del corte, última respuesta AWS, primera respuesta GCP, primera operación completa, HTTP, revisiones, registro de prueba, recuperación y resultado. Medir RTO de operación con sus marcas temporales; no declarar RPO cero únicamente por ver el login.

## 7. Cómo se construyó y cómo aprender a replicarlo

Cada compañero debe empezar con un clon propio y un laboratorio local. Después puede reproducir GCP solamente para aprender servidor, Docker, NGINX y TLS. **Una única cuenta GCP no reproduce el requisito multicloud AWS + GCP**: para VPN, RDS primario y conmutación necesita ambos proveedores o participación en el laboratorio compartido.

Práctica local independiente:

```powershell
npm run local:init
npm run local:up
```

Abrir `http://127.0.0.1:8080`. Revisar `docker compose --env-file .secrets/runtime.env ps` y `infra/nginx/local.conf`: aquí sí existen primario y backup locales. Detener `app-primary`, comprobar `gcp-lab` y recuperarlo con `start app-primary`. Ambos usan una sola MariaDB local: esta práctica enseña NGINX/Docker, no VPN ni réplica entre nubes. `npm run local:down` detiene sin borrar el volumen.

En cuentas nuevas, crear identidades propias, revisar prueba/crédito y preparar una ficha privada con AWS account ID, GCP project ID, regiones, nombres, dominio, buckets de estado, IP de GCP, endpoint RDS y referencias de imagen. Las credenciales se generan nuevamente; no se copian `.secrets`, certificados, SQL, planes ni estados del propietario.

**El repositorio actual es un despliegue concreto, no una plantilla universal lista para aplicar.** Antes de provisionar otra cuenta hay que adaptar:

| Archivo o grupo                                          | Qué sustituir en la copia propia                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `aws-only/versions.tf`, `vpn-only/versions.tf`           | Account ID permitido, buckets/keys de estado, proyecto GCP y región.               |
| `aws-only/deployment.tf`                                 | Bucket de transferencia propio y globalmente único.                                |
| `aws-only/dns.tf`, `gcp-only/monitoring.tf`              | Dominio propio e IP reservada del nuevo servidor GCP.                              |
| Helpers `terraform-*`, `run-*`, `connect-aws`            | Perfil, cuenta, correo, proyecto, región/zona e instance ID propios.               |
| Scripts de secretos, certificados, DNS, build e imágenes | Buckets, registros, nombres, dominio, correo ACME e imágenes propios.              |
| Scripts de réplica y restauración                        | Endpoint RDS, red permitida, CA validada, GTID y respaldo de la nueva instalación. |

No reemplazar todas las direcciones numéricas sin comprenderlas: conservar redes privadas no solapadas y pares BGP compatibles. No eliminar `allowed_account_ids`; cambiarlo por la cuenta propia. Revisar AMI si se cambia de región. `rg` o Buscar en archivos permite localizar referencias originales a cuenta, proyecto, dominio e IP.

Secuencia de construcción, con una comprobación antes de pasar al siguiente paso:

1. **Estado y permisos:** crear buckets propios privados/versionados para Terraform y sus identidades. Habilitar las API GCP requeridas. Conservar el plan gratuito/de prueba; si un servicio exige pago, detener esa parte.
2. **GCP:** adaptar `gcp-only`, ejecutar init/validate/plan, revisar el plan y aplicar en la cuenta propia. Comprobar red, firewall, VM web, VM DB privada, Cloud NAT y registros/buckets. Guardar la IP resultante.
3. **AWS:** adaptar `aws-only` con cuenta/dominio/IP nuevos. Inicializar su estado propio, revisar plan y aplicar. Comprobar VPC, subredes, EC2, RDS, grupos de seguridad, ECR y DNS. RDS FREE seguirá Single-AZ.
4. **VPN:** adaptar `vpn-only` para leer exclusivamente el estado AWS propio y la VPC GCP propia. Aplicar, comprobar cuatro túneles, BGP, rutas privadas y conectividad SQL autorizada.
5. **Imagen:** ejecutar pruebas; construir web/migración con `Dockerfile`, publicar en los registros propios y comparar digest. `cloudbuild.yaml` recibe referencias de imagen mediante sustituciones. No copiar un digest antiguo como si fuera una compilación nueva.
6. **Primer escritor:** preparar una base nueva con credenciales propias y permisos mínimos. La migración crea tablas y datos iniciales. No ejecutar una importación inicial sobre una base activa existente.
7. **Aplicaciones:** preparar Compose en ambos servidores con sus secretos privados. En la arquitectura final ambas API apuntan a RDS por conexión TLS; GCP usa la VPN. No usar el usuario root de MariaDB en la API.
8. **Réplica:** tomar respaldo consistente del RDS propio y registrar GTID; restaurarlo solo en la réplica nueva, configurar el usuario restringido de replicación y CA, iniciar GTID y exigir read-only. Estudiar `setup-gcp-replica.mjs`, `activate-gcp-replica.sh` y `verify-gcp-replica.sh` antes de adaptar.
9. **HTTPS/DNS:** usar un dominio propio, certificados propios y renovación. Crear health checks y PRIMARY/SECONDARY. No delegar el dominio del propietario ni conservar IP antiguas.
10. **Evidencia y cierre:** realizar los ensayos de secciones 4 a 6; medir carga y recuperación pendientes. Guardar evidencias sin secretos. Retirar recursos propios al terminar después de respaldar y revisar dependencias.

Terraform `init` prepara proveedores/estado; `validate` verifica estructura; `plan` muestra cambios previstos; `apply` ejecuta esos cambios y puede generar consumo. Consultar no equivale a crear. Los tres roots se aplican separadamente; no aplicar el root superior de referencia encima de sus estados. Los wrappers del propietario contienen valores fijos y deben adaptarse antes de usar cuentas nuevas.

Para estudiar sin aplicar: leer `.tf`, ejecutar `terraform init -backend=false` y `terraform validate` en un clon de práctica; revisar GitHub Actions. Esto no despliega recursos ni acredita que existan. Antes de un `apply`, demostrar que identidad, estado y plan pertenecen al compañero.

## 8. Guion de defensa y próximos ensayos

Una defensa de 15 minutos puede repartirse así: arquitectura y alcance (2), servidores/digest (3), API y RDS privado (2), VPN/GTID (3), corte de aplicación y recuperación (4), diferencias pendientes (1). Cada integrante debe poder explicar un comando, su salida esperada y qué NO demuestra.

Preguntas y respuestas verificables:

- **¿Cómo sé que corre en dos nubes?** IP/DNS, recursos de las dos consolas y contenedores inspeccionados remotamente; no solo dos pestañas iguales.
- **¿Dónde entra la API?** NGINX recibe HTTPS; Next.js sirve rutas `app/src/app/api/v1`; el backend valida y escribe mediante `app/src/server/repository.ts`.
- **¿Por qué MariaDB si guardan JSON?** El estado de negocio es un agregado JSON en `application_state`, con bloqueo y transacción InnoDB. Usuarios y operaciones son tablas independientes. No hay una tabla SQL independiente por cada pantalla; es una limitación académica documentada.
- **¿NGINX conmuta entre nubes hoy?** No. Route 53 selecciona la nube; NGINX publicado tiene un upstream local. El backup de NGINX existe en el laboratorio local, no prueba multicloud.
- **¿Si desaparece toda AWS sigue GCP?** No con la configuración actual. El escritor sigue en AWS; la promoción GCP y el cambio de destino están pendientes.
- **¿Por qué no Multi-AZ?** Restricción del plan FREE conservado. La guía lo pide; es una diferencia explícita, no un cumplimiento equivalente.
- **¿Cómo evitan duplicados?** UUID de operación y comprobante dentro de la transacción. No reenviar a ciegas una escritura incierta; revisar el historial del escritor y de la réplica.

Para cerrar la guía: ensayar NGINX con backend remoto backup; medir carga/lag; automatizar promoción con aislamiento comprobado; ensayar pérdida RDS y failback conservando escrituras GCP; resolver Multi-AZ con el evaluador. Hacer esas prácticas en un laboratorio separado o ventana aprobada, no como un apagado improvisado durante la defensa.

## 9. Fuentes y evidencias para contrastar

- Guía académica aportada: secciones 1 a 6, siete páginas. Se utiliza como criterio de revisión, no como permiso para cambiar infraestructura.
- [Arquitectura del repositorio](arquitectura.md), [despliegue AWS](despliegue-aws.md), [recuperación](recuperacion.md) y [evaluación](evaluacion.md).
- [Ensayo histórico de aplicación](evidence-app-failover.json), [verificación de réplica/restauración](evidence-multicloud-verification.json), [usuarios y revisión 9](evidence-team-release.json), [publicación actual](evidence-design-release.json).
- [CI de la versión desplegada](https://github.com/ga22038/MultiCloud/actions/runs/38187019731).
- [Publicación del taller y corrección de sesión](evidence-learning-release.json), con [CI de esta actualización](https://github.com/ga22038/MultiCloud/actions/runs/38188876402).
- [AWS: restricciones RDS Free Tier](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html#Welcome.FreeTier).
- [Google: motores Cloud SQL](https://docs.cloud.google.com/sql/docs).
- [NGINX: upstream y backup](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server).

Comprobaciones repetidas durante esta revisión: ambas API saludables y misma revisión 9; RDS Public=false/MultiAZ=false; réplica GCP read-only con GTID, IO/SQL Yes, TLS validado y muestra de lag 0; ambas máquinas ejecutan el mismo digest. No se detuvo ningún servicio ni se ejecutó un nuevo ensayo de desastre en esta revisión.
