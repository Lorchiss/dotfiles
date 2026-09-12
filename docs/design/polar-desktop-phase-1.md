# Polar Desktop: base visual compartida

Estado al 2026-09-08: integrada y validada visualmente en la sesion, despues de
autorizacion R2. Quickshell, Focus Transfer, monitores y audio no se modifican.
La prueba de un nuevo login completo sigue pendiente.

## Alcance

Primera entrega del plan visual: fondo, lanzador y marco de trabajo (terminal y
decoracion), mas tipografia/preferencia GTK. Command Palette nativa, mapa de
pantallas, OSD y variante clara completa de Polar siguen siendo fases posteriores.

La paleta parte de `config/quickshell/Theme.qml`: carbon `#080d14`, superficies
`#0d151f` / `#16222f`, borde `#29435a`, texto `#edf7ff`, secundario `#91a5b7`
y foco `#79c7ff`.

## Propiedad de estilos

| Superficie | Entrada | Propietario |
| --- | --- | --- |
| Fondo | `start-wallpaper.sh` desde el exec-once existente | SVG local y `polar-wallpaper.service` |
| Rofi | `config.rasi` carga `polar.rasi` | Layout compacto; colores de `theme-auto.rasi` |
| Kitty | `kitty.conf` | Geometria en `themes/polar.conf`; colores en `theme-auto.conf` |
| Hyprland | `conf.d/30-decoration.conf` | `themes/polar.conf`, sin duplicar bordes en 20-general |
| GTK 3/4 | `theme-sync.sh` | Solo fuente y preferencia oscura; conserva otras claves |

Rofi usa IBM Plex Sans, ancho de 560px, hasta seis resultados y altura segun
contenido. En superficies de hasta 640px reduce el ancho al 90%. Kitty conserva
las acciones de copiar/pegar, usa 96% de opacidad, padding 12 y cursor estatico.
Hyprland usa un solo borde frost, radio 12, sombra contenida y sin glow ni
atenuacion del texto al desenfocar.

IBM Plex Sans esta instalada; IBM Plex Mono no. Kitty usa explicitamente
`JetBrainsMono Nerd Font Mono`, disponible en el host. No se instalaron fuentes.
Los tamanos y la fuente mono de la barra no se tocaron: su normalizacion requiere
una fase QML con pruebas de anchura. La barra sigue reservando 64px.

## Selector de temas

`theme-sync.sh` sigue siendo la unica entrada para la preferencia dark/light.
Copia las paletas de `config/kitty/themes/polar-{dark,light}.conf` y
`config/rofi/themes/polar-{dark,light}.rasi` a los archivos dinamicos ya usados
por las aplicaciones. No reemplaza la geometria ni reescribe archivos sin cambios.

```bash
bash ~/.config/hypr/scripts/theme-sync.sh status
bash ~/.config/hypr/scripts/theme-sync.sh --dry-run light
bash ~/.config/hypr/scripts/theme-sync.sh apply
```

`--files-only` omite GTK/GSettings; no es un dry-run, escribe paletas y estado.
Las pruebas usan directorios XDG temporales para no cambiar la preferencia real.

GTK recibe IBM Plex Sans 11 y `gtk-application-prefer-dark-theme` coherente con
la preferencia GSettings. Se conservan tema, iconos, cursor, comentarios y otros
grupos de settings.ini. Un tema GTK fijado como Orchis-Dark no se transforma por
si solo en su variante clara: aqui se sincroniza la preferencia, no su CSS.

No se fija `QT_QPA_PLATFORMTHEME`, no se instala Qt5ct/Qt6ct/Kvantum y no se
promete uniformidad de aplicaciones que dibujan su propio tema. Quickshell,
decoracion y fondo permanecen oscuros; la paridad clara completa es posterior.

## Fondo persistente

El antiguo adaptador externo invocaba swww, ausente en este host. Ahora el
repositorio contiene el SVG y su lanzador; no ejecuta ni modifica el script
externo anterior. Usa awww, o swww si solo esta disponible ese par cliente/daemon.

- Rasteriza el SVG una vez a `$XDG_CACHE_HOME/polar/polar-contour.png`
  (por defecto `~/.cache/polar`); regenera al cambiar la fuente.
- Un lock serializa las invocaciones. No inicia una segunda instancia si el
  cliente ya puede comunicarse con el daemon.
- Si hace falta arrancar, importa WAYLAND_DISPLAY e inicia
  `polar-wallpaper.service`, una unidad static sin WantedBy.
- systemd conserva el daemon fuera del ciclo de vida del comando de lanzamiento.
  Sus reinicios automaticos estan limitados; el backend restaura la imagen cacheada.
- Repetir el comando no vuelve a enviar la imagen si todas las salidas ya la
  muestran. El cambio usa una transicion breve; movimiento reducido elimina esa
  transicion. No hay animaciones de reposo ni polling permanente.
- Al fallar el inicio/aplicacion se detiene solo la unidad iniciada por esa
  invocacion. No se detienen la barra ni un daemon que ya estaba funcionando.
- El SVG se adapta por pantalla. No se implementa un panorama dividido por
  posicion fisica.

```bash
bash ~/.config/hypr/scripts/start-wallpaper.sh --dry-run
bash ~/.config/hypr/scripts/start-wallpaper.sh --render-only
bash ~/.config/hypr/scripts/start-wallpaper.sh
systemctl --user status polar-wallpaper.service
journalctl --user -u polar-wallpaper.service -n 30 --no-pager
```

La entrada exec-once del fondo no cambio. El despliegue enlaza la nueva unidad;
no se habilita otra barra ni se cambia el arranque exclusivo de Polar.

## Validacion

```bash
bash bootstrap/polar-visual-check.sh
bash bootstrap/test-polar-theme.sh
bash bootstrap/quickshell-check.sh
bash bootstrap/validate-agent-config.sh
bash bootstrap/check-deps.sh --strict
git diff --check
```

El checker usa analizadores reales de Hyprland, Rofi y Kitty y rasteriza el SVG.
Prueba ambas paletas Rofi/Kitty sin tocar la sesion. Los tests aislados cubren
dry-run, idempotencia, toggle, conservacion de GTK/symlinks, cache, reuso de
daemon, movimiento reducido y limpieza ante fallo.

QA de sesion del 2026-09-08:

- Fondo confirmado en ambas salidas a 1920x1080; geometria, frecuencia y escala
  de monitores iguales antes/despues.
- Rofi inspeccionado en ambas pantallas: 560x375 con seis resultados y 560x135
  al filtrar Kitty. Sin recortes ni superficie vacia excesiva.
- Kitty inspeccionado en una ventana propia de 920x560: fuente, simbolos,
  seleccion de colores ANSI, contraste y borde correctos.
- Ventanas y workspace de prueba cerrados; foco y workspace anteriores restaurados.
- Quickshell con el mismo PID y NRestarts=0; no se reinicio ni se modifico su QML.
- El servicio del fondo sobrevivio al cierre del lanzador, reutilizo su proceso
  y recupero la imagen tras un reinicio manual autorizado.
- awww emitio avisos de buffers Wayland al aplicar la imagen, sin fallo visual
  observado ni reinicios automaticos. No se observaron nuevos avisos en reposo.
  Son avisos del backend, no errores QML; no se ocultaron.
- Pendiente: nuevo login completo, QA de una sola salida (no se desactivaron
  monitores), teclado completo de Rofi, tema claro en ventanas reales y Qt.

## Respaldo y recuperacion

Antes de activar se guardo un respaldo local en
`~/.local/state/dotfiles/backups/polar-20260908-103652/`: archivo de configs
Hyprland/Kitty/Rofi, settings GTK, preferencias GSettings y estado de monitores.
No contiene archivos privados de AGS. Los artefactos de QA no se versionan.

Un rollback visual requiere autorizacion R2: detener `polar-wallpaper.service`,
restaurar solo los archivos afectados desde ese respaldo, restaurar fuente y
color-scheme de GSettings y verificar Hyprland/Rofi/Kitty. No extraer el respaldo
completo encima de cambios posteriores ni usar git reset. No detener Quickshell.
El fondo anterior no tenia daemon activo; no se debe reactivar automaticamente
el script externo que depende de swww ausente.

Sin commit ni push de esta fase.

## Referencias

- [Direccion visual](visual-direction.md)
- [Mapa de arranque](../operations/startup-map.md)
- [Rofi: temas](https://davatorium.github.io/rofi/current/rofi-theme.5/)
- [Kitty: configuracion](https://sw.kovidgoyal.net/kitty/conf/)

Sintaxis verificada con Hyprland 0.56.2, Rofi 2.0.0 y Kitty 0.48.2 locales.
No se migra hyprlang a Lua.
