# Polaris UES en Google Cloud

Desplegado y comprobado el 11 de octubre de 2026. Responsable: **ga22038**.

## Acceso y cuenta

- Aplicación: https://app.multicloud.polarisenterprisesv.com
- Sitio GCP: https://gcp.multicloud.polarisenterprisesv.com
- Cuenta utilizada: `developerengineer545@gmail.com`.
- Proyecto: `project-dba46330-c40e-432b-9ad`; región `us-central1`, zona `us-central1-a`.
- Usuario inicial: `admin`. Su contraseña está únicamente en `.secrets/gcp/runtime.env`, variable `BOOTSTRAP_ADMIN_PASSWORD`.

La captura proporcionada por el propietario mostraba USD268.45 de crédito y vencimiento de la prueba el **23 de octubre de 2026**. No se actualizó la cuenta a pago ni se cambió su asociación de facturación. Los recursos creados consumen crédito; el saldo de esa captura no es una lectura del saldo actual. Guardar un respaldo fuera de la cuenta antes del vencimiento y decidir cómo conservar el servicio.

## Recursos creados

| Componente            | Configuración real                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Red                   | VPC `polaris-ues`; subred privada `10.20.1.0/24`.                                                               |
| Aplicación            | `polaris-ues-gcp-app`, Ubuntu 24.04, e2-small, disco 15 GB; IP reservada `34.122.222.237`.                      |
| Base                  | `polaris-ues-gcp-mariadb`, Ubuntu 24.04, e2-small; IP privada `10.20.1.3`, sin IP pública.                      |
| Datos                 | Disco persistente independiente de 20 GB, montado en `/var/lib/polaris-ues`.                                    |
| Contenedores          | Next.js y NGINX en la VM de aplicación; MariaDB 11.4 en la VM privada.                                          |
| Acceso administrativo | OS Login e IAP; puerto 22 limitado al rango de IAP.                                                             |
| Firewall              | Internet únicamente a 80/443 de la aplicación; 3306 únicamente desde la VM de aplicación.                       |
| Salida privada        | Cloud NAT para la VM de MariaDB.                                                                                |
| Imágenes              | Artifact Registry privado `us-central1-docker.pkg.dev/…/polaris-ues`.                                           |
| Construcción          | Cloud Build con identidad propia y fuente privada de retención de siete días.                                   |
| Estado Terraform      | Bucket privado y versionado `project-dba46330-c40e-432b-9ad-polaris-ues-state`, prefijo `polaris-ues/gcp`.      |
| Respaldos             | Bucket privado `project-dba46330-c40e-432b-9ad-polaris-ues-backups`, retención por ciclo de vida de siete días. |
| Disponibilidad        | Cloud Monitoring comprueba HTTPS y `/api/health/ready` cada cinco minutos.                                      |

Terraform administra **25 recursos** en `infra/terraform/gcp-only`. El bucket de estado se creó previamente como requisito del backend. Las VM tienen protección contra borrado; el disco de datos y el bucket de respaldos tienen `prevent_destroy`. El servidor anterior `polaris-server` pertenece a otra instalación y no se modificó.

Los dos registros A se crearon en el DNS de Vercel, con TTL de 60 segundos, apuntando a la IP reservada. Todavía no existe delegación de `multicloud` a Route 53 ni conmutación DNS entre proveedores.

## Seguridad y versiones

La base exige TLS; el cliente valida la CA y la identidad `polaris-ues-gcp-mariadb`. La opción `MARIADB_SSL_SERVER_NAME` permite verificar esa identidad mientras se conecta a su IP privada. El certificado de la base vence en octubre de 2027 y requiere renovación administrativa antes de esa fecha. La clave de la CA permanece local y no se copió a las VM.

La aplicación tiene permisos de tablas limitados por `infra/mariadb/runtime-grants.sql`. El usuario de migración se eliminó después de crear el esquema. No se habilitaron usuarios demo de roles compartidos. Para agregar operadores reales se necesita un procedimiento administrativo de cuentas; esta versión no incluye una pantalla de gestión de usuarios.

Los secretos de ejecución permanecen en archivos privados con modo `0600`, fuera de Terraform, Git y las imágenes. Los tokens de GitHub y Vercel no se copiaron a los servidores. Las identidades de VM tienen permisos separados: lectura de imágenes para la aplicación y creación de objetos de respaldo para la base.

Cloud Build correcto: `9fcf0d11-6fa8-48ae-a736-5ed8793cbda5`.

```text
app@sha256:67575219d882bdde53959fadf7d3e09b1c14bd7e761bf2efb6492e482e393c08
migrate@sha256:e4700c21e3631848b9cd841bf554f3b14296290d5c4e5653ea64d43f074196a5
```

Las imágenes están fijadas por digest. El certificado HTTPS de Let's Encrypt cubre ambos nombres y vence el 9 de enero de 2027. El timer `polaris-ues-renew-tls.timer` revisa la renovación dos veces al día, copia el certificado renovado y recarga NGINX después de validar su configuración.

**Limitación pendiente:** dos simulaciones de renovación (`--dry-run`) fallaron durante la validación DNS secundaria de Let's Encrypt staging, con error de red al consultar A/AAAA. Los dos hostnames resuelven a la IP correcta y la ruta HTTP de desafío respondió correctamente desde la VM y desde un cliente externo. El certificado de producción ya fue emitido y es válido, pero la renovación automática completa no se considera comprobada hasta obtener una simulación correcta. Revisar DNS y repetir el dry-run antes del vencimiento; no modificar los nameservers del dominio principal para intentar resolver este fallo.

## Respaldo y recuperación comprobados

`polaris-ues-backup.timer` ejecuta diariamente, desde las 03:15 UTC con hasta 15 minutos de variación, un dump consistente InnoDB con coordenadas y GTID comentados. Lo comprime y publica mediante la identidad de la VM en el bucket privado. La identidad puede crear objetos, pero no leerlos ni sobrescribirlos.

Se descargó el primer objeto de respaldo con la cuenta administrativa y se restauró en un contenedor temporal sin red ni puertos publicados. La revisión, SHA256 del documento, cantidad de operaciones y cantidad de usuarios coincidieron con la base original. No se restauró sobre los datos activos.

Después del flujo funcional se creó otro objeto, `mariadb/20261011T211527Z-bf866f52.sql.gz`, de 6103 bytes, para conservar el pedido de prueba y sus operaciones.

Ese segundo objeto también se restauró y comparó correctamente con la base activa en revisión 4. Se eliminaron las copias temporales de credenciales de las carpetas de transferencia y el archivo de migración del servidor.

`scripts/verify-gcp-restore.sh` repite esta comparación. El contenedor temporal se elimina al terminar. Un respaldo de la base no sustituye la conservación segura de credenciales, CA, certificados y configuración.

## Evidencias funcionales

- Ambos hostnames responden `200` en readiness con sitio `gcp` y TLS válido.
- HTTP redirige a HTTPS; sesión con cookie `Secure` y `HttpOnly`.
- API sin sesión: `401`. Origen no permitido: `403`.
- Inicio de sesión de administrador y consultas autenticadas de pedidos, inventario, movimientos y catálogos correctos.
- Pedido ficticio `UES-GCP-PRUEBA-001`: creación, reserva FEFO, salida de 1 kg y referencia `UES-GCP-FACTURA-001`.
- Estado persistido en revisión 4; exactamente un movimiento de salida de `-1000` gramos para ese pedido. Facturar no descontó nuevamente.
- Descarga de PDF comprobada desde el sitio publicado.
- Cloud Monitoring registró comprobaciones correctas desde Virginia, Oregon, Iowa, Bélgica, Singapur y São Paulo.
- Captura: `docs/polaris-ues-gcp-flujo.png`.

Repetir la comprobación HTTP, sin cambiar datos de negocio:

```powershell
rtk node scripts/verify-gcp.mjs --workflow
```

## Operación

```powershell
rtk powershell -NoProfile -File scripts/terraform-gcp.ps1 validate
rtk powershell -NoProfile -File scripts/terraform-gcp.ps1 plan
rtk gcloud compute ssh polaris-ues-gcp-app --zone=us-central1-a --project=project-dba46330-c40e-432b-9ad --tunnel-through-iap
```

En la VM de aplicación, los archivos están en `/opt/polaris-ues`; Compose en `/opt/polaris-ues/compose/site.yaml`. En la VM de base, Compose está en `/opt/polaris-ues/compose.yaml`. Consultar contenedores con `sudo docker ps`, timers con `sudo systemctl list-timers 'polaris-ues-*'` y respaldos con `sudo journalctl -u polaris-ues-backup.service`. No mostrar archivos de entorno ni usar `docker inspect` para publicar sus variables.

`scripts/setup-gcp-secrets.mjs` genera secretos aleatorios independientes y conserva los existentes; `scripts/setup-gcp-database-tls.py` prepara CA y certificados con OpenSSL. Ambos se ejecutan localmente y escriben solo en `.secrets/gcp`. La clave privada de la CA no se transfiere.

Los scripts `prepare-gcp-app.sh`, `migrate-gcp-app.sh`, `grant-gcp-runtime.sh` y `activate-gcp-app.sh` documentan el aprovisionamiento inicial en ese orden, después de preparar la base con `deploy-gcp-database.sh` y transferir los archivos privados por SCP. No ejecutar otra migración después de eliminar su usuario sin crear una identidad temporal autorizada. Para otra versión, construir imágenes, actualizar los digest privados y aplicar Compose conservando secretos, certificados y datos.

## Pendiente para completar multicloud

**GCP es actualmente el único sitio publicado y MariaDB GCP es el escritor temporal.** No existe todavía una réplica GTID desde AWS. Tampoco se ha probado redundancia entre nubes.

Faltan AWS/EC2/RDS, conectividad VPN, restauración inicial y réplica GTID, conmutación DNS, aislamiento del escritor, pruebas de RTO/RPO y retorno conservando datos. El monitoreo actual cubre disponibilidad HTTP y métricas básicas de Compute Engine; faltan alertas operativas, métricas de replicación, recolección central de logs de contenedores y carga medida.

No aplicar directamente el root multicloud `infra/terraform` sobre esta instalación: administra componentes GCP similares con otro estado. Antes de incorporar AWS, separar el root AWS o importar y refactorizar recursos para evitar recrear la infraestructura y solapar redes.

Referencias de implementación: [Cloud Storage: inserción de objetos](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/insert), [renovación de Certbot](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates), [comprobaciones de disponibilidad con Terraform](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/monitoring_uptime_check_config).
