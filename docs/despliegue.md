# Despliegue multicloud

AWS y GCP están publicados y conectados por VPN, con réplica GTID, HTTPS y DNS de failover. Consultar [el despliegue real, sus pruebas y limitaciones](despliegue-aws.md). La cuenta AWS permanece FREE; los recursos consumen crédito. El objetivo Multi-AZ de la guía no se cumple: la instalación actual conserva RDS Single-AZ para respetar ese plan.

## Recursos desplegados

| AWS                                                                                       | GCP                                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| VPC `10.10.0.0/16`, subredes públicas y privadas en dos zonas.                            | VPC propia y subred `10.20.1.0/24`.                                             |
| EC2 Ubuntu, Elastic IP y acceso administrativo SSM.                                       | VM Ubuntu para aplicación, IP reservada y OS Login.                             |
| RDS MariaDB 11.4 Single-AZ, almacenamiento cifrado, respaldo y protección contra borrado. | VM privada para MariaDB, disco de datos independiente y salida por Cloud NAT.   |
| VPN Gateway y dos conexiones IPsec activas.                                               | HA VPN con dos interfaces y cuatro túneles BGP activos.                         |
| Zona Route 53, comprobaciones HTTPS y registros de failover activos.                      | Aplicación de respaldo usando el primario AWS por VPN durante operación normal. |

Los roots activos son `aws-only`, `gcp-only` y `vpn-only`, con estados independientes. El root superior conserva un diseño de referencia, con VPN y DNS opcionales; **no aplicarlo sobre esta instalación**. Sin VPN no hay conectividad privada entre nubes. Terraform instala Docker; las imágenes y secretos se entregan después mediante scripts administrativos y canales privados.

## Preparación de cuentas

1. Verificar proyecto GCP, prueba activa, créditos y permisos para Compute Engine, redes, IAM y Service Usage. Activar únicamente las API necesarias sin actualizar el plan de facturación. La VM privada requiere IAP y permisos de OS Login.
2. Autenticar AWS CLI con un perfil de trabajo. Usar permisos acotados al laboratorio. Confirmar región y disponibilidad de RDS MariaDB 11.4 y clases elegidas.
3. Autenticar `gcloud` con la cuenta autorizada. Los helpers Terraform obtienen su token temporal dentro del proceso y lo eliminan al terminar.
4. Conservar las credenciales en `.secrets/`, los backends privados y las protecciones de borrado. Los identificadores públicos del laboratorio están versionados; ningún secreto debe ir en variables Terraform.

## Revisión de Terraform

```powershell
rtk proxy terraform -chdir=infra/terraform fmt -check -recursive
rtk proxy pwsh -NoProfile -File scripts/terraform-aws.ps1 validate
rtk proxy pwsh -NoProfile -File scripts/terraform-aws.ps1 plan
rtk proxy pwsh -NoProfile -File scripts/terraform-aws.ps1 plan -Root vpn-only
rtk proxy pwsh -NoProfile -File scripts/terraform-gcp.ps1 plan
```

`validate` comprueba la configuración y el esquema de los proveedores. `plan` requiere autenticación y consulta recursos reales. Los tres planes finales no detectaron diferencias. No aplicar el root superior sobre componentes administrados por los estados separados.

Antes de aplicar, configurar un backend de estado remoto cifrado y con acceso limitado. Las claves compartidas de VPN pueden aparecer en el estado, aunque las salidas no las muestren. No subir estados o planes a Git. Las protecciones de RDS, VM y disco de datos evitan un borrado accidental; no retirarlas para resolver un error de Terraform sin revisar respaldos.

## Construir y entregar la aplicación

1. Ejecutar pruebas y construir la imagen con `Dockerfile`, target `web`.
2. Publicar una versión inmutable en el registro elegido, después de revisar esa publicación. La automatización actual comprueba compilación; no publica imágenes ni despliega.
3. Copiar `infra/compose/site.yaml` y `infra/nginx/site.conf.template` conservando su estructura relativa en cada servidor.
4. Crear un archivo de entorno privado por sitio a partir de `site.env.example`. Configurar `POLARIS_IMAGE`, sitio, orígenes HTTPS y credenciales propias de la base. No incluir tokens GitHub, AWS o Vercel en el contenedor.
5. Aprovisionar certificados TLS válidos. Cada sitio debe aceptar su hostname de comprobación y el hostname común: `aws.lab...` + `app.lab...`, o `gcp.lab...` + `app.lab...`. Montar certificados y clave solo en NGINX.
6. Instalar la CA de la base de datos y exigir validación de certificado. Ambos sitios comparten la misma `AUTH_SECRET` para conservar la sesión durante failover.
7. Inicializar el esquema con el target `migrate` y una identidad de migración separada. Dar al usuario de aplicación únicamente los permisos de `infra/mariadb/runtime-grants.sql`; esos GRANT no revocan permisos amplios previamente concedidos.
8. Deshabilitar cuentas demo y establecer contraseñas individuales antes de exposición pública. Cambiar `SEED_DEMO_USERS=false` impide crear nuevas cuentas demo, pero no desactiva cuentas existentes.
9. Habilitar `APP_WRITES_ENABLED=true` solo cuando el sitio apunte al escritor correcto y pase su revisión.

Las API quedan detrás de NGINX; no exponer el puerto 3000 ni MariaDB a Internet. En operación normal, ambos servidores usan el mismo endpoint privado RDS. La réplica GCP sigue en solo lectura y no sirve escrituras de la aplicación.

## Configurar réplica GCP

1. Montar el disco persistente de datos con permisos para MariaDB. No formatear un disco que ya contenga información.
2. Crear CA y certificado de servidor para la identidad privada de MariaDB; instalar su CA en los clientes. La instalación actual utiliza `infra/compose/gcp-replica.yaml` con IP privada, directorio persistente nuevo y certificados.
3. Crear una cuenta de replicación con TLS en RDS y mantener sus credenciales fuera del repositorio. Configurar retención de binlogs compatible con el tiempo máximo de recuperación.
4. Crear una copia consistente de `polaris_ues` que incluya esquema, usuarios de aplicación, estado y comprobantes, registrando las coordenadas GTID correctas. Transferir el respaldo por un canal privado.
5. Restaurar la copia en la instancia nueva y configurar replicación desde RDS con `MASTER_USE_GTID=slave_pos`, TLS y comprobación de certificado. Es necesario validar la compatibilidad exacta de las versiones y procedimientos RDS; no basta con añadir un contenedor vacío.
6. Replicar las tablas de aplicación, no las cuentas internas administradas de RDS. Comprobar los hilos de replicación, errores, GTID, revisión y registros de operaciones con `replication-check.sql`.
7. Registrar retraso, crecimiento de binlogs y respaldos de la réplica. Un contenedor saludable no prueba que la réplica esté actualizada.

Los scripts de aprovisionamiento documentan la restauración inicial y `CHANGE MASTER` ejecutados durante la integración. No se ejecutan automáticamente y rechazan sobrescribir una réplica existente. Promoción y failback todavía requieren ensayo; seguir el runbook de recuperación.

Referencias: [replicación GTID de MariaDB](https://mariadb.com/docs/server/ha-and-performance/standard-replication/gtid), [procedimientos de replicación RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/mysql-stored-proc-replicating.html).

## Dominio en Vercel

Si controlas un dominio propio en Vercel, puedes delegar un subdominio de laboratorio a los nameservers de Route 53. Configurar `dns_zone_name`, revisar el plan, crear la zona y después añadir únicamente los registros NS del subdominio en el proveedor del dominio. Esto no requiere mover la web existente.

Route 53 administra `aws.multicloud`, `gcp.multicloud` y `app.multicloud`, con failover para el último. Vercel conserva el dominio principal y delega únicamente `multicloud` mediante cuatro NS. El [registro de DNS y repositorio](dominio-y-repositorio.md) incluye las direcciones actuales. Un hostname `*.vercel.app` no permite delegar su zona como un dominio propio.

## Observabilidad y respaldo

La aplicación conserva auditoría de negocio y NGINX registra método, ruta, estado y duración sin cookies ni cuerpos. Route 53 y Cloud Monitoring comprueban disponibilidad; CloudWatch tiene alarmas EC2 y espacio RDS. Faltan destinatarios, logs centrales, carga y alertas de retraso. RDS conserva **un día** de backups; la API Free Tier rechazó siete. La réplica GCP ejecuta respaldo diario privado con retención de siete días, y su restauración aislada fue comprobada. Un export JSON de la interfaz no sustituye un respaldo recuperable de MariaDB.
