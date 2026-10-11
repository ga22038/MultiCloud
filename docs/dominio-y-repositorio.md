# Dominio y repositorio del laboratorio

Consulta realizada el 11 de octubre de 2026. No se modificaron registros DNS.

## GitHub

Repositorio indicado: `https://github.com/ga22038/MultiCloud.git`.

Es público. Se verificó autenticación como `ga22038` con permiso de escritura. El repositorio local usa este destino como `origin`; los commits de esta entrega llevan autor `ga22038` y correo privado de GitHub. Antes de publicar, comprobar que no se incluyen secretos.

## Vercel

El token permitió consultar `polarisenterprisesv.com`. Sus servidores DNS son `ns1.vercel-dns.com` y `ns2.vercel-dns.com`.

La consulta no encontró registros A, AAAA, CNAME o NS con nombre `multicloud`. No equivale a haber creado o reservado el nombre.

Propuesta coherente con el Terraform existente:

| Nombre                                   | Función                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `multicloud.polarisenterprisesv.com`     | Zona del laboratorio delegada a Route 53 mediante registros NS en Vercel. |
| `app.multicloud.polarisenterprisesv.com` | Entrada de la aplicación con conmutación por salud.                       |
| `aws.multicloud.polarisenterprisesv.com` | Sitio primario y comprobación de disponibilidad.                          |
| `gcp.multicloud.polarisenterprisesv.com` | Sitio de respaldo y comprobación de disponibilidad.                       |

Para configurar los NS en Vercel primero se necesitan los nameservers reales de la zona Route 53. Para los registros de los sitios se necesitan las IP de las máquinas del proyecto. No usar IP de otras aplicaciones ni `127.0.0.1` como destino público.

El token que se había colocado en `.env.example` se trasladó a `.secrets/credentials.env`, y la plantilla quedó vacía. Como apareció en una salida de inspección, debe revocarse y sustituirse. El reemplazo debe guardarse solamente en el archivo privado.
