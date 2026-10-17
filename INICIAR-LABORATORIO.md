# Empieza aquí: tu laboratorio multicloud

Esta entrega contiene la nueva ruta individual. Cada compañero usa su computadora, cuentas y créditos propios. No se incluyen credenciales. Si recibiste el ZIP, extrae su carpeta en una ruta nueva; el ZIP es una instantánea de código, sin historial Git. Los comandos de clonación del taller corresponden al repositorio cuando se publique esta versión.

1. Instala Git, Node.js 24 y Docker Desktop con contenedores Linux. Abre PowerShell en la raíz de la carpeta extraída, donde está package.json.
2. Sustituye `ca21062` por tu carnet en minúsculas y ejecuta:

```powershell
npm ci
npm run lab -- init --name ca21062
npm run lab -- doctor
npm run lab -- local up
```

3. Abre `http://localhost:8082/aprender` y elige **Mi laboratorio**. Carga el lab.json que creó init. Si necesitas otros puertos, decide y edita lab.json antes de init/up.
4. Comprueba y documenta:

```powershell
npm run lab -- local test
npm run lab -- local failover
npm run lab -- report
```

5. Sigue [la guía completa](docs/laboratorio-personal.md) para tus cuentas AWS/GCP y créditos. Las contraseñas/tokens solo se introducen en las CLI oficiales. Puedes iniciar sin dominio o pedir una subzona por carnet. El dueño necesita tus cuatro NS reales para delegarla; el subdominio no crea servidores.

En el taller, **Mis evidencias** importa `.secrets/labs/TU_CARNET/informe.json`, muestra 19 criterios y permite anotar tu explicación. Una prueba pendiente no se convierte en aprobada por abrir la página. La recuperación completa de datos requiere ensayos supervisados.

Cuando termines localmente, `npm run lab -- local down` conserva los datos. Revisa y retira por separado tus recursos cloud para no consumir créditos olvidados. Conserva el plan FREE/prueba; no se cambia a pago.
