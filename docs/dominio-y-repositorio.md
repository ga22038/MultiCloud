# Dominio y repositorio del laboratorio

Actualizado el 11 de octubre de 2026. Polaris UES utiliza una subzona Route 53 delegada desde Vercel.

## GitHub

Repositorio indicado: `https://github.com/ga22038/MultiCloud.git`.

Es público. Se verificó autenticación como `ga22038` con permiso de escritura. El repositorio local usa este destino como `origin`; los commits de esta entrega llevan autor `ga22038` y correo privado de GitHub. Antes de publicar, comprobar que no se incluyen secretos.

## Vercel

El token permitió consultar `polarisenterprisesv.com`. Sus servidores DNS son `ns1.vercel-dns.com` y `ns2.vercel-dns.com`.

Inicialmente se crearon registros A para el sitio GCP. Durante la integración AWS se verificaron sus equivalentes en Route 53, se respaldaron los registros anteriores y se sustituyeron únicamente los tres A del proyecto por los cuatro NS de `multicloud`. El dominio principal y los registros de otras aplicaciones permanecen en Vercel.

Configuración activa:

| Nombre                                   | Función                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `multicloud.polarisenterprisesv.com`     | Zona del laboratorio delegada a Route 53 mediante registros NS en Vercel. |
| `app.multicloud.polarisenterprisesv.com` | Entrada de la aplicación con conmutación por salud.                       |
| `aws.multicloud.polarisenterprisesv.com` | Sitio primario y comprobación de disponibilidad.                          |
| `gcp.multicloud.polarisenterprisesv.com` | Sitio de respaldo y comprobación de disponibilidad.                       |

La zona Route 53 es `Z03571242N6ORBZWWJ1VW`. Sus nameservers son `ns-1519.awsdns-61.org`, `ns-1928.awsdns-49.co.uk`, `ns-474.awsdns-59.com` y `ns-996.awsdns-60.net`. AWS usa `18.227.139.179`; GCP usa `34.122.222.237`. El dominio común tiene registros PRIMARY/SECONDARY, TTL 60 y comprobación HTTPS de readiness. El [ensayo de conmutación](evidence-app-failover.json) conservó sesión y escritura. No ejecutar el generador inicial de registros A sobre la zona ya delegada.

El token que se había colocado en `.env.example` se trasladó a `.secrets/credentials.env`, y la plantilla quedó vacía. Como apareció en una salida de inspección, debe revocarse y sustituirse. El reemplazo debe guardarse solamente en el archivo privado.
