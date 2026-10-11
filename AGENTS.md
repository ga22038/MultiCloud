# Instrucciones del proyecto

Usar Caveman lite: respuestas concisas, profesionales y completas, en el idioma del usuario.
Consultar C:\Users\danie\.codex\RTK.md y prefijar los comandos de terminal con rtk.

## Credenciales

- Las credenciales locales se guardan en .secrets/credentials.env. Las claves JSON y otros archivos privados tambien van en .secrets/.
- No imprimir, resumir, copiar a documentos, incluir en capturas ni registrar valores secretos. No leer el archivo completo para mostrarlo en una herramienta o respuesta.
- Para usar credenciales, cargar el archivo con scripts/Import-LocalEnvironment.ps1 y pasarlas mediante variables de entorno o los mecanismos oficiales de cada proveedor.
- Mantener .secrets/, archivos .env, claves privadas y estados de Terraform fuera de Git. Nunca usar git add -f para incluirlos.
- .env.example contiene solamente nombres de variables y valores publicos. Nunca colocar secretos reales en esa plantilla.
- Enviar cada credencial solamente al proveedor al que pertenece y dentro de una accion autorizada por el usuario. No incluir secretos en URLs o argumentos visibles.
- La disponibilidad de una credencial no autoriza despliegues, compras, cambios de permisos, publicaciones ni modificaciones externas adicionales.
- Antes de crear commits, comprobar que los archivos de credenciales continuan excluidos de Git.

## Planes de nube

- Conservar el plan gratuito o de prueba vigente en AWS y Google Cloud. No activar un plan de pago ni actualizar la facturacion.
- Antes de aprovisionar recursos, verificar creditos, vencimiento y servicios disponibles dentro del plan actual. Tener credito no significa que todos los servicios sean gratuitos.
- Si un requisito necesita actualizar a pago, detener ese cambio y explicar la limitacion al usuario.
