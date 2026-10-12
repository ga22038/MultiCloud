# Acceso Polaris UES: Tierra y estrella guía

El diseño toma como referencia la composición de acceso de [b.well, presentada por Eleken](https://www.eleken.co/cases/b-well): imagen lateral, formulario claro y adaptación móvil que elimina la imagen. La identidad visual y la fotografía espacial son propias de Polaris UES.

## Comportamiento

- El botón del ojo muestra y oculta la contraseña. Inicia oculta y vuelve a ocultarse después de enviar el formulario.
- «Recordar mi usuario» guarda solamente el usuario en este navegador, después de un acceso correcto. Desmarcarlo elimina el dato guardado. No guarda contraseñas ni prolonga la sesión.
- La ayuda explica cómo entrar y a quién solicitar recuperación. No promete un sistema de recuperación automática todavía inexistente.
- En móvil se conserva el formulario y se elimina la imagen. El fondo PNG se solicita mediante CSS únicamente desde 801 píxeles.
- La bienvenida dice «Bienvenido» y el usuario de acceso, sin mostrar el rol. Dura 6 segundos y permite «Entrar ahora».
- El acceso sigue siendo web. No se muestran botones de App Store o Google Play porque no existen aplicaciones publicadas en esas tiendas.

## Imagen original

Herramienta: generación integrada `image_gen`, sin API adicional. PNG generado, sin modificación de píxeles posterior. Archivo del proyecto: `app/public/images/polaris-earth-v1.png`.

La estrella es una interpretación visual de Polaris, no una simulación astronómica de su posición respecto a la Tierra.

Prompt final utilizado:

> Use case: stylized-concept. Asset type: original PNG photographic art for the left half of Polaris UES login, calm premium space theme. Primary request: planet Earth seen from orbit, with a single subtly luminous Polaris guide star in the upper sky. Portrait 4:5 composition. Large graceful curve of Earth in the lower two thirds, realistic soft white cloud systems and subdued deep blue oceans, thin pale blue atmospheric rim. Gentle dawn sunlight at the horizon, a restrained warm ivory glow. Upper third is spacious deep slate-navy space with a very sparse natural star field and one small elegant brighter north star, not a giant graphic. Sophisticated cinematic NASA-like realism, peaceful, luminous, understated, tactile film grain, subdued steel blue and graphite with warm light, medium contrast, photographic depth. Leave uncluttered dark space in bottom quarter for a brief white HTML caption overlay. This is the image asset only, no UI mockup. No text, logos, watermark, labels, astronaut, spacecraft, characters, neon purple, oversaturated sci-fi, artificial orbital rings, icon, diagram or fantasy continents. Design should feel serene and trustworthy, a warm subtle Earth-and-space interpretation of Polaris.

## Verificación

Se comprobó el formulario en 1366 × 900 y 390 × 844 píxeles, sin desbordamiento horizontal. En móvil la imagen está oculta y su `background-image` es `none`. Se verificaron mostrar/ocultar, ayuda desplegable, ingreso de JM21008, retorno al formulario con usuario recordado y contraseña vacía.

La versión actual ocupa toda la pantalla. Una curva SVG amplia y continua separa la imagen del formulario; la imagen usa una mezcla de luminosidad sobre azul grafito para armonizar con la paleta Polaris. Se comprobó en 1366 × 768 y 390 × 844 píxeles, sin desbordamiento horizontal.

Capturas actuales: [escritorio](polaris-ues-login-fullscreen.png) y [móvil](polaris-ues-login-fullscreen-mobile.png). Las capturas `login-earth` anteriores documentan la versión con tarjeta.

## Bienvenida animada

La composición fuente está en `motion/welcome/index.tsx`. Remotion genera un MP4 H.264 de 1920 × 1080, 30 FPS y 180 fotogramas: 6 segundos. La cámara avanza suavemente sobre la Tierra y una estrella guía deja una estela breve. El cierre aclara la escena para pasar al espacio de trabajo.

La aplicación reproduce el archivo mediante video nativo, silencioso y en línea. Remotion es una dependencia de desarrollo; no requiere un servicio adicional en la nube. El saludo personalizado permanece en HTML accesible y no se graba en el video. Usa el usuario de la sesión, con el nombre como alternativa. El texto complementario dice «Un mismo norte. Un equipo conectado» y no expone el rol.

Se verificó reproducción automática silenciosa, duración de 6 segundos, saludo `jm21008`, ausencia del rol, entrada automática con foco en el contenido y botón para omitir. La vista móvil mide 390 × 844 píxeles sin desbordamiento. Capturas: [bienvenida](polaris-ues-welcome-film.png) y [móvil](polaris-ues-welcome-film-mobile.png).

Con movimiento reducido se muestra el póster estático. Si el video falla, el póster conserva la bienvenida. El botón para omitirla está siempre disponible; los temporizadores se cancelan al salir. La bienvenida aparece después de un acceso correcto, no al recargar el ERP.

Renderizar con `npm run motion:render`; se puede añadir `-- --browser-executable="ruta/al/navegador"` para usar Chrome instalado. Comprobar la composición con `npx tsc -p tsconfig.json`.

Esta actualización utiliza los servidores existentes en AWS y GCP. No necesita ampliar la infraestructura ni actualizar los planes de facturación.

## Publicación verificada

El 11 de octubre de 2026 se publicó la versión `256ea17fcceb` en AWS y GCP, con la misma imagen `sha256:40ec82548b0fdd788997ae44f4d05397a0443020a45ae1c947e62741f7222b7d`. [GitHub Actions](https://github.com/ga22038/MultiCloud/actions/runs/38187019731) y Cloud Build `0f5391db-d826-4248-946a-ce650b10f3b9` terminaron correctamente.

Ambas aplicaciones están saludables por HTTPS. Se comprobaron inicio de sesión, coincidencia del MP4 y póster con los archivos locales, solicitudes parciales del video y conservación del estado de datos en revisión 9. El dominio principal reprodujo el video y mostró «Bienvenido, jm21008» sin rol. [Registro de publicación](evidence-design-release.json), [login publicado](polaris-ues-login-published.png) y [bienvenida publicada](polaris-ues-welcome-published.png).
