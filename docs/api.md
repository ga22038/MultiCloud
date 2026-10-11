# API de Polaris UES

Base: `/api/v1`. Sesión en cookie `polaris_session`, HttpOnly y de ocho horas. Las respuestas no se almacenan en caché. La API no acepta identidad ni rol enviados por el cliente.

## Rutas

| Método | Ruta                | Resultado                                                                                         |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------- |
| POST   | `/session`          | Inicia sesión con `{username,password}`.                                                          |
| GET    | `/session`          | Usuario autenticado y rol real.                                                                   |
| DELETE | `/session`          | Elimina la cookie de sesión del navegador.                                                        |
| GET    | `/state`            | Estado operativo, usuario y sitio; utilizado por el frontend inicial.                             |
| GET    | `/orders`           | Pedidos paginados; admite `status` y `q`.                                                         |
| GET    | `/inventory`        | Lotes y saldos en gramos; admite `warehouseId` y `q`.                                             |
| GET    | `/movements`        | Movimientos paginados; admite `q`.                                                                |
| GET    | `/catalogs/{kind}`  | Catálogo paginado: `customers`, `materials` o `warehouses`.                                       |
| POST   | `/operations`       | Ejecuta una operación validada y transaccional.                                                   |
| GET    | `/operations/{id}`  | Comprueba una operación confirmada del usuario actual.                                            |
| GET    | `/api/health/live`  | Proceso activo, sin acceso a base de datos. Ruta fuera de `/api/v1`.                              |
| GET    | `/api/health/ready` | `200` si la base está inicializada, es escribible y el sitio está habilitado; en otro caso `503`. |

Listados: `page=1`, `pageSize=25`, máximo 100. Respuesta `{data,page,pageSize,total,revision}`. Los endpoints de lectura son para personal interno; no filtran por propietario de cliente.

## Guardar

Todas las escrituras de negocio usan el mismo contrato para mantener atomicidad e idempotencia:

```json
{
  "id": "9fd815ae-9cd5-4669-8d56-f1eb369e695c",
  "expectedRevision": 0,
  "command": {
    "type": "createOrder",
    "args": [
      {
        "number": "PED-UES-001",
        "customerId": "c1",
        "notes": "Preparar entrega en recepción.",
        "lines": [{ "materialId": "m1", "grams": 125000 }]
      }
    ]
  }
}
```

Obtener la revisión y los identificadores actuales antes de construir la solicitud. Crear un UUID por operación. Repetir una solicitud solo con su identificador, revisión y contenido originales; nunca generar otro UUID automáticamente por una respuesta perdida.

Se requiere `Content-Type: application/json` y un encabezado `Origin` incluido exactamente en `APP_ALLOWED_ORIGINS`. Límite de cuerpo: 1 MiB. Las cantidades son enteros en gramos; 125000 representa 125 kg.

## Comandos

| Tipo              | `args`, en orden                                                                     |
| ----------------- | ------------------------------------------------------------------------------------ |
| `createOrder`     | `[{number,customerId,notes,lines:[{materialId,grams}]}]`                             |
| `allocateOrder`   | `[orderId,{lineId:[{stockId,grams}]}]`                                               |
| `confirmOrder`    | `[orderId]`                                                                          |
| `invoiceOrder`    | `[orderId,invoiceReference]`                                                         |
| `cancelOrder`     | `[orderId,reason]`                                                                   |
| `receive`         | `[{materialId,lot,warehouseId,expiry,grams,document,reason},operationKey]`           |
| `writeOff`        | `[stockId,grams,document,reason,operationKey]`                                       |
| `addCustomer`     | `[{name,nit,city}]`                                                                  |
| `addMaterial`     | `[{name,code,category}]`                                                             |
| `addWarehouse`    | `[{name,city}]`                                                                      |
| `updateCatalog`   | `[kind,id,{name,second,third}]`                                                      |
| `deleteCatalog`   | `[kind,id]`                                                                          |
| `updateStock`     | `[stockId,{lot,warehouseId,expiry,grams,document,reason},operationKey,formRevision]` |
| `correctMovement` | `[movementId,{grams,document,reason},operationKey,formRevision]`                     |

En `updateCatalog`, `second/third` son NIT/ciudad para clientes, código/categoría para materiales y ciudad/cadena vacía para bodegas. En correcciones, cero permite anular una cantidad mediante movimientos compensatorios; no se elimina el historial. `expiry` usa `YYYY-MM-DD`.

Respuesta de guardado: `{state,operationId,replayed}`. Estado y comprobante de operación se confirman juntos. Una excepción ejecuta rollback.

## Errores

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "Los datos cambiaron. Actualiza y revisa el formulario.",
    "requestId": "UUID"
  }
}
```

| Estado    | Significado                                                                   |
| --------- | ----------------------------------------------------------------------------- |
| 400       | JSON o contrato inválido.                                                     |
| 401       | Sesión ausente, inválida, vencida o usuario inactivo.                         |
| 403       | Origen no permitido o rol insuficiente.                                       |
| 404       | Comprobante de operación no encontrado para ese usuario.                      |
| 409       | Revisión obsoleta o identificador reutilizado con otro contenido.             |
| 413 / 415 | Solicitud demasiado grande o formato distinto de JSON.                        |
| 422       | Regla de negocio: lote vencido, saldo insuficiente, estado incompatible, etc. |
| 429       | Demasiados intentos de acceso.                                                |
| 503       | Base no disponible, no inicializada o sitio en mantenimiento.                 |

Un error de conexión, timeout o `503 UNAVAILABLE` después de enviar una escritura deja resultado incierto. Consultar el comprobante antes de repetir. `WRITES_DISABLED` se rechaza antes de iniciar la transacción. El código y la referencia de solicitud permiten diagnóstico sin registrar contraseñas, cookies o cuerpos.

## Evolución

La API de operaciones conserva la semántica del dominio durante la migración. Se pueden añadir rutas de escritura por recurso como adaptadores a los mismos servicios transaccionales. No se deben crear escrituras SQL independientes desde cada pantalla. El esquema OpenAPI se genera desde los contratos Zod con `rtk npm run docs:api`.
