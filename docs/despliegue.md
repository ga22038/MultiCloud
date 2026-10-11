# Despliegue multicloud

Estos pasos preparan un despliegue revisable. Todavía no se ejecutaron en AWS/GCP. Crear RDS Multi-AZ, máquinas, VPN, NAT, direcciones y comprobaciones DNS puede generar cargos; revisar el plan y las condiciones de las cuentas antes de aplicar.

## Recursos definidos

| AWS                                                                                      | GCP                                                                             |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| VPC `10.10.0.0/16`, subredes públicas y privadas en dos zonas.                           | VPC propia y subred `10.20.1.0/24`.                                             |
| EC2 Ubuntu, Elastic IP y acceso administrativo SSM.                                      | VM Ubuntu para aplicación, IP reservada y OS Login.                             |
| RDS MariaDB 11.4 Multi-AZ, almacenamiento cifrado, respaldo y protección contra borrado. | VM privada para MariaDB, disco de datos independiente y salida por Cloud NAT.   |
| VPN Gateway y dos conexiones IPSec opcionales.                                           | HA VPN con dos interfaces y cuatro túneles BGP opcionales.                      |
| Zona Route 53, comprobaciones HTTPS y registros de failover opcionales.                  | Aplicación de respaldo usando el primario AWS por VPN durante operación normal. |

`enable_vpn=false` y `dns_zone_name=""` omiten esos componentes por defecto. Sin VPN no hay conectividad privada entre nubes. Las máquinas instalan Docker; no descargan una imagen privada ni reciben secretos mediante Terraform.

## Preparación de cuentas

1. Verificar proyecto GCP, facturación y permisos para Compute Engine, redes, IAM y Service Usage. Activar las API necesarias. El acceso a la VM privada requiere IAP u otro acceso privado autorizado y los permisos de OS Login correspondientes.
2. Autenticar AWS CLI con un perfil de trabajo. Usar permisos acotados al laboratorio. Confirmar región y disponibilidad de RDS MariaDB 11.4 y clases elegidas.
3. Autenticar `gcloud` y configurar Application Default Credentials para Terraform.
4. Completar los identificadores públicos y tu IP administrativa `/32` en un archivo privado `terraform.tfvars`. Los secretos no van allí.

## Revisión de Terraform

```powershell
rtk terraform -chdir=infra/terraform init -backend=false
rtk terraform -chdir=infra/terraform fmt -check -recursive
rtk terraform -chdir=infra/terraform validate
rtk terraform -chdir=infra/terraform plan
```

`validate` comprueba la configuración y el esquema de los proveedores. `plan` requiere autenticación y consulta recursos reales. La validación local no confirma cuotas, disponibilidad regional, rutas BGP ni capacidad de la cuenta. No se ejecutó `plan` ni `apply` durante la adaptación.

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
2. Crear CA y certificado de servidor para la identidad privada de MariaDB; instalar su CA en los clientes. Desplegar `infra/compose/replica.yaml` con IP privada, directorio persistente y certificados.
3. Crear una cuenta de replicación con TLS en RDS y mantener sus credenciales fuera del repositorio. Configurar retención de binlogs compatible con el tiempo máximo de recuperación.
4. Crear una copia consistente de `polaris_ues` que incluya esquema, usuarios de aplicación, estado y comprobantes, registrando las coordenadas GTID correctas. Transferir el respaldo por un canal privado.
5. Restaurar la copia en la instancia nueva y configurar replicación desde RDS con `MASTER_USE_GTID=slave_pos`, TLS y comprobación de certificado. Es necesario validar la compatibilidad exacta de las versiones y procedimientos RDS; no basta con añadir un contenedor vacío.
6. Replicar las tablas de aplicación, no las cuentas internas administradas de RDS. Comprobar los hilos de replicación, errores, GTID, revisión y registros de operaciones con `replication-check.sql`.
7. Registrar retraso, crecimiento de binlogs y respaldos de la réplica. Un contenedor saludable no prueba que la réplica esté actualizada.

El repositorio no ejecuta automáticamente restauración, `CHANGE MASTER`, promoción ni failback. Estas acciones dependen del respaldo consistente, las posiciones GTID y la verificación del escritor; seguir el runbook de recuperación.

Referencias: [replicación GTID de MariaDB](https://mariadb.com/docs/server/ha-and-performance/standard-replication/gtid), [procedimientos de replicación RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/mysql-stored-proc-replicating.html).

## Dominio en Vercel

Si controlas un dominio propio en Vercel, puedes delegar un subdominio de laboratorio a los nameservers de Route 53. Configurar `dns_zone_name`, revisar el plan, crear la zona y después añadir únicamente los registros NS del subdominio en el proveedor del dominio. Esto no requiere mover la web existente.

Los registros definidos son `aws.<zona>`, `gcp.<zona>` y `app.<zona>`. El último usa failover y comprobaciones de `/api/health/ready`. Primero instalar TLS válido y verificar ambos sitios. No se modificó Vercel ni el DNS durante esta adaptación. Si solo tienes un hostname `*.vercel.app`, no puedes delegar su zona como si fuera un dominio propio.

## Observabilidad y respaldo

La aplicación conserva auditoría de negocio y registra errores con referencias; NGINX registra método, ruta, estado y duración sin cookies ni cuerpos. Falta conectar la recolección y alertas cloud: disponibilidad de ambos sitios, latencia, errores 5xx, lag de replicación, espacio, binlogs y respaldos. RDS conserva siete días de backups en la configuración; la VM MariaDB necesita un plan de backup y pruebas de restauración propios. Un export JSON desde la interfaz no sustituye un respaldo recuperable de MariaDB.
