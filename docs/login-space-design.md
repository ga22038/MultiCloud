# Acceso Polaris UES: Tierra y estrella guía

El diseño toma como referencia la composición de acceso de [b.well, presentada por Eleken](https://www.eleken.co/cases/b-well): imagen lateral, formulario claro y adaptación móvil que elimina la imagen. La identidad visual y la fotografía espacial son propias de Polaris UES.

## Comportamiento

- El botón del ojo muestra y oculta la contraseña. Inicia oculta y vuelve a ocultarse después de enviar el formulario.
- «Recordar mi usuario» guarda solamente el usuario en este navegador, después de un acceso correcto. Desmarcarlo elimina el dato guardado. No guarda contraseñas ni prolonga la sesión.
- La ayuda explica cómo entrar y a quién solicitar recuperación. No promete un sistema de recuperación automática todavía inexistente.
- En móvil se conserva el formulario y se elimina la imagen. El fondo PNG se solicita mediante CSS únicamente desde 801 píxeles.
- La bienvenida personalizada conserva sus 6 segundos y el botón «Entrar ahora».
- El acceso sigue siendo web. No se muestran botones de App Store o Google Play porque no existen aplicaciones publicadas en esas tiendas.

## Imagen original

Herramienta: generación integrada `image_gen`, sin API adicional. PNG generado, sin modificación de píxeles posterior. Archivo del proyecto: `app/public/images/polaris-earth-v1.png`.

La estrella es una interpretación visual de Polaris, no una simulación astronómica de su posición respecto a la Tierra.

Prompt final utilizado:

> Use case: stylized-concept. Asset type: original PNG photographic art for the left half of Polaris UES login, calm premium space theme. Primary request: planet Earth seen from orbit, with a single subtly luminous Polaris guide star in the upper sky. Portrait 4:5 composition. Large graceful curve of Earth in the lower two thirds, realistic soft white cloud systems and subdued deep blue oceans, thin pale blue atmospheric rim. Gentle dawn sunlight at the horizon, a restrained warm ivory glow. Upper third is spacious deep slate-navy space with a very sparse natural star field and one small elegant brighter north star, not a giant graphic. Sophisticated cinematic NASA-like realism, peaceful, luminous, understated, tactile film grain, subdued steel blue and graphite with warm light, medium contrast, photographic depth. Leave uncluttered dark space in bottom quarter for a brief white HTML caption overlay. This is the image asset only, no UI mockup. No text, logos, watermark, labels, astronaut, spacecraft, characters, neon purple, oversaturated sci-fi, artificial orbital rings, icon, diagram or fantasy continents. Design should feel serene and trustworthy, a warm subtle Earth-and-space interpretation of Polaris.

## Verificación

Se comprobó el formulario en 1366 × 900 y 390 × 844 píxeles, sin desbordamiento horizontal. En móvil la imagen está oculta y su `background-image` es `none`. Se verificaron mostrar/ocultar, ayuda desplegable, ingreso de JM21008, retorno al formulario con usuario recordado y contraseña vacía.

Capturas: [escritorio](polaris-ues-login-earth-desktop.png) y [móvil](polaris-ues-login-earth-mobile.png).
