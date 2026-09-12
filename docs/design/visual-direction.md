# Direccion visual: Arctic Instrument

Estado al 2026-09-06: Polar Command Deck es la barra de inicio. Este documento
conserva la evolucion visual de AGS y Quickshell; los estados de las fases
anteriores son evidencia historica, no una seleccion de runtime.

Entrega al 2026-09-08: [base visual compartida de Polar](polar-desktop-phase-1.md)
integrada y validada en la sesion con autorizacion R2. Fondo, Rofi, Kitty,
decoracion y preferencia GTK comparten la direccion Arctic. El nuevo login
completo y la paridad clara/Qt permanecen pendientes; la barra no se modifica.

## Vision

Arctic Instrument convierte el escritorio en una herramienta tecnica, fria y
precisa. La interfaz debe permanecer tranquila durante el uso normal y ganar
contraste solo cuando comunica foco, actividad, contenido o riesgo.

No busca parecer un dashboard decorativo ni una interfaz gamer. La informacion
principal se reconoce en menos de un segundo y los detalles operativos aparecen
cuando se solicitan.

## Principios

1. Jerarquia antes que decoracion.
2. El color comunica estado; no delimita cada contenedor.
3. Una superficie pasiva no necesita borde propio.
4. La elevacion se reserva para controles, popovers y overlays.
5. El contenido multimedia puede ser expresivo; la operacion del sistema debe
   ser sobria.
6. Dark y light comparten estructura, jerarquia y estados.

## Escala canonica

### Tipografia

| Rol | Tamano | Uso |
| --- | ---: | --- |
| Meta | 11px | hints, estado secundario, shortcuts |
| Body | 13px | etiquetas y contenido principal |
| Title | 15px | titulos de seccion y filas importantes |
| Heading | 20px | titulo de overlay |

IBM Plex Sans es la familia principal. IBM Plex Mono se reserva para hora,
porcentajes, temperaturas y valores tecnicos.

### Espaciado

La escala estable es `4 / 8 / 12 / 16 / 24px`. Valores intermedios existentes
pueden mantenerse durante la migracion, pero no deben introducirse nuevos.

### Forma

- `10px`: controles compactos.
- `14px`: controles y filas.
- `18px`: paneles y overlays.
- `pill`: indicadores, badges y progreso.

### Superficies

- Base: fondo del panel.
- Interactive: control accionable o fila seleccionable.
- Overlay: superficie flotante con borde y sombra.

No debe haber mas de dos niveles de contenedores visibles.

## Color y estados

- Frost blue: foco e interaccion primaria.
- Mint: exito, conectado o reproduciendo.
- Amber: advertencia y mantenimiento pendiente.
- Rose/red: error, riesgo o accion destructiva.
- Neutros: informacion normal y controles inactivos.

Los estados activos usan un acento lateral, icono o fondo tenue. Evitar colorear
simultaneamente borde, fondo, texto y sombra salvo en alertas reales.

## Superficies objetivo

### Control Center

- Encabezado dominante y navegacion secundaria compacta.
- Seccion exterior plana; filas y controles crean el ritmo interno.
- Listas continuas con separadores suaves, no una tarjeta por elemento.
- Elementos conectados o predeterminados reciben un acento lateral.
- Accion primaria rellena, secundaria discreta y destructiva diferenciada.

### Barra

Estado: Instrument Rail implementada y validada en dark/light.

Orden de lectura: launcher y workspaces, ventana activa, estado frecuente,
alertas y hora. Salud normal y cambio de tema viven dentro de Control Center.
Spotify aparece en la barra solo cuando aporta contexto.

La barra principal conserva audio, red, Spotify condicional, salud y reloj. La
secundaria muestra solo launcher, workspaces del monitor, contexto activo y
reloj. Los detalles de salud permanecen en su popover.

### Command Palette

Seleccion mediante fondo tenue y acento lateral. Categorias pequenas, copy en
espanol y footer reducido a navegacion/accion.

### Spotify

Estado desconectado compacto con un unico CTA. Portada, progreso y transporte
solo aparecen cuando existe contenido reproducible. El color derivado del album
es exclusivo de esta superficie.

## Criterios de exito

- La funcion y estado principal de cada overlay se entienden en menos de un
  segundo.
- No hay texto visible menor a 11px.
- No hay mas de dos superficies anidadas.
- Los estados normal, hover, focus, active, disabled, success, warning y error
  se distinguen sin cambiar dimensiones.
- No se muestran placeholders tecnicos ni controles inactivos sin contexto.
- Las capturas dark/light son coherentes a 1920x1080 en ambos monitores.

## Fases

1. Tokens canonicos y Control Center.
2. Barra y jerarquia de observabilidad. Implementada.
3. Spotify conectado/desconectado.
4. Command Palette y popovers.
5. Paridad light, accesibilidad y limpieza de tokens heredados.

## Exploracion Quickshell: Polar Command Deck

Estado inicial (2026-08-19): prototipo paralelo validado en runtime. Desde el
2026-09-06, Polar es canonico y AGS queda como recuperacion.

La siguiente iteracion amplifica Arctic Instrument con una composicion nativa
de QtQuick: constelacion elastica de workspaces, cinta de contexto por monitor,
transiciones de estado y cluster tecnico de tiempo/display. La ambicion visual
no autoriza por si sola un cambio de runtime.

La primera composicion fue validada en dos monitores a 1920x1080: geometria,
reserva superior, foco por monitor, hot reload y fallback sin ventana activa se
comportan correctamente. La siguiente fase incorpora estado nativo de audio,
red, multimedia y bandeja sin convertir la barra en un dashboard permanente.

La arquitectura, guardas y fases de migracion se definen en
`docs/architecture/quickshell-migration.md`.

### Focus Transfer 2.0

Estado: implementado y validado en runtime.

El cambio de monitor se convierte en un gesto espacial: el origen pierde
energia, una estela viaja hacia el borde fisico correcto y el destino expande
su contexto y estado. La secuencia dura 680ms, no usa loops ni shaders y tolera
cambios rapidos de foco sin quedar en un estado intermedio.

El cluster sigue una regla adaptativa:

- Foco: volumen, conectividad y reloj; Bluetooth/energia solo cuando aportan
  informacion real.
- Secundario: identidad del display, reloj y alertas criticas.
- Normalidad permanece compacta; amber y rose se reservan para degradacion o
  riesgo.

La fase se considera cerrada con geometria estable en 3840x1080, audio reactivo
y estado nativo sin comandos externos. Multimedia MPRIS, bandeja y popovers
permanecen fuera de alcance para la siguiente propuesta.

### Capsula multimedia MPRIS

Estado: implementada y validada en runtime.

La musica ocupa el slot central solo cuando aporta contexto y solo en el
monitor enfocado. Sustituye la cinta de ventana en vez de competir con ella, de
modo que audio, red y reloj mantienen su geometria. Portada, titulo, artista y
transporte forman una unica superficie compacta.

La seleccion favorece al reproductor activo y conserva metadata pausada para
que el control no desaparezca de forma abrupta. Mint comunica reproduccion;
frost blue comunica pausa. La ausencia de contenido devuelve el contexto de
ventana sin placeholders.

No se simula progreso porque requeriria refresco continuo. La portada se limita
a una miniatura y los controles no dependen del tema de iconos del host. Un
reinicio limpio estabilizo el proceso alrededor de 101MiB; play/pausa reacciono
sin errores y restauro la pista y el estado iniciales.

### Bandeja y alertas adaptativas

Estado: implementada; validacion pasiva completada.

La bandeja es una herramienta de excepcion, no una segunda barra de tareas. Los
elementos pasivos desaparecen, la atencion gana prioridad y el monitor enfocado
muestra como maximo cuatro iconos antes de agrupar el resto en un contador.

El monitor secundario no replica aplicaciones. Solo presenta un resumen
`ALERT` amber o rose cuando red, Bluetooth, energia o StatusNotifier comunican
degradacion. En normalidad conserva identidad de display y reloj.

Las notificaciones emergentes siguen perteneciendo a `mako`; Polar no compite
por su bus ni almacena historico en esta fase. Acciones y alertas criticas fueron
validadas y restauradas. Los menus abandonan el `QMenu` de plataforma y usan un
popover Polar propio: carbon, frost, filas planas, checks y navegacion
drill-down para submenus. DBusMenu conserva las acciones como fuente nativa.

### Control Center Polar

Estado: implementado; validacion visual pasiva completada.

El primer overlay nativo extiende la instrument rail como un modulo tecnico
vertical, no como una coleccion de widgets. Un encabezado dominante establece
monitor y workspace; cuatro vistas compactas separan Resumen, Audio, Red y
Pantallas.

Resumen reserva el contraste mayor para la salud global. Audio presenta un
control continuo y protegido. Red evita exponer el SSID y Pantallas convierte
la geometria fisica en tarjetas comparables, ahora precedidas por presets
compactos `DUAL`, `SOLO HDMI` y `SOLO DP`. Carbon domina las superficies; frost
indica foco, mint el preset activo, amber una operacion y rose confirmacion o
riesgo.

Solo una instancia puede existir entre monitores. La entrada lateral acompana
Focus Transfer y se reduce a opacidad en reduced motion. Acciones de sesion,
sistema y layouts permanecen en AGS hasta una fase con rollback dedicado.

La superficie no conserva un alto fijo: cada vista contrae el panel al contenido
entre 378px y 486px. Pantallas tambien se contrae cuando queda una sola salida.
El cambio de tab anima la geometria sin dejar grandes zonas
vacias ni desplazar el anclaje superior.

Los presets de una salida requieren dos pulsaciones dentro de cinco segundos.
El destino debe estar activo antes de retirar la otra pantalla; `DUAL` funciona
como recuperacion inmediata y la eleccion sobrevive reinicios de Quickshell.
