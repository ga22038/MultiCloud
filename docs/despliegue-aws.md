# Polaris UES en AWS y Google Cloud

Configurado el 11 de octubre de 2026. Responsable: **ga22038**.

## Acceso y plan

- Dominio común: https://app.multicloud.polarisenterprisesv.com
- Aplicación AWS: https://aws.multicloud.polarisenterprisesv.com
- Aplicación GCP: https://gcp.multicloud.polarisenterprisesv.com
- Usuario personal: `ga22038`, rol Administrador. Su contraseña se conserva únicamente en el archivo privado local solicitado por el propietario.
- Cuenta AWS: `117425831688`; región Ohio, `us-east-2`; perfil CLI `polaris-ues`.

La API Free Tier confirmó el plan **FREE / ACTIVE**, con vencimiento el **26 de marzo de 2027**. La consulta posterior al aprovisionamiento mostró **USD131.38** de crédito. Es una lectura fechada, no una garantía de saldo futuro. No se ejecutó ninguna actualización a pago ni cambios de facturación.

Los recursos consumen crédito. El plan FREE termina al agotarlo o vencer el plazo. El script Terraform comprueba cuenta, plan activo y saldo mínimo de USD15 antes de planificar o aplicar. Esta comprobación no constituye un límite de consumo: los recursos ya activos siguen consumiendo crédito hasta detenerlos o retirarlos de forma controlada. La prueba GCP mostrada por el propietario vence el **23 de octubre de 2026**; conservar respaldos locales antes de esa fecha.

**Diferencia obligatoria frente a la guía:** RDS es `db.t4g.micro`, **Single-AZ**, con un día de retención automática. La documentación de RDS limita el Free Tier a Single-AZ. Además, la API rechazó concretamente la retención de siete días con `FreeTierRestrictionError`. No se intentó resolverlo cambiando de plan. El requisito académico **RDS Multi-AZ permanece pendiente**.

Referencias: [plan gratuito de AWS](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html), [límites de RDS Free Tier](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html#Welcome.FreeTier).

## Infraestructura real

| Componente       | Configuración                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red AWS          | VPC `10.10.0.0/16`; dos subredes públicas y dos privadas, repartidas entre Ohio a/b.                                                                                |
| Aplicación       | EC2 `i-045241f9bd25d85b2`, Ubuntu 24.04, t3.small, disco gp3 cifrado de 20 GB; IP reservada `18.227.139.179`.                                                       |
| Administración   | Systems Manager con identidad de instancia; sin puerto SSH público; IMDSv2 obligatorio.                                                                             |
| Base principal   | RDS `polaris-ues-primary`, MariaDB 11.4.13, db.t4g.micro, 20 GB gp3 cifrados, Single-AZ, acceso privado y TLS obligatorio.                                          |
| RDS endpoint     | `polaris-ues-primary.cra082c8am0l.us-east-2.rds.amazonaws.com`; no usar su IP como dirección persistente.                                                           |
| Seguridad SQL    | Aplicación con permisos por tabla; usuario de replicación limitado a origen `10.20.1.%`, con `REQUIRE SSL`.                                                         |
| Secretos RDS     | Contraseña administrativa gestionada por Secrets Manager. Nunca se guardó en Terraform ni en Git.                                                                   |
| Imágenes         | ECR privado e inmutable; la copia desde Artifact Registry conserva ambos digest originales.                                                                         |
| Estado Terraform | S3 privado, cifrado y versionado, con bloqueo nativo; claves separadas `polaris-ues/aws` y `polaris-ues/vpn`.                                                       |
| Transferencias   | Bucket S3 privado y cifrado, archivos temporales con ciclo de vida de un día; nunca URLs públicas.                                                                  |
| VPN              | Dos conexiones AWS Site-to-Site, cuatro túneles IKEv2/BGP y HA VPN GCP con dos interfaces.                                                                          |
| Rutas            | AWS anuncia su VPC; GCP anuncia únicamente `10.20.1.0/24`. Los cuatro túneles reportaron UP y una ruta recibida.                                                    |
| Réplica          | MariaDB GCP en `10.20.1.3`, `read_only=1`, GTID `Slave_Pos`, TLS y verificación de identidad del servidor RDS.                                                      |
| DNS              | Solo `multicloud.polarisenterprisesv.com` se delega a Route 53; el dominio principal conserva Vercel.                                                               |
| Disponibilidad   | Route 53 comprueba `/api/health/ready` por HTTPS, intervalo 30 s y tres fallos; A con TTL 60 s.                                                                     |
| Monitoreo        | Dos health checks Route 53, Cloud Monitoring GCP y alarmas CloudWatch de estado EC2 y espacio libre RDS. Las alarmas no tienen destinatarios externos configurados. |

Terraform administra **38 recursos AWS**, **23 recursos de VPN entre proveedores** y **25 recursos GCP**. Los buckets de backend se prepararon previamente. La VM anterior `polaris-server` y los proyectos fuente originales no se modificaron.

Los roots activos son `infra/terraform/aws-only`, `infra/terraform/vpn-only` y `infra/terraform/gcp-only`. El root superior es una referencia del objetivo completo; no aplicarlo sobre los estados separados. La AMI AWS está fijada a la versión comprobada para evitar reemplazos por una actualización automática de imagen.

## Datos y un único escritor

Antes de la transferencia se detuvo la aplicación GCP y se activó `read_only=1` en su base. Se creó un respaldo final local y en GCS. La restauración en RDS conservó revisión **4**, SHA256 del documento, **cuatro operaciones** y **dos usuarios**. El usuario personal siguió funcionando en ambas nubes.

Se exportó RDS mientras las aplicaciones permanecían detenidas. GCP recibió ese respaldo en un directorio nuevo, `/var/lib/polaris-ues/mysql-replica`, conservando `/var/lib/polaris-ues/mysql` como copia anterior. La restauración de la réplica deshabilitó binlog solo para esa sesión; después se fijó la posición GTID exportada y se inició replicación con verificación TLS. Los hilos IO/SQL reportaron Yes, errores 0 y retraso observado de 0 segundos. Esa observación no demuestra retraso inferior a un segundo bajo cualquier carga.

Las dos aplicaciones ahora escriben exclusivamente en RDS. La base GCP recibe cambios y permanece protegida contra escrituras ordinarias. Se conserva la misma firma de sesión entre aplicaciones para que un cambio DNS del dominio común no cierre la sesión.

## HTTPS y DNS

Cada nube conserva su propio certificado y clave privada. AWS cubre los nombres `aws` y `app`; GCP cubre `gcp` y `app`. Los certificados vigentes vencen el **9 de enero de 2027**. Ambos timers revisan renovación dos veces al día y **ambos dry-run terminaron correctamente**.

NGINX sirve localmente los desafíos ACME y consulta al otro sitio cuando el desafío está allí. La ruta del par admite únicamente la IP de la otra nube y no vuelve a reenviar. Esto permite renovar el certificado del dominio común mientras DNS selecciona cualquiera de los sitios.

Route 53 contiene registros fijos para `aws` y `gcp`, y registros PRIMARY/SECONDARY para `app`. Vercel no permite delegar una subzona que todavía contiene registros hijos: se verificaron sus equivalentes en Route 53, se respaldaron los tres registros anteriores y se sustituyeron por cuatro NS. El script incluye recuperación de los registros originales si falla la delegación.

## Verificaciones y límites

`scripts/verify-multicloud.mjs` confirmó HTTPS, sesión Secure/HttpOnly, usuario ga22038, APIs autenticadas y los mismos datos desde AWS y GCP. La prueba original `UES-GCP-PRUEBA-001` conserva su factura y una sola salida de inventario.

Después del ensayo se comprobó revisión **5**, SHA256 `cc38329ac2581f7504f70ef3d97ccc5ea2cc22e348cf502b7aeb530b6acd748b`, **cinco operaciones** y **dos usuarios** tanto en RDS como en su réplica. El respaldo privado del **11 de octubre a las 22:34:17 UTC**, de 6543 bytes, se descargó fuera de Git y se restauró en un contenedor aislado sin red. Revisión, hash, operaciones y usuarios coincidieron con la base activa. Véase [registro final de verificación](evidence-multicloud-verification.json).

Los planes finales de los tres roots devolvieron **No changes**. Se retiraron del servidor AWS las copias temporales SQL y el archivo de contraseña administrativa RDS; la configuración privada necesaria para ejecutar la aplicación permanece. Las copias de transferencia S3 y los archivos temporales de restauración GCP también se eliminan después de conservar los respaldos locales y en GCS.

El ensayo de aplicación terminó correctamente el 11 de octubre de 2026. Desde la solicitud de corte hasta la primera respuesta correcta por GCP transcurrieron **127.677 segundos**; incluye la ejecución de Systems Manager y la resolución DNS del cliente, y no constituye un SLA. La sesión de `ga22038` continuó válida. Desde GCP se creó el pedido ficticio `UES-AWS-FAILOVER-001`, UUID `a36d9aa3-45f1-4302-bbbb-7801354296ef`; repetir el UUID devolvió el comprobante existente sin duplicarlo. La revisión avanzó de **4 a 5**, y el pedido siguió visible al regresar el dominio a AWS.

El ensayo está en `scripts/test-application-failover.mjs` y su registro fechado en [evidence-app-failover.json](evidence-app-failover.json). Detiene únicamente la aplicación AWS y conserva RDS/VPN. Recupera AWS en `finally`. No ejecutarlo otra vez si el pedido de prueba ya existe. La [captura del pedido conservado](polaris-ues-aws-failover.png) complementa el registro técnico.

**Ese ensayo no promueve la base GCP.** Todavía faltan el corte total de AWS/RDS, aislamiento comprobado, promoción, RTO/RPO de datos y failback conservando escrituras de la base GCP. Seguir `docs/recuperacion.md`; DNS no decide qué base puede escribir. También faltan alertas automáticas de retraso y logs centralizados de contenedores. No presentar el laboratorio como cumplimiento completo de la guía.

## Operación

### Actualización del equipo y acceso

El [registro de esta actualización](evidence-team-release.json) complementa las evidencias del failover anterior. El respaldo del equipo también se restauró en un contenedor aislado sin red: revisión, SHA256, operaciones y usuarios coincidieron con la réplica activa.

El 11 de octubre se desplegó la versión `862f8c374f2d` con la misma imagen web en ambas nubes, digest `sha256:178d6e1367f7383c3a87d1bd771e25370dd787a3874023f73f769aa5c92caf5b`. Cloud Build `242b56b1-14a0-451a-b18d-586943970694` y [GitHub Actions](https://github.com/ga22038/MultiCloud/actions/runs/38183535878) terminaron correctamente. GCP se actualizó primero y AWS después; NGINX recargó su configuración tras sustituir cada contenedor. No se cambió el esquema SQL ni el plan de facturación.

Se agregaron CA21062, LP21019, SE21003, SL21010 y JM21008 como administradores. La base conserva el administrador inicial y ga22038: **siete usuarios** en total. La entrada admite mayúsculas; las contraseñas se guardan con hash scrypt y sal independiente. El backend usa el usuario de la sesión para registrar el creador y el último modificador. Véase [usuarios y trazabilidad](usuarios-y-trazabilidad.md).

La [prueba de autoría](evidence-team-attribution.json) avanzó la revisión de **5 a 9**: CA21062 creó la bodega de prueba y recibió 1 kg ficticio en el lote `UES-AUTORIA-001`; JM21008 modificó la bodega y registró una baja equivalente. El lote quedó en **0 kg**, conservando al creador CA21062 y al último operador JM21008. Los pedidos anteriores permanecieron idénticos. Se rechazó un campo de autor falsificado con HTTP 400. Ambas nubes devolvieron los mismos datos.

La réplica mantuvo IO/SQL activos, TLS verificado, errores 0 y retraso observado de 0 segundos. La revisión **9** tiene SHA256 SQL `bddfae43d9727673bc6628400ce399c35e0991c5bd69f10043fd3577a9f077d1`, **nueve operaciones** y **siete usuarios**. Se generó una copia privada adicional a las **23:20:04 UTC**, objeto `mariadb/20261011T232004Z-409a3763.sql.gz`, **8498 bytes**, CRC32C `0td9WA==`. Las evidencias de revisión 5 anteriores permanecen como registro fechado del ensayo de failover.

```powershell
rtk proxy pwsh -NoProfile -File scripts/connect-aws.ps1 Identity
rtk proxy pwsh -NoProfile -File scripts/connect-aws.ps1 Plan
rtk proxy pwsh -NoProfile -File scripts/terraform-aws.ps1 validate
rtk proxy pwsh -NoProfile -File scripts/terraform-aws.ps1 plan
rtk proxy pwsh -NoProfile -File scripts/terraform-aws.ps1 plan -Root vpn-only
rtk proxy node scripts/verify-multicloud.mjs
rtk proxy pwsh -NoProfile -File scripts/run-gcp-script.ps1 -Instance polaris-ues-gcp-mariadb -ScriptPath scripts/verify-gcp-replica.sh
```

`aws login` usa una sesión temporal de consola, con caché privada en `.secrets/aws/login`. No se crearon access keys permanentes. `terraform-aws.ps1` exporta temporalmente esa sesión dentro del proceso y elimina sus variables al terminar. `run-aws-script.ps1` envía solamente scripts públicos por SSM: sus parámetros se registran. Los secretos viajan mediante S3 privado y archivos de opción SQL, nunca mediante parámetros SSM o contraseñas en argumentos.

Los scripts `bootstrap-aws-state.ps1`, `install-crane.ps1`, `mirror-aws-images.ps1`, `fetch-rds-secrets.ps1`, `setup-aws-secrets.mjs`, `deploy-aws-app.sh`, `import-aws-cutover.sh`, `setup-gcp-replica.mjs` y `activate-gcp-replica.sh` documentan el aprovisionamiento inicial. **No repetir importaciones sobre las bases activas.** La importación AWS rechaza ejecutarse mientras la aplicación está activa; la inicialización GCP rechaza sobrescribir una réplica existente.

Las conexiones VPN consumen crédito continuamente: dos conexiones AWS de USD0.05/h suman aproximadamente USD2.40/día, y cuatro túneles GCP de USD0.05/h suman USD4.80/día. A ello se agregan IPv4, instancias, almacenamiento, DNS y transferencia; no es una estimación del total del proyecto. Referencias: [AWS VPN](https://aws.amazon.com/vpn/pricing/), [GCP VPN](https://cloud.google.com/vpn/pricing). No mantener recursos olvidados después de la evaluación.
