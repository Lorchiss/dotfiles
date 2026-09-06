# Migracion visual a Quickshell

Estado al 2026-09-06: Polar es la barra canonica de inicio; AGS es recuperacion.

## Objetivo

Construir una shell mas expresiva y mantenible con QML/QtQuick sin arriesgar la
sesion estable. La decision de arranque del 2026-09-06 promueve la barra ya
implementada a `quickshell.service`; no declara paridad total con los overlays
de AGS. Las fases siguientes conservan su evidencia historica.

## Arquitectura inicial

- `config/quickshell/shell.qml`: punto de entrada declarativo.
- `config/quickshell/Bar.qml`: una `PanelWindow` por pantalla.
- `config/quickshell/Theme.qml`: tokens visuales compartidos.
- `config/quickshell/components/`: constelacion de workspaces, contexto activo
  y cluster temporal/monitor.
- `config/systemd/user/quickshell-prototype.service`: unidad manual y en
  conflicto con `ags.service`; no puede habilitarse porque no tiene `WantedBy`.

## Fases

1. Estructura y barra visual con datos nativos de Hyprland.
2. Audio, red, Bluetooth, MPRIS y bandeja con servicios nativos de Quickshell.
3. Overlays: control center, command palette y multimedia.
4. Pruebas dark/light, dos monitores, consumo y recuperacion ante fallos.
5. Cambio canonico de AGS a Quickshell mediante una decision explicita.

## Guardas

- No iniciar AGS y Quickshell simultaneamente.
- No habilitar el servicio prototipo al arranque.
- Mantener AGS disponible como recuperacion, sin autostart.
- Usar el wrapper de sesion para iniciar `quickshell.service`; no agregar
  entradas en `default.target` ni otra invocacion directa de la barra.
- Fijar la API objetivo en Quickshell `0.3.x` y revisar cambios antes de subir
  de version mientras el proyecto siga previo a `1.0`.
- Usar modulos `qs` sintetizados por Quickshell; no mantener un `qmldir`
  manual para los componentes internos.

## Validacion

Validacion estatica, disponible sin instalar Quickshell:

```bash
bash bootstrap/quickshell-check.sh
```

La validacion real y el arranque de la shell requieren instalar Quickshell y
autorizacion separada por tratarse de cambios de sistema y sesion.

## Evidencia runtime

Validado el 2026-08-19 con Quickshell `0.3.0-2` sobre Hyprland y dos monitores
1920x1080.

- La configuracion carga en Wayland mediante `quickshell-prototype.service`.
- El servicio permanece activo con `NRestarts=0` y sin errores QML.
- Ambos monitores reservan 64px y renderizan su propia barra.
- Workspaces y foco se obtienen del modelo nativo de Hyprland.
- La cinta central muestra la ventana activa solo en el monitor enfocado.
- AGS queda detenido durante la prueba por el conflicto de unidad esperado.
- El prototipo no esta habilitado al arranque; AGS conserva el rol canonico.

## Fase 2: Focus Transfer y estado adaptativo

Implementada y validada el 2026-08-19.

- `FocusState` mantiene monitor actual/anterior, direccion fisica y secuencia de
  transicion; eventos repetidos no generan una animacion nueva.
- Focus Transfer coordina contraccion, estela direccional y expansion durante
  680ms. Cambios rapidos reinician la secuencia con el ultimo foco como fuente
  de verdad.
- `QS_REDUCED_MOTION=1` reduce la transicion a 120ms sin estela prolongada. La
  rama esta implementada y validada estaticamente; no se activo en esta sesion.
- Audio usa PipeWire y `PwObjectTracker`; red, Bluetooth y energia usan los
  servicios nativos de Quickshell, sin polling ni procesos externos.
- El monitor enfocado muestra audio y conectividad. El secundario conserva
  identidad, reloj y alertas relevantes.
- Bluetooth se oculta sin dispositivos conectados y energia se oculta en
  desktops sin bateria real.
- El unico control rapido habilitado es audio: click para mute y rueda en pasos
  de 5%, limitado a 0-100%.

Validacion runtime:

- Transferencias capturadas en ambas direcciones sobre dos monitores 1920x1080.
- Diez cambios de foco cada 60ms sin bloqueo, reinicio ni estado visual atascado.
- Audio reacciono a 90% y mute; se restauro exactamente a PCM 55705, 85% y no
  mute.
- Red detectada como `LAN + WI-FI`; Bluetooth y bateria ausentes no generan
  placeholders.
- `NRestarts=0`, `ExecMainStatus=0` y sin errores QML. El proceso previo al
  reinicio limpio uso cerca de 159MB; el runtime final estabilizo alrededor de
  81MB.

Limitacion observada:

- Un hot reload posterior a editar varios modulos `qs` en el mismo lote perdio
  temporalmente `qs.components` y `qs.services`. Quickshell mantuvo la
  configuracion anterior activa; un reinicio limpio del servicio cargo la fase
  completa sin errores. Para cambios estructurales de modulos, validar mediante
  reinicio controlado y no asumir que el hot reload es evidencia suficiente.

## Fase 3: capsula multimedia MPRIS

Implementada y validada en runtime el 2026-08-19.

- `MediaState` consume `Mpris.players` directamente y prioriza el reproductor
  que esta reproduciendo; si ninguno lo hace, conserva el primero con metadata.
- La capsula reemplaza la cinta de contexto solo en el monitor enfocado. El
  monitor secundario no replica contenido multimedia.
- Portada, titulo, artista y transporte aparecen mientras exista contenido
  controlable, incluso si esta pausado.
- Reproduccion usa mint; pausa conserva frost blue. Los controles deshabilitados
  pierden contraste sin alterar la geometria.
- La portada remota se decodifica como miniatura de 56px para limitar memoria.
- No se introdujeron procesos externos, polling, temporizadores ni dependencias.
- Sin reproductor o metadata valida, la cinta de contexto recupera el espacio
  central mediante la misma transicion de ancho y opacidad.

Validacion runtime:

- El reinicio limpio cargo sin warnings, con `NRestarts=0` y
  `ExecMainStatus=0`.
- Con portada y reproduccion activas, el proceso estabilizo alrededor de 101MiB;
  antes del reinicio, los hot reload acumulados mantenian cerca de 196MiB.
- El ciclo autorizado pausa/reproduccion mantuvo el mismo track MPRIS y
  restauro el estado inicial `Playing`.
- No se probaron anterior/siguiente porque cambiar de pista no ofrece una
  restauracion determinista.

## Fase 4: bandeja y alertas adaptativas

Implementada el 2026-08-19 con validacion pasiva en runtime.

- `TrayState` consume `SystemTray.items`, oculta elementos `Passive`, ordena
  `NeedsAttention` primero y limita la superficie a cuatro iconos mas contador.
- La bandeja aparece solo en el monitor enfocado. El secundario muestra un
  unico resumen `ALERT` cuando existe una degradacion real.
- `AlertState` agrega red, Bluetooth, energia y `NeedsAttention` sin duplicar
  los chips completos en el monitor secundario.
- Click primario, click medio y rueda se conectan directamente a StatusNotifier.
  `TrayMenu` renderiza el DBusMenu nativo con `PopupWindow` y `QsMenuOpener`; no
  se usan comandos externos.
- Quickshell registra `org.kde.StatusNotifierWatcher` y su host. En la prueba,
  cuatro aplicaciones se registraron: tres `Active` visibles y una `Passive`
  correctamente oculta.
- `mako` conserva `org.freedesktop.Notifications`. El prototipo no instancia
  `NotificationServer`; el checker bloquea futuras introducciones accidentales.
- Tras un reinicio limpio, la barra permanecio estable en 3840x1080, sin errores
  QML, solapamientos ni reinicios. El proceso uso cerca de 104MiB.

Validacion runtime:

- Bloquear Bluetooth produjo `RADIO BT BLOQUEADO` en el monitor enfocado y
  `ALERT 1 CRIT` en el secundario. El adaptador se restauro a `unblocked`.
- La activacion primaria de qBittorrent respondio y se revirtio; foco, workspace,
  floating, fullscreen, geometria y conteo de ventanas volvieron al baseline.
- El menu personalizado fue capturado con fondo carbon, borde frost, iconos,
  checks y separadores correctos. Los submenus usan navegacion drill-down para
  evitar cadenas de popups fragiles bajo Wayland.
- Foco, geometria, floating y fullscreen de VS Code quedaron restaurados. El
  workspace termino con tres ventanas frente a cuatro al inicio porque una
  superficie no identificada dejo de estar mapeada; no se reabrio ninguna
  aplicacion para forzar artificialmente el conteo.
- `NeedsAttention` y warning requieren un evento real para completar QA; la ruta
  critical ya quedo validada.

## Fase 5: Control Center Polar

Implementada el 2026-08-19 con validacion visual pasiva en runtime.

- `ControlCenter` es un `PopupWindow` nativo de 430px de ancho anclado al reloj
  del monitor enfocado. Su alto se adapta a cada vista entre 378px y 486px;
  click exterior, boton de cierre y Escape cierran el overlay.
- `ControlCenterState` garantiza un unico propietario entre barras; abrirlo en
  un monitor cierra cualquier instancia anterior.
- La entrada combina opacidad y desplazamiento lateral. Reduced motion elimina
  el desplazamiento y limita la duracion a 120ms.
- Resumen agrega alertas, bandeja, audio, conectividad y energia sin polling.
- Audio controla volumen exacto 0-100%, rueda en pasos de 5% y mute mediante el
  sink PipeWire ya rastreado.
- Red presenta LAN, Wi-Fi y Bluetooth sin revelar SSID. En esta fase permanece
  informativa y no modifica conexiones.
- Pantallas consume `Hyprland.monitors` y calcula geometria, orientacion,
  resolucion, escala, posicion, workspace y foco sin valores fijos. Los presets
  `DUAL`, `SOLO HDMI` y `SOLO DP` operan por el socket IPC nativo de Hyprland,
  sin `Process`, shell ni polling.
- Los modos de una salida exigen doble confirmacion y solo pueden apagar la
  alternativa si el destino ya esta activo. `DUAL` queda siempre disponible
  como recuperacion por UI o `qs ipc call polar setDisplayMode dual`.
- La seleccion se persiste en `Quickshell.statePath("display-mode")` y se
  reaplica una vez al iniciar; una salida fisicamente ausente nunca provoca que
  se apague la salida restante.
- `Super+C` abre Polar mediante el endpoint IPC nativo `polar`; si Quickshell
  no esta activo, el despachador conserva `ags toggle control-center` como
  fallback. Sesion y acciones generales de sistema permanecen en AGS. El
  prototipo no cambia autostart ni runtime canonico.

Validacion runtime:

- Las cuatro vistas fueron capturadas en 3840x1080 sin recortes ni
  solapamientos.
- La altura fija inicial de 610px dejaba espacio negativo. Se reemplazo por una
  geometria adaptativa animada y Resumen cierra inmediatamente tras Energia.
- La prueba inicial descubrio dos popups simultaneos; el coordinador single-owner
  corrigio la carrera y la captura final mostro una sola instancia.
- Un hot reload de scaffolding fallo por un import `QtQuick` temporal ausente.
  Quickshell mantuvo la configuracion anterior y la recarga corregida cargo sin
  warnings; el temporizador de QA fue eliminado.
- El endpoint `polar` abrio el panel en `HDMI-A-1`, reporto un unico propietario
  y una segunda invocacion lo cerro sin estado residual.
- La ruta nativa de audio se valido en un ciclo R2 de 73% a 68%, mute y
  restauracion exacta a 73% sin mute. El scaffolding IPC usado para QA fue
  retirado al terminar.
- El preset `DUAL` reaplico la geometria 3840x1080 sin reinicios. Luego `SOLO
  HDMI` dejo `HDMI-A-1` activa en 1920x1080, marco `DP-1` como deshabilitada y
  traslado los workspaces al monitor restante. La preferencia persistida es
  `hdmi` y la vista compacta de una pantalla fue validada visualmente.

Validacion pendiente:

- Abrir/cerrar desde el reloj, Escape, click exterior y arrastre del slider
  requieren confirmacion manual de puntero/teclado.

## Arranque canonico: 2026-09-06

El reinicio del host revelo que la barra nueva solo se habia iniciado de forma
manual. AGS seguia habilitado en `default.target` y ademas era reiniciado por
Hyprland. El codigo Polar no se habia perdido.

- Entrada unica: `90-autostart.conf` ejecuta `start-desktop-shell.sh`.
- El wrapper importa entorno antes de iniciar `quickshell.service`; no depende
  de que este host active `graphical-session.target`.
- La unidad comprueba el IPC `polar` con `ExecStartPost`, limita reintentos,
  excluye AGS/prototipo/Waybar y usa AGS ante fallo.
- El deploy incluye Quickshell y retira la habilitacion de AGS/Waybar.
- `bootstrap/test-desktop-shell.sh` prueba con mocks la importacion ordenada,
  recuperacion, falta de entorno y timeout de IPC.
- La preferencia de pantallas permanece en el mismo Shell ID y directorio de
  estado, al conservar la ruta `~/.config/quickshell`.
- Pendiente funcional previo: Command Palette y popup Spotify siguen en AGS;
  no iniciar una segunda barra para intentar abrir esos overlays.

Validacion de esta correccion: inicio real desde AGS a Polar con IPC disponible,
sin errores QML y `NRestarts=0`. Repetir el wrapper conservo el mismo PID; con
dos monitores activos, Hyprland mostro exactamente una capa `quickshell` de
64px por monitor y ninguna capa AGS. Sintaxis shell, unidades systemd, pruebas
con mocks, preflight obligatorio, agentes y `git diff --check` pasaron. No se
reinicio el sistema completo; queda esa comprobacion para el proximo login.

## Rollback

Si el prototipo falla durante una prueba autorizada:

```bash
systemctl --user stop quickshell.service quickshell-prototype.service
systemctl --user start ags.service
```
