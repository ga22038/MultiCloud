# Usuarios y trazabilidad de Polaris UES

El sistema representa un único espacio de trabajo compartido. Los administradores ven los mismos clientes, materiales, bodegas, existencias, pedidos y movimientos. El usuario no es propietario de un inventario privado. Ocultar existencias de otros compañeros impediría coordinar reservas y salidas sobre el mismo stock.

Los carnets solicitados son CA21062, LP21019, SE21003, SL21010 y JM21008, además de ga22038. El inicio de sesión admite mayúsculas y minúsculas. Todos tienen rol Administrador por solicitud del equipo. La contraseña común se toma del archivo privado de ga22038, nunca del repositorio. Cada contraseña se almacena con scrypt y una sal independiente.

## Autoría y permisos

- Cada usuario inicia sesión con su propio carnet. El backend obtiene el ID, nombre de usuario y rol desde MariaDB. El formulario no puede elegir ni falsificar el autor.
- Pedidos, lotes de inventario, clientes, materiales y bodegas guardan `createdBy`, `createdById` y `createdAt`. Las modificaciones conservan al creador y guardan `updatedBy`, `updatedById` y `updatedAt`.
- Una nueva entrada en un lote existente conserva su primer creador. El kardex identifica por separado al usuario de cada entrada, salida, baja o corrección. Las reservas pertenecen a pedidos y no cambian por sí mismas la existencia física.
- Las tablas muestran **Creado por** y **Última modificación por**. El filtro **Todos los creadores** permite revisar el trabajo de un compañero. Este filtro es visual: no es una restricción de acceso.
- **Auditoría** muestra usuario, rol, fecha, acción, detalle, IDs de registros afectados y UUID de operación. Las correcciones de catálogos, inventario y movimientos conservan los valores anteriores y posteriores que el dominio registra. Las operaciones nuevas vinculan el historial por ID, incluso si un catálogo se elimina.
- Los registros anteriores sin autor verificable se muestran como **Sin registro histórico**. No se atribuyen retrospectivamente a ga22038 ni al último editor.
- Los cambios se guardan junto con la auditoría dentro de la misma transacción. Repetir el mismo UUID no crea otra operación ni otro historial.

Todos los administradores pueden operar sobre los registros del equipo, respetando las reglas de inventario y estados. La aplicación no ofrece editar o borrar entradas de auditoría. Un administrador de la base de datos conserva sus facultades técnicas; este historial no es un almacén externo inalterable.

Compartir la misma contraseña reduce la certeza de autoría: alguien que conoce la clave puede entrar usando el carnet de otro compañero. La atribución identifica la cuenta usada, no demuestra quién estaba frente al teclado. Para una evaluación puede utilizarse la clave solicitada; para uso real conviene asignar una clave diferente a cada persona.

## Bienvenida

El acceso conserva la paleta azul grafito y gris, con una estrella Polaris y órbitas de profundidad hechas en CSS. Después de autenticar correctamente y cargar los datos, aparece una bienvenida personalizada durante **6 segundos**, con rol y botón **Entrar ahora**. El efecto se inspira en la transición de `C:\Dev\Polaris 1.1`, sin modificar ese proyecto.

La bienvenida aparece una vez por inicio de sesión, no al actualizar la página ni al cambiar módulos. Los temporizadores se cancelan al salir. El movimiento decorativo se reduce con `prefers-reduced-motion`. La barra representa el tiempo de bienvenida; no simula progreso de la base de datos ni de la autenticación.
