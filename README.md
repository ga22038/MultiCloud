# Polaris UES

El equipo comparte inventario y pedidos, con autor y última modificación en las tablas y un módulo de Auditoría. El acceso incluye una bienvenida personalizada de 6 segundos. Ver [usuarios y trazabilidad](docs/usuarios-y-trazabilidad.md).

Responsable del proyecto: **ga22038**. Repositorio: [MultiCloud](https://github.com/ga22038/MultiCloud).

El [laboratorio interactivo de aprendizaje](https://app.multicloud.polarisenterprisesv.com/aprender) explica arquitectura, pruebas reales de consulta, simulaciones de fallos y reproducción en cuentas propias. Incluye un [taller para preparar la defensa](docs/taller-multicloud.md). No requiere entrar al ERP; las consultas cloud privadas sí requieren identidades IAM propias. El repositorio conserva referencias al despliegue del propietario que deben adaptarse antes de aplicar en otras cuentas.

Publicado en AWS y Google Cloud: [abrir Polaris UES](https://app.multicloud.polarisenterprisesv.com). AWS atiende como primario y GCP como respaldo mediante Route 53. Ambas aplicaciones usan RDS privado; MariaDB GCP replica por GTID sobre cuatro túneles IPsec/BGP. Consultar [el despliegue AWS y sus límites](docs/despliegue-aws.md) y [el despliegue GCP](docs/despliegue-gcp.md). RDS permanece Single-AZ por las restricciones del plan gratuito; el requisito Multi-AZ todavía no se cumple.

Aplicación de inventario, pedidos, despacho y referencias de factura. Adaptación de Univar a Next.js, TypeScript y MariaDB para el proyecto académico multicloud AWS/GCP. El proyecto original permanece intacto.

## Módulos

| Módulo        | Trabajo que realiza                                                               |
| ------------- | --------------------------------------------------------------------------------- |
| Resumen       | Indicadores, vencimientos y actividad reciente.                                   |
| Pedidos       | Crear solicitudes, consultar avance, cancelar pendientes y exportar documentos.   |
| Despacho      | Asignar lotes FEFO, reservar cantidades, generar alistamiento y confirmar salida. |
| Facturación   | Consultar pedidos despachados y registrar su referencia de factura.               |
| Inventario    | Consultar saldos por lote/bodega, registrar entradas, bajas y correcciones.       |
| Kardex        | Consultar el historial, filtrar movimientos y exportar CSV/PDF.                   |
| Catálogos     | Gestionar clientes, materiales y bodegas.                                         |
| Configuración | Consultar conexión y reglas, y exportar datos JSON.                               |

Los iconos son trazos monocromáticos. Los PDF respetan los filtros, ajustan textos largos, repiten encabezados y numeran páginas. La referencia de factura es interna; el sistema no emite facturas fiscales.

## Ejecutar en esta computadora

Requisitos: Node.js 24 LTS, npm y MariaDB 11.4. Para contenedores, Docker Desktop debe tener el motor Linux activo.

Desde `C:\Dev\12 Multicloud`:

```powershell
rtk npm ci
rtk npm run local:init
```

`local:init` genera valores aleatorios en `.secrets/runtime.env`, conserva valores existentes y no imprime contraseñas. Usuario inicial: `admin`. Consulta su contraseña localmente en `BOOTSTRAP_ADMIN_PASSWORD` dentro de ese archivo.

Opción A, laboratorio con Docker:

```powershell
rtk npm run local:up
```

Abrir [Polaris UES con NGINX](http://127.0.0.1:8080). Incluye MariaDB, inicialización, aplicación primaria, aplicación de respaldo y NGINX. Las dos aplicaciones usan la misma base local; este laboratorio comprueba redundancia de aplicación, no replicación entre nubes.

Opción B, desarrollo en Windows sin motor Docker:

```powershell
rtk npm run db:install
rtk npm run db:local
rtk npm run db:setup
rtk npm run dev
```

Abrir [Polaris UES en desarrollo](http://127.0.0.1:3000). MariaDB portátil se descarga del archivo oficial, se verifica con SHA256, escucha solo en `127.0.0.1:3307` y no instala un servicio Windows. Sus archivos quedan en `.tools/`, fuera de Git. En esta computadora ya se preparó esa base porque Docker no respondió.

No ejecutes simultáneamente la base portátil y Docker en el puerto 3307. Para cambiar a Docker, detén primero la base portátil con `rtk npm run db:stop`. Para detener el laboratorio Docker sin eliminar datos, usa `rtk npm run local:down`.

La inicialización conserva los registros existentes. Los datos iniciales son ficticios y conservan ejemplos comerciales de la aplicación original. En el laboratorio se habilitan `customer`, `logistica` y `facturacion`, con la misma contraseña inicial de laboratorio. No habilites esas cuentas compartidas en una instalación pública.

## Arquitectura del código

```text
app/src/frontend/       Interfaz, formularios, navegación, cliente HTTP y exportaciones
app/src/app/            Páginas Next.js y rutas /api
app/src/server/         Sesiones, autorización, transacciones y consultas MariaDB
app/src/domain.ts       Reglas de inventario y pedidos independientes de React y HTTP
app/src/commands.ts     Contratos validados de operaciones
app/src/workflow.ts     Colas de trabajo por módulo
app/src/reports.ts      Generación de PDF reutilizable y comprobable
app/tests/              Reglas, contratos, autenticación, reportes e integración SQL
infra/nginx/            Proxy local y plantilla HTTPS por nube
infra/compose/          Manifiestos de aplicación y réplica
infra/terraform/        Estados activos aws-only, gcp-only y vpn-only; diseño de referencia
infra/load/             Prueba de lectura con k6
docs/                   Arquitectura, API y recuperación
scripts/                Preparación, ejecución y verificación local
```

Next.js entrega frontend y API dentro de una aplicación desplegable. El backend ejecuta las reglas contra el estado real de MariaDB. El navegador no elige su identidad o su rol al guardar.

Esta versión persiste el estado operativo como un agregado JSON dentro de una transacción InnoDB y mantiene usuarios y operaciones en tablas independientes. Es una base académica para demostrar atomicidad, concurrencia y replicación. La fila central serializa escrituras y la interfaz carga el estado completo; antes de un uso de gran volumen se deben normalizar entidades y paginar también el consumo del frontend.

## Verificación

```powershell
rtk npm run typecheck
rtk npm run lint
rtk npm test
rtk npm run test:integration
rtk npm run build
```

Con la aplicación encendida y usuarios demo habilitados, ejecutar `rtk npm run test:api`. Las pruebas SQL crean una base y un usuario temporales propios; no reinician la aplicación. GitHub Actions comprueba código, SQL, compilación, imagen Docker y Terraform en cada push o pull request. Consultar el resultado de cada ejecución en la pestaña Actions del repositorio.

## Credenciales

- `.secrets/credentials.env`: tokens futuros de GitHub, Vercel, AWS y GCP, separados del entorno de aplicación.
- `.secrets/runtime.env`: contraseñas locales de MariaDB y firma de sesiones. Nunca se copia a Docker.
- `.env.example` y `app/.env.example`: plantillas públicas sin secretos.
- `scripts/Import-LocalEnvironment.ps1`: carga credenciales en la sesión sin imprimirlas.

Para autenticarse con proveedores desde PowerShell:

```powershell
. .\scripts\Import-LocalEnvironment.ps1
```

Para AWS, usar un perfil CLI y no credenciales del usuario raíz. Para GCP, usar `gcloud`; Terraform puede necesitar Application Default Credentials. GitHub y Vercel no son necesarios para el laboratorio local. La disponibilidad de un token no autoriza un despliegue.

`.secrets/`, `.tools/`, archivos de entorno, claves y estados Terraform están excluidos de Git. No los incluyas al compartir un ZIP. En producción, usar gestores de secretos y cuentas de aplicación con permisos mínimos.

## Documentación y trabajo pendiente

- [Arquitectura](docs/arquitectura.md)
- [API y operaciones](docs/api.md)
- [Despliegue multicloud](docs/despliegue.md)
- [Recuperación, RTO y RPO](docs/recuperacion.md)
- [Plan de evidencias](docs/evaluacion.md)
- [Verificación local y alcance pendiente](docs/verificacion-local.md)
- [Ejemplos PDF con datos ficticios](docs/examples/)

Los roots `aws-only`, `gcp-only` y `vpn-only` están aplicados, con estados separados y planes finales sin cambios. Vercel delega solamente `multicloud` a Route 53. La replicación GTID, el corte de aplicación hacia GCP y el retorno del tráfico a AWS están comprobados. Permanecen pendientes Multi-AZ, promoción y failback de datos ante pérdida completa de AWS, carga y alertas de réplica. Consultar [las evidencias y limitaciones](docs/evaluacion.md).
