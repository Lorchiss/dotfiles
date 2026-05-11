# Problema de Compatibilidad: AGS con GLib/GJS

## Fecha de Registro
18 de abril de 2026

## Descripción del Problema
AGS (Aylur's GTK Shell) presenta incompatibilidad con versiones recientes de GLib 2.88.0 y GJS 1.88.0 después de actualizaciones del sistema Arch Linux. Esto causa que los popups (Control Center, Command Palette, Spotify) dejen de funcionar.

## Síntomas
- Popups no aparecen al usar atajos de teclado (Super+C, Super+P, Super+M)
- Comandos `ags toggle <popup>` se cuelgan o fallan
- Errores en logs de systemd:
  - `TypeError: parameters.deepUnpack is not a function`
  - `TypeError: invocation.return_dbus_error is not a function`

## Causa Técnica
- Cambios en la API de DBus en GLib 2.88/GJS 1.88
- AGS 3.1.0 utiliza la librería `gnim` para DBus, que no maneja correctamente los nuevos métodos de la API
- La comunicación entre procesos de AGS falla, impidiendo la activación de popups

## Solución Temporal
- Actualizar AGS a versión git (3.1.2.r0.gbbee2f1-2 o superior)
- Reiniciar el servicio systemd de AGS
- Comando: `yay -S aylurs-gtk-shell-git && systemctl --user restart ags`

## Solución Transversal Considerada
Para evitar problemas recurrentes de compatibilidad con GJS/GLib:

### Opciones Evaluadas
1. **Mantener AGS con mejoras**:
   - Implementar un wrapper DBus personalizado
   - Usar versiones pinned de GLib/GJS
   - Contribuir patches upstream a AGS/gnim

2. **Migrar a EWW (ElKowar's Wacky Widgets)**:
   - Ventajas: Más estable, no depende de GJS, mejor rendimiento
   - Desventajas: Curva de aprendizaje, reescribir toda la configuración
   - Lenguaje: Rust + Lua

3. **Usar Hyprland's built-in popups**:
   - Ventajas: Integración nativa, sin dependencias externas
   - Desventajas: Menos personalizable, limitado a funcionalidades básicas

4. **Framework Qt-based (como Latte Dock o similar)**:
   - Ventajas: Mejor estabilidad cross-platform
   - Desventajas: Más pesado, diferente paradigma de desarrollo

5. **Solución híbrida**:
   - Mantener AGS para widgets complejos
   - Usar alternativas para popups críticos
   - Implementar fallback automático

### Recomendación
Evaluar migración gradual a EWW para mayor estabilidad a largo plazo. EWW ofrece:
- Mejor manejo de actualizaciones del sistema
- Comunidad activa y mantenimiento continuo
- Arquitectura más robusta sin dependencias frágiles

## Próximos Pasos
1. Probar EWW como alternativa en un branch separado
2. Documentar proceso de migración
3. Evaluar impacto en UX y funcionalidades
4. Implementar si los beneficios superan los costos

## Referencias
- Issue relacionado: https://github.com/Aylur/ags/issues/796
- GLib 2.88 release notes
- AGS changelog