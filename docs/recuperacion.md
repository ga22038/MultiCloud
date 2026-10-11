# Recuperación y evidencias

No automatizar la promoción por una sola comprobación HTTP. DNS cambia el destino del tráfico; no decide qué base puede escribir. La replicación asíncrona no garantiza pérdida cero.

## Fallo únicamente de la aplicación AWS

1. Confirmar que RDS continúa sano y que la aplicación GCP llega al mismo escritor por VPN.
2. Verificar `/api/health/ready` en GCP y la misma revisión de datos.
3. Permitir que DNS conmute al respaldo. Registrar el intervalo hasta la primera operación completa correcta.
4. Recuperar AWS con la misma imagen y configuración. El regreso automático de DNS solo es válido porque ambos sitios usan el mismo escritor.

No promover MariaDB GCP en este escenario.

Ensayo real del 11 de octubre de 2026: AWS aplicación detenida, RDS y VPN activos; primera respuesta por GCP a los **127.677 segundos** desde la solicitud del corte. La sesión continuó válida. El pedido ficticio `UES-AWS-FAILOVER-001` se creó por GCP, su UUID se repitió sin duplicados y permaneció visible al volver a AWS. La revisión avanzó de 4 a 5. Véase [registro medido](evidence-app-failover.json) y [despliegue AWS](despliegue-aws.md). Esta prueba demuestra conmutación de aplicación y retorno de tráfico; no demuestra promoción ni failback de bases de datos.

## Pérdida total de AWS o RDS

1. Detener cambios y registrar la hora de detección. Mantener ambos sitios con escrituras deshabilitadas durante la decisión.
2. **Aislar el escritor anterior:** impedir que EC2 y cualquier otro cliente sigan escribiendo en RDS. Usar controles de servicio/red y conservar evidencia. Si no puedes demostrar aislamiento, no promover una segunda base escribible.
3. Revisar los hilos, errores, GTID y última revisión recibida en GCP. Procesar el relay log disponible y documentar cualquier retraso o transacción incierta. `Seconds_Behind_Master=0` por sí solo no demuestra igualdad tras perder conexión.
4. Con el escritor anterior aislado, detener replicación y promover la réplica según la versión validada. Conservar coordenadas y logs; no borrar GTID ni reiniciar binlogs para ocultar diferencias.
5. Cambiar el destino de la API GCP a su MariaDB promovida, conservando TLS validado y la misma firma de sesiones. Habilitar escrituras en ese sitio y comprobar salud y una operación completa.
6. Habilitar tráfico al sitio GCP. Medir recuperación efectiva desde clientes; considerar cachés DNS, TTL y reintentos.
7. Conciliar UUID de operaciones inciertas. Un comprobante ausente en GCP podría corresponder a una transacción confirmada en AWS que no llegó a replicarse. No liberar el bloqueo del navegador ni repetir la operación sin revisar ambos historiales.

El retorno de conectividad AWS no debe reactivar automáticamente su escritor. Mantener AWS detenido o `APP_WRITES_ENABLED=false` hasta completar el retorno controlado. La comprobación de disponibilidad devuelve `503` mientras ese indicador está deshabilitado.

## Retorno controlado a AWS

1. Mantener AWS aislado mientras GCP atiende escrituras.
2. Crear un respaldo consistente de GCP y registrar GTID. Preparar AWS como destino actualizado mediante restauración/replicación compatible y procedimientos RDS, conservando los cambios escritos en GCP.
3. Comparar revisión, operaciones, pedidos, movimientos y auditoría. Resolver cualquier divergencia antes de cambiar tráfico.
4. Abrir una ventana breve de mantenimiento, detener escrituras en GCP y alcanzar la posición final en AWS.
5. Elegir un único escritor, apuntar ambas API a ese destino y validar salud. Solo entonces habilitar AWS y devolver tráfico.
6. Reconstruir o reconfigurar GCP como réplica de solo lectura y volver a comprobar replicación y respaldos.

No existe aquí un script automático de failback. Debe ensayarse con las versiones elegidas y un respaldo restaurable; sobrescribir AWS con datos antiguos perdería operaciones atendidas por GCP.

## Laboratorio local de redundancia de aplicación

Requiere motor Docker disponible y `rtk npm run local:up` completado. La base portátil debe estar detenida por el conflicto de puerto.

```powershell
rtk docker compose --env-file .secrets/runtime.env stop app-primary
```

Abrir la aplicación vía NGINX en el puerto 8080, actualizar y comprobar sitio `gcp-lab`, datos y sesión. Registrar el intervalo y realizar el flujo de prueba con datos ficticios. Recuperar el primario:

```powershell
rtk docker compose --env-file .secrets/runtime.env start app-primary
```

NGINX usa comprobaciones pasivas. Una petición de escritura ya enviada no debe reproducirse automáticamente; si se pierde la respuesta, usar la comprobación de operación. Este ensayo no simula pérdida de datos entre nubes porque comparte MariaDB local.

## Medición

| Evidencia   | Registrar                                                                           |
| ----------- | ----------------------------------------------------------------------------------- |
| RTO         | Hora de fallo y hora de la primera operación completa correcta desde un cliente.    |
| RPO         | Última operación confirmada antes del fallo y última recuperada, con UUID y tiempo. |
| Integridad  | Revisiones, saldos, reservas, pedidos, comprobantes y ausencia de duplicados.       |
| Rendimiento | Entorno, versión, usuarios concurrentes, p50/p95, errores y uso de recursos.        |
| Retorno     | Operaciones escritas en GCP visibles en AWS después de failback.                    |

No registrar cero pérdida por observar únicamente una pantalla disponible. El objetivo de recuperación y la pérdida aceptable deben acordarse con el evaluador y contrastarse con mediciones reales.
