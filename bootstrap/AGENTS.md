# Agente Bootstrap

Estas reglas aplican a `bootstrap` y sus scripts operativos.

## Contratos de scripts

- Los scripts deben ser seguros de ejecutar mas de una vez cuando sea razonable.
- Preferir modos `--help`, `--dry-run` o checks no destructivos para validar.
- No ejecutar `bootstrap/deploy.sh` sin confirmacion explicita.
- No instalar paquetes, actualizar el sistema ni hacer rollback sin confirmacion.

## Validacion esperada

- Para scripts shell modificados:
  - `bash -n <script>`
  - prueba `--help` o `--dry-run` si existe.
- Si el script afecta runtime AGS/Hyprland:
  - `bash bootstrap/qa.sh` desde la raiz del repo cuando el entorno este
    disponible.

## Reglas locales

- Reportar claramente si una validacion no se pudo ejecutar por entorno.
- No ocultar errores de comandos con redirecciones silenciosas salvo que el
  script ya tenga una razon documentada.
