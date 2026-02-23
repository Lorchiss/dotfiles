# Auditoria tecnica del repositorio dotfiles

Fecha original: 2026-02-21  
Ultima actualizacion: 2026-02-23 (mantenimiento Arch + badges barra + smoke ampliado)

## Estado de cierre

- Estado: **cerrada**
- Cierre completado: 2026-02-23 12:05 -03

## Resumen ejecutivo

- Estado general: estable en arquitectura AGS + Hypr + systemd user.
- Contrato de dependencias actualizado con niveles `required`/`optional` y modo `--strict`.
- `bootstrap/deploy.sh` ahora falla temprano si falta cualquier dependencia `required`.
- Nuevo módulo de mantenimiento Arch integrado en pestaña `Sistema`:
  - updates `Oficial/AUR/Total`
  - apertura de Arch News oficial con marcado de leído
  - detección Snapper `root` + acción de rollback interactiva
  - estado de batería/energía con fallback sin batería
- Observabilidad rápida agregada en barra:
  - chips `AUR` y `NEWS` en `SystemTray`
- Smoke test operativo ampliado:
  - fuerza apertura de tab `Sistema`
  - valida `system_update.sh --dry-run`
  - valida `snapper_rollback.sh --help`
- Scripts operativos versionados:
  - `config/ags/scripts/system_update.sh`
  - `config/ags/scripts/snapper_rollback.sh`
- Fragilidad de autostart reducida:
  - `nm-applet` con guardia de comando.
  - wallpaper delegado a wrapper versionado (`start-wallpaper.sh`).
- Dependencias runtime validadas en esta maquina:
  - `bash bootstrap/check-deps.sh`: `required WARN 0`, `optional WARN 3` (`snapper`, `btrfs`, `paru`).
- Runtime AGS tras reinicio:
  - servicio activo
  - sin `JS ERROR` nuevos desde `2026-02-23 12:04:13` en `journalctl --user -u ags.service`
- Validacion visual/funcional en Wayland real:
  - barra visible y equilibrada
  - Control Center abre y renderiza secciones
  - popup Spotify abre y renderiza controles
- Validacion de calidad actual:
  - `cd config/ags && npm run typecheck`: OK
  - `cd config/ags && npm run lint`: OK

## Hallazgos confirmados

### Cerrado en esta iteracion

1. **P0 - Contrato de dependencias incompleto**
   - Resuelto en `bootstrap/check-deps.sh`:
     - grupos `required` y `optional`
     - flag `--strict`
     - resumen por grupo y total
     - exit code `1` si falta un `required` en modo estricto
2. **P0 - Deploy sin guardrail**
   - Resuelto en `bootstrap/deploy.sh`:
     - preflight estricto antes de tocar symlinks
     - aborto temprano si faltan `required`
     - reporte completo post-link (`required + optional`)
3. **P1 - Fragilidad por comandos externos ausentes**
   - Resuelto en `config/hypr/conf.d/90-autostart.conf`:
     - `nm-applet` protegido con `command -v`
     - wallpaper enroutado a `~/.config/hypr/scripts/start-wallpaper.sh`
   - Resuelto en `config/hypr/scripts/start-wallpaper.sh`:
     - usa `~/.config/scripts/wallpaper.sh` si existe y es ejecutable
     - si no existe, registra mensaje breve y sale `0`
4. **P1 - Documentacion desalineada**
   - Resuelto en `README.md`:
     - eliminado bloque de "proximas mejoras" obsoleto
     - secciones alineadas con estado real de auditoria y contrato de dependencias
5. **P1 - Error runtime en Control Center Wi-Fi**
   - Error detectado en logs:
     - `TypeError: passwordEntry.has_focus is not a function`
   - Resuelto en `config/ags/widget/controlcenter/WifiSection.tsx`:
     - lectura de foco robusta (propiedad o metodo) compatible con bindings GTK/GJS
6. **P1 - Mantenimiento Arch incompleto en UI**
   - Resuelto en `config/ags/widget/controlcenter/SystemSection.tsx`:
     - updates desglosados (`Oficial`, `AUR`, `Total`)
     - acciones nuevas (`Noticias`, `Rollback`)
     - estado de Snapper y batería integrado
   - Backend nuevo:
     - `config/ags/lib/maintenance.ts`
     - `config/ags/lib/battery.ts`
   - Integración agregada en `config/ags/lib/system.ts`
7. **P2 - Falta de scripts operativos reutilizables**
   - Resuelto con scripts nuevos:
     - `config/ags/scripts/system_update.sh`
     - `config/ags/scripts/snapper_rollback.sh`
   - Compatibilidad con fallback:
     - sin `paru` -> update oficial únicamente
     - sin `snapper` -> flujo sin snapshots
8. **P2 - Baja visibilidad de mantenimiento en barra y smoke limitado**
   - Resuelto en `config/ags/widget/bar/SystemTray.tsx`:
     - indicadores `AUR` y `NEWS`
   - Ajuste visual en `config/ags/style.scss` para chips nuevos
   - Resuelto en `bootstrap/ags-smoke.sh`:
     - smoke extendido para validar tab `Sistema` + scripts de mantenimiento

### Abierto / en seguimiento

Sin hallazgos bloqueantes abiertos en esta auditoria.

## Cambios aplicados en esta actualizacion

1. `bootstrap/check-deps.sh`
2. `bootstrap/deploy.sh`
3. `config/hypr/conf.d/90-autostart.conf`
4. `config/hypr/scripts/start-wallpaper.sh` (nuevo)
5. `README.md`
6. `AUDITORIA.md`
7. `config/ags/widget/controlcenter/WifiSection.tsx`
8. `config/ags/lib/maintenance.ts` (nuevo)
9. `config/ags/lib/battery.ts` (nuevo)
10. `config/ags/lib/system.ts`
11. `config/ags/widget/controlcenter/SystemSection.tsx`
12. `config/ags/widget/bar/SystemTray.tsx`
13. `config/ags/scripts/system_update.sh` (nuevo)
14. `config/ags/scripts/snapper_rollback.sh` (nuevo)
15. `config/ags/style.scss`
16. `bootstrap/ags-smoke.sh`

## Checklist final para cierre

- [x] `bash bootstrap/check-deps.sh --strict`
- [x] `bash bootstrap/check-deps.sh`
- [x] `bash config/ags/scripts/system_update.sh --dry-run`
- [x] `bash config/ags/scripts/snapper_rollback.sh --help`
- [x] `cd config/ags && npm run typecheck`
- [x] `cd config/ags && npm run lint`
- [x] `bash bootstrap/ags-smoke.sh`
- [x] `systemctl --user status ags.service`
- [x] `journalctl --user -u ags.service -n 120 --no-pager`
- [x] Validacion manual en Wayland real:
  - barra equilibrada visualmente
  - control center funcional (Wi-Fi/Bluetooth/Audio/Sistema)
  - popup Spotify sin errores

## Evidencia de validacion visual

- Capturas locales:
  - `/tmp/ags-audit-20260223/bar.png`
  - `/tmp/ags-audit-20260223/control-center.png`
  - `/tmp/ags-audit-20260223/spotify-popup.png`
- Logs revisados:
  - `journalctl --user -u ags.service --since "2026-02-23 12:04:13" --no-pager`
  - sin `JS ERROR`, `TypeError` ni `ERROR` tras el reinicio y la interacción.

## Criterio de cierre binario

- **Cerrada**: todos los items del checklist completados y sin errores bloqueantes.
- **Abierta**: cualquier item pendiente o con fallo bloqueante.
