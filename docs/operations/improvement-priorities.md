# Prioridades de mejora

Estado revisado: 2026-08-19.

Esta cola usa el modelo `P0`-`P3` de
`AGENTS.md`. La prioridad se
basa en impacto y evidencia del repositorio, no en tamaño o atractivo visual.

## P0: credencial retirada presente en historial

Estado: bloqueante, detectado el 2026-08-19.

La integración externa fue retirada del runtime y del árbol de trabajo, pero
varios estados del historial contienen una credencial en texto plano. Eliminar
los archivos actuales no revoca la credencial ni la retira del remoto.

Contención aplicada:

- Los archivos `*.env` reales quedan ignorados; `*.env.example` sigue permitido.
- El valor no se reproduce en documentación ni diagnósticos.
- Los servicios, el paquete, la configuración privada, los backups y las notas
  dedicadas fueron eliminados permanentemente con autorización explícita.

Criterio de salida:

- Revocar o rotar la credencial en el servicio de origen.
- Confirmar que las copias privadas locales usan el valor nuevo y permisos
  restrictivos.
- Decidir si se reescribe el historial remoto o se conserva como incidente
  conocido; una reescritura requiere autorización y coordinación explícitas.
- Verificar el historial de forma redactada después de la acción elegida.

Hasta entonces, los trabajos `P1` siguientes quedan pausados por la regla de
prioridad del repositorio.

## P1: riesgos operativos

### 1. Hacer transaccional y acotado el despliegue

Evidencia:

- `bootstrap/deploy.sh` construye acciones con `eval`.
- Mueve destinos y crea enlaces uno por uno sin rollback automático si falla una
  etapa intermedia.
- Enlaza el directorio completo `~/.config/systemd` al repositorio.
- Oculta el fallo de activación de AGS con `|| true`.

Criterio de salida:

- Sin `eval`; comandos construidos como argumentos.
- Plan y rollback explícitos para cada destino.
- Unidades systemd gestionadas de forma acotada, sin apropiarse del árbol
  completo.
- Fallo de AGS visible y resultado final no ambiguo.

### 2. Restringir la restauración de comandos de ventanas

Evidencia:

- `window-session.py` persiste comandos leídos desde `/proc/<pid>/cmdline`.
- La restauración acepta el JSON mutable local y pasa el comando a
  `hyprctl dispatch exec`.
- El límite de 80 ventanas reduce impacto accidental, pero no valida una lista de
  binarios o argumentos permitidos.

Criterio de salida:

- Restauración basada en adaptadores/lista permitida por aplicación.
- Rechazo explícito de binarios y argumentos no reconocidos.
- Modo de inspección o `--dry-run` antes de relanzar.
- Pruebas para snapshots manipulados, inválidos y versiones incompatibles.

## P2: estabilidad y mantenibilidad

### 3. Integrar validación de agentes en el cierre estable

- Mantener `bash bootstrap/validate-agent-config.sh` como gate estático.
- Añadirlo a CI o al mecanismo de pre-commit elegido por el proyecto.
- Mantener una sola fuente para prioridades, riesgo y autorización.

### 4. Crear una frontera de sesión explícita

- Evaluar `dotfiles-session.target` para agrupar sólo servicios esenciales.
- Migrar applets, wallpaper y daemon de ventanas a unidades acotadas si mejora la
  observabilidad y recuperación.
- Añadir un resumen no destructivo de salud de sesión.

### 5. Resolver política de bloqueo e inactividad

- Definir `hypridle` + `hyprlock`, o documentar expresamente la decisión de no
  ofrecer bloqueo automático.
- Validar que la decisión sea coherente con el riesgo físico del equipo.

## P3: mejoras opcionales

- Completar la fase tipográfica de la identidad Arctic Glass.
- Retirar Waybar residual cuando se confirme que no existe dependencia de
  recuperación.
- Reducir detalles visuales sólo después de cerrar los `P1` operativos.

## Orden recomendado

1. Revocar/rotar la credencial retirada y decidir tratamiento del historial.
2. Despliegue seguro y acotado.
3. Restauración de sesión con allowlist y dry-run.
4. CI/gates de agentes y healthcheck de sesión.
5. Política de idle/lock.
6. Pulido opcional.
