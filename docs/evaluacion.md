# Plan de evidencias del proyecto académico

La guía entregada define componentes y pruebas, pero no proporciona una rúbrica numérica. Esta lista convierte esos requisitos en evidencias; no inventa ponderaciones.

Actualización del 11 de octubre de 2026: [Polaris UES está desplegado en GCP](despliegue-gcp.md), con HTTPS, contenedores, MariaDB privada, respaldo restaurado y prueba funcional completa. AWS y los ensayos entre nubes continúan pendientes.

| Requisito            | Entrega preparada                                                           | Evidencia real pendiente                                    |
| -------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Aplicación funcional | Ocho módulos y flujo completo de pedido comprobado en GCP.                  | Repetir en AWS y durante cortes entre nubes.                |
| Frontend/backend/API | Next.js, capas separadas, HTTPS y sesión real en GCP.                       | Cuentas individuales adicionales para operadores.           |
| Docker               | Imágenes construidas en Cloud Build y contenedores activos en GCP.          | Desplegar los contenedores del sitio AWS.                   |
| NGINX                | Redundancia local de aplicación y configuración TLS por sitio.              | Corte real del primario y evidencia del respaldo.           |
| Terraform            | Root GCP aplicado: 25 recursos y estado remoto; plan posterior sin cambios. | Integrar AWS sin duplicar el estado GCP existente.          |
| Conectividad         | Cuatro túneles IPSec/BGP definidos.                                         | Estado de túneles, rutas y consultas privadas entre nubes.  |
| MariaDB              | Base privada GCP con TLS, disco persistente y respaldo restaurado.          | Configurar réplica GTID desde AWS y comprobar retraso real. |
| Failover             | Readiness, bloqueo de escrituras y runbook de aislamiento/promoción.        | Medición de RTO/RPO y conciliación de operaciones.          |
| Failback             | Procedimiento que conserva escrituras de GCP.                               | Ensayo de retorno a AWS sin divergencias.                   |
| Carga y monitoreo    | k6 preparado, auditoría y comprobación HTTPS de Cloud Monitoring.           | Carga medida, logs centrales y alertas operativas y de lag. |
| Documentación        | Arquitectura, API, despliegue y recuperación.                               | Capturas y registro de cada ensayo con versión y fecha.     |

## Demostración funcional sugerida

1. Crear pedido con un cliente y material de catálogo.
2. Asignar FEFO desde Despacho y mostrar que la reserva reduce disponible sin reducir saldo físico.
3. Confirmar salida y mostrar el movimiento único en Kardex.
4. Registrar referencia de factura desde Facturación y mostrar que no aparece otra salida.
5. Exportar pedido, alistamiento, resumen de factura e inventario/PDF y Kardex/CSV.
6. Intentar una acción con rol insuficiente y una escritura con revisión antigua.
7. Simular respuesta incierta y demostrar recuperación del comprobante sin duplicados.
8. Ejecutar cortes separados de aplicación y nube completa, midiendo recuperación y pérdida real.
9. Crear una operación mientras GCP es primario y demostrar que queda conservada tras volver a AWS.

## Próximos pasos en orden

1. Revisar interfaz y flujos con el usuario; ajustar campos del negocio y objetivos de evaluación.
2. Completar el ensayo local de redundancia NGINX cuando Docker Desktop esté disponible. Los contenedores de GCP ya están activos.
3. Verificar acceso, créditos y cuotas AWS; considerar el vencimiento de la prueba GCP el 23 de octubre de 2026.
4. Integrar y aplicar Terraform AWS; desplegar TLS y permisos mínimos conservando el estado GCP existente.
5. Configurar y comprobar réplica GTID real antes de habilitar failover de datos.
6. Completar monitoreo, carga, cortes, promoción, retorno y documentación de evidencias.

El proyecto no se considera completamente evaluable en multicloud por tener archivos Terraform válidos. Requiere recursos desplegados y ensayos reproducibles.
