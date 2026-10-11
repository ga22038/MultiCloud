# Plan de evidencias del proyecto académico

La guía entregada define componentes y pruebas, pero no proporciona una rúbrica numérica. Esta lista convierte esos requisitos en evidencias; no inventa ponderaciones.

| Requisito            | Entrega preparada                                                    | Evidencia real pendiente                                        |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Aplicación funcional | Polaris UES con ocho módulos y reglas de inventario.                 | Demostración completa en las nubes.                             |
| Frontend/backend/API | Next.js, capas separadas, contratos y roles de servidor.             | Acceso público HTTPS y cuentas individuales.                    |
| Docker               | Imagen con etapas y Compose local/servidor/réplica.                  | Compilar y ejecutar contenedores con motor disponible.          |
| NGINX                | Redundancia local de aplicación y configuración TLS por sitio.       | Corte real del primario y evidencia del respaldo.               |
| Terraform            | AWS/GCP, redes, RDS Multi-AZ, VM MariaDB, VPN y DNS opcionales.      | Plan autenticado, revisión de costos, apply y recursos creados. |
| Conectividad         | Cuatro túneles IPSec/BGP definidos.                                  | Estado de túneles, rutas y consultas privadas entre nubes.      |
| MariaDB              | Persistencia local, transacciones y plantilla de réplica.            | Copia consistente y GTID replicando cambios reales.             |
| Failover             | Readiness, bloqueo de escrituras y runbook de aislamiento/promoción. | Medición de RTO/RPO y conciliación de operaciones.              |
| Failback             | Procedimiento que conserva escrituras de GCP.                        | Ensayo de retorno a AWS sin divergencias.                       |
| Carga y monitoreo    | k6 de lectura, logs y auditoría.                                     | Resultados de carga, métricas cloud y alertas de lag.           |
| Documentación        | Arquitectura, API, despliegue y recuperación.                        | Capturas y registro de cada ensayo con versión y fecha.         |

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
2. Restablecer Docker y completar el ensayo local de NGINX y la imagen.
3. Verificar acceso AWS/GCP, cuotas, dominio propio y presupuesto del laboratorio.
4. Revisar y ejecutar Terraform; instalar versión, TLS y permisos mínimos.
5. Configurar y comprobar réplica GTID real antes de habilitar failover de datos.
6. Completar monitoreo, carga, cortes, promoción, retorno y documentación de evidencias.

El proyecto no se considera completamente evaluable en multicloud por tener archivos Terraform válidos. Requiere recursos desplegados y ensayos reproducibles.
