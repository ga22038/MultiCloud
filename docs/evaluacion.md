# Evidencias del proyecto académico

La guía entregada define componentes y pruebas, pero no proporciona una rúbrica numérica. Esta lista convierte esos requisitos en evidencias; no inventa ponderaciones.

Actualización del **11 de octubre de 2026**: [Polaris UES funciona en AWS y GCP](despliegue-aws.md). AWS atiende como primario y GCP como respaldo de aplicación; ambas API utilizan el mismo escritor RDS privado. MariaDB GCP mantiene una réplica GTID de solo lectura. El plan AWS continúa FREE, sin actualización a pago.

| Requisito              | Evidencia comprobada                                                                                                   | Pendiente o limitación                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Aplicación funcional   | Nueve módulos, incluyendo Auditoría, flujo completo de pedido facturado y movimiento único; acceso en ambas nubes.     | Revisión final de los campos del negocio con el evaluador.                                             |
| Frontend/backend/API   | Next.js, capas separadas, APIs autenticadas, sesiones HTTPS, ga22038 y cinco carnets adicionales como administradores. | Administración web de usuarios y claves individuales para uso real.                                    |
| Docker                 | Imágenes web/migración copiadas de Artifact Registry a ECR conservando digest; contenedores en ambas nubes.            | No hay despliegue automático de cada commit.                                                           |
| NGINX                  | Proxy HTTPS por sitio, renovación TLS probada y reenvío restringido de desafíos ACME.                                  | Configurar y ensayar failover directo de backend AWS a GCP en NGINX, además del cambio DNS ya probado. |
| Terraform              | Estados separados: 25 recursos GCP, 38 AWS y 23 VPN; backend remoto cifrado y con bloqueo.                             | No aplicar el root superior encima de estos estados.                                                   |
| Conectividad           | Cuatro túneles IPsec/IKEv2 y BGP activos; consultas desde GCP al RDS privado.                                          | Monitoreo y prueba de caída individual de túneles.                                                     |
| MariaDB                | RDS 11.4.13 privado con TLS; réplica GCP con IO/SQL activos, errores 0 y retraso observado de 0 segundos.              | **RDS Multi-AZ no cumplido:** Free Tier admite Single-AZ. No se cambió de plan.                        |
| Respaldos              | Copias privadas, respaldo previo al traslado y restauración aislada comprobada.                                        | Repetir periódicamente la restauración y conservar copias fuera de la prueba GCP.                      |
| Failover de aplicación | AWS detenido con RDS activo: GCP respondió en **127.677 s**, conservó sesión y aceptó una escritura sin duplicar UUID. | La medida incluye Systems Manager y DNS; no es una garantía de tiempo máximo.                          |
| Recuperación de base   | Aislamiento, promoción y conciliación descritos en el runbook.                                                         | **No ensayado:** pérdida completa de AWS/RDS, promoción GCP y RTO/RPO de datos.                        |
| Retorno                | El pedido escrito por GCP permaneció al retornar tráfico a AWS, con RDS como único escritor.                           | **No ensayado:** failback desde una base GCP promovida hacia AWS.                                      |
| Carga y monitoreo      | Health checks Route 53/GCP y alarmas CloudWatch EC2/espacio RDS; k6 preparado.                                         | Carga medida, logs centrales, alertas de lag y destinatarios de alertas.                               |
| Documentación          | Arquitectura, API, despliegues, recuperación, registro JSON y captura del ensayo.                                      | Añadir evidencias de los ensayos pendientes.                                                           |

## Evidencias para entregar

- [Despliegue AWS y configuración multicloud](despliegue-aws.md).
- [Despliegue GCP y comprobaciones previas](despliegue-gcp.md).
- [Registro del corte de aplicación y retorno](evidence-app-failover.json).
- [Verificación de réplica, restauración y planes Terraform](evidence-multicloud-verification.json).
- [Captura del pedido conservado](polaris-ues-aws-failover.png).
- [Arquitectura](arquitectura.md) y [procedimiento de recuperación](recuperacion.md).
- Scripts reproducibles y Terraform versionado. Secretos, estados completos y SQL permanecen fuera de Git.

## Demostración funcional sugerida

1. Crear pedido con un cliente y material de catálogo.
2. Asignar FEFO desde Despacho y mostrar que la reserva reduce disponible sin reducir saldo físico.
3. Confirmar salida y mostrar el movimiento único en Kardex.
4. Registrar referencia de factura desde Facturación y mostrar que no aparece otra salida.
5. Exportar pedido, alistamiento, resumen de factura e inventario/PDF y Kardex/CSV.
6. Intentar una acción con rol insuficiente y una escritura con revisión antigua.
7. Simular respuesta incierta y demostrar recuperación del comprobante sin duplicados.
8. Presentar el registro del corte AWS: sesión conservada, escritura por GCP y lectura posterior por AWS.
9. Ensayar por separado el corte total de nube y la promoción de datos; esa prueba continúa pendiente.

## Próximos pasos en orden

1. Resolver con el evaluador el requisito Multi-AZ frente a la restricción de conservar el plan gratuito. No activar pago sin autorización explícita.
2. Ensayar pérdida total de AWS/RDS con aislamiento del escritor, promoción GCP y conciliación de transacciones inciertas.
3. Ensayar failback de datos conservando las escrituras de la base GCP promovida.
4. Medir carga y uso de recursos; completar logs y alertas de réplica.
5. Preparar la entrega antes del vencimiento de la prueba GCP, mostrado como **23 de octubre de 2026**, y retirar recursos después de evaluar para evitar consumo olvidado.

No presentar el proyecto como cumplimiento completo: el failover de aplicación está demostrado; Multi-AZ y recuperación completa de datos entre nubes siguen pendientes.

## Revisión adicional de la guía y del equipo

La sección 4A y la fase 3 solicitan un upstream NGINX con backend de respaldo. En los sitios desplegados NGINX sirve el backend local y Route 53 conmuta entre nubes. Falta configurar y ensayar el failover directo de backend en NGINX; la prueba DNS de 127.677 segundos no satisface por sí sola ese mecanismo específico.

La sección 5 solicita además orquestación automatizada de promoción de MariaDB GCP y posterior resincronización hacia AWS. El runbook describe controles, pero no existe todavía esa automatización probada. La réplica mostró retraso de 0 segundos en muestras; falta comprobar el objetivo de menos de un segundo de forma sostenida bajo carga, indicado en la fase 2.

[Usuarios y trazabilidad](usuarios-y-trazabilidad.md) documenta los cinco carnets adicionales con rol Administrador, inventario compartido, autoría en tablas y bienvenida personalizada de 6 segundos. Estos cambios funcionales no reemplazan los ensayos de infraestructura pendientes.
