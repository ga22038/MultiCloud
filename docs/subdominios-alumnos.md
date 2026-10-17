# Subdominios por carnet

Propuesta para los integrantes documentados. **Todavía no creados ni delegados.** Cada alumno usa sus recursos y créditos; el dominio no comparte credenciales.

| Carnet  | Zona exclusiva propuesta                   |
| ------- | ------------------------------------------ |
| CA21062 | ca21062.multicloud.polarisenterprisesv.com |
| LP21019 | lp21019.multicloud.polarisenterprisesv.com |
| SE21003 | se21003.multicloud.polarisenterprisesv.com |
| SL21010 | sl21010.multicloud.polarisenterprisesv.com |
| JM21008 | jm21008.multicloud.polarisenterprisesv.com |

Cada zona tendrá aws, gcp y app. No requiere registrar otro dominio; la zona DNS y recursos cloud del alumno pueden consumir créditos.

1. El alumno configura `delegated` y su zona en lab.json, verifica identidad y crea su infraestructura.
2. Ejecuta `npm run lab -- terraform aws-only outputs` y entrega los cuatro `multicloud_nameservers`. Son valores públicos, no credenciales.
3. El propietario crea un registro **NS del subdominio exacto** en la zona padre `multicloud.polarisenterprisesv.com`. No reemplaza los NS de la zona padre ni modifica sus registros app/aws/gcp existentes.
4. El alumno comprueba `Resolve-DnsName SU_ZONA -Type NS` y los registros A de sus tres nombres, que apuntan a sus VM.
5. Emite sus certificados con `npm run lab -- cloud deploy tls` y ejecuta pruebas.

Se necesitan los NS reales de cada alumno para completar la delegación. Alternativas: dominio comprado y controlado por él, o empezar por IP dejando HTTPS/DNS pendientes. No se compran dominios ni se activan planes pagados automáticamente.
