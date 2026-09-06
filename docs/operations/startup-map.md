# Startup map: Hyprland + Polar desktop

Estado observado: 2026-09-06.

Este mapa separa qué levanta la sesión, qué es esencial, qué es opcional y qué
queda pendiente de ordenar. La barra oficial es Quickshell Polar Command Deck.
AGS queda como recuperacion y Waybar permanece fuera del arranque.

## Leyenda

- `essential`: necesario para la sesión diaria estable.
- `optional`: mejora UX, pero la sesión puede funcionar sin esto.
- `external`: depende de archivos o servicios fuera del repo.
- `needs-review`: funciona o existe, pero conviene sanearlo.

## Cadena de arranque

1. GDM inicia `start-hyprland`.
2. Hyprland carga `config/hypr/hyprland.conf`.
3. Hyprland ejecuta `config/hypr/conf.d/90-autostart.conf`.
4. `bash ~/.config/hypr/scripts/start-desktop-shell.sh` importa las variables
   Wayland/Hyprland en D-Bus y systemd de forma secuencial.
5. El script inicia `quickshell.service`, que comprueba el IPC de Polar antes
   de declarar el arranque correcto. Repetirlo conserva la misma instancia.
6. AGS se inicia solo si Polar falla o se solicita recuperacion manual.

Las unidades de barra son `static` a proposito: la sesion Hyprland es su unica
entrada automatica. Este host usa `start-hyprland` y no activa
`graphical-session.target`; habilitar otra barra en `default.target` provoca
arranques prematuros y competencia. No usar `systemctl enable` para las barras.

## Recursos de sesión

| Recurso | Estado | Propósito | Fuente |
| --- | --- | --- | --- |
| Hyprland | `essential` | Compositor y sesión Wayland | `config/hypr/hyprland.conf` |
| Environment import | `essential` | Importa entorno antes de iniciar la barra | `config/hypr/scripts/start-desktop-shell.sh` |
| AGS | `optional` | Recuperacion, sin habilitacion al login | `config/systemd/user/ags.service` |
| Quickshell | `essential` | Polar Command Deck y Control Center | `config/systemd/user/quickshell.service` |
| PipeWire + PipeWire Pulse | `essential` | Audio runtime y compatibilidad PulseAudio | systemd user sockets/services |
| WirePlumber | `essential` | Session manager de PipeWire | systemd user service |
| xdg-desktop-portal-hyprland | `essential` | Portals Wayland para capturas, permisos y apps sandboxed | systemd user service |
| xdg-desktop-portal-gtk | `optional` | Backend GTK para diálogos/portals | systemd user service |
| mako | `optional` | Notificaciones Wayland | D-Bus/systemd user |
| nm-applet | `optional` | Tray de NetworkManager | Hyprland `exec-once` |
| blueman-applet | `optional` | Tray Bluetooth | Hyprland `exec-once` |
| Wallpaper | `external` | Fondo de pantalla | `config/hypr/scripts/start-wallpaper.sh` delega en `~/.config/scripts/wallpaper.sh` |
| Workspace bootstrap | `essential` | Layout diario de workspaces y fallback de apps | `config/hypr/scripts/bootstrap-workspaces.sh` |
| Window session daemon | `needs-review` | Autosave de ventanas cada 20s | `config/hypr/scripts/window-session-daemon.sh` |
| Waybar | `needs-review` | Barra alternativa instalada/deshabilitada | No es parte del flujo oficial |
| hypridle/hyprlock | `needs-review` | Idle/lock policy | Deshabilitado/no configurado |

## Decisiones actuales

- Polar reemplaza AGS en el arranque a solicitud del usuario el 2026-09-06.
- `Conflicts` y el orden de parada/arranque impiden que los servicios de barra
  coexistan. El prototipo historico queda manual, excluido del arranque.
- El deploy enlaza Quickshell y unidades individuales, respeta instalaciones
  antiguas con el directorio systemd enlazado y no vuelve a habilitar AGS.
- `start-wallpaper.sh` es un adaptador a un script externo. Si se quiere
  reproducibilidad total, versionar una implementación propia.
- `hypridle` está deshabilitado. Los warnings de portal/screensaver pueden ser
  esperados hasta definir una política de idle/lock.

## Recuperación rápida

- Restaurar workspaces por monitor sin abrir apps:
  `~/.config/hypr/scripts/bootstrap-workspaces.sh --layout-only`
- Ver estado Polar: `systemctl --user status quickshell.service`
- Iniciar Polar: `bash ~/.config/hypr/scripts/start-desktop-shell.sh`
- Validar estructura: `bash bootstrap/quickshell-check.sh`
- Probar arranque sin tocar la sesion: `bash bootstrap/test-desktop-shell.sh`
- Revisar audio actual:
  `pactl get-default-sink && pactl list short sink-inputs`

Recuperacion AGS para la sesion actual:

```bash
systemctl --user stop quickshell.service quickshell-prototype.service
systemctl --user start ags.service
```

El siguiente login vuelve a intentar Polar. Las pruebas `ags-smoke.sh`,
`qa.sh` y `bar-diagnose.sh` arrancan AGS y desplazan Polar: reservarlas para
trabajo explicito sobre el fallback, no para verificar Quickshell.

## Mejoras futuras

- Migrar applets, wallpaper y daemon de ventanas a servicios systemd user.
- Crear `dotfiles-session.target` como healthcheck de sesión.
- Definir política `hypridle` + `hyprlock`, o documentar explícitamente que no
  se usa bloqueo/idle automático.
- Agregar `bootstrap/session-status.sh` para resumir servicios, monitores,
  audio, red, AGS y warnings críticos.
