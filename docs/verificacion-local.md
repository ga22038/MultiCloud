# Verificación local

Fecha: 11 de octubre de 2026. Entorno: Windows, Node.js 24 y MariaDB 11.4 portátil en `127.0.0.1:3307`.

## Comprobaciones realizadas

- TypeScript y ESLint sin errores.
- 57 pruebas de reglas, contratos, sesiones, HTTP, colas de trabajo y PDF aprobadas.
- 3 pruebas SQL independientes aprobadas: repetición idempotente, conflicto concurrente y rechazo por permisos sin cambios parciales. Crean y eliminan una base temporal propia.
- Flujo real en navegador: crear pedido, asignar lote FEFO, confirmar despacho, registrar referencia de factura y descargar PDF.
- Pedido ficticio `UES-PRUEBA-UI-001`, referencia `PRUEBA-UES-001`: la base confirma una única salida de 1.000 gramos. Facturar no vuelve a descontar inventario. El registro se conserva para revisión.
- PDF descargado y ejemplos renderizados para revisar textos, tablas y paginación.
- Manifiesto Docker Compose validado y sintaxis del NGINX local comprobada.
- Terraform inicializado y validado, con formato y archivo de versiones de proveedores.

La compilación y las comprobaciones HTTP se ejecutan con `npm run build` y `npm run test:api`. La prueba HTTP cubre salud, autenticación, origen, permisos y consultas paginadas.

## Alcance pendiente

Docker Desktop no respondió; el laboratorio se ejecutó con MariaDB portátil y Next.js. No se comprobó el cambio entre contenedores en ejecución.

Después de esta verificación local se desplegaron AWS y GCP, VPN, réplica GTID, HTTPS y DNS de failover. El [informe multicloud](despliegue-aws.md) documenta el corte real de aplicación y su retorno. Promoción y failback de datos ante pérdida total de AWS, Multi-AZ y carga continúan pendientes. La comprobación local por sí sola no demuestra recuperación entre nubes.

Las credenciales permanecen en `.secrets/`, fuera de Git. La aplicación original permanece intacta.
