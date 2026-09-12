# Registro de cambios

Este archivo registra avances terminados del repositorio de dotfiles. Git conserva el detalle técnico; aquí queda el propósito, la validación y el estado operativo.

## 2026-09-12 — Consolidación visual de Polar

- **Alcance:** integración del tema Polar en Hyprland, Kitty y Rofi; sincronización de tema; wallpaper con caché y servicio systemd de usuario; scripts de comprobación; documentación del arranque.
- **Motivo:** dejar Polar como shell principal con una apariencia coherente y un camino de recuperación verificable.
- **Validado:** `git diff --check`, `bootstrap/test-polar-theme.sh`, `bootstrap/check-deps.sh` y ayuda de `bootstrap/polar-visual-check.sh`.
- **Resultado:** pruebas Polar pasan; las dependencias obligatorias están disponibles. `snapper`, `btrfs` y `paru` permanecen como advertencias opcionales.
- **Estado:** aplicado localmente; pendiente de revisión visual en la sesión y de despliegue si corresponde.
- **Commits:** se añadirán al cerrar este lote.

## Regla de registro

Cada avance terminado debe seguir este flujo: cambiar, validar, crear un commit local con un mensaje específico y actualizar esta bitácora. El `push` a un remoto es un respaldo separado y no define si el avance quedó registrado.
