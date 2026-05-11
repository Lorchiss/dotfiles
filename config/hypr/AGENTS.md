# Agente Hyprland

Estas reglas aplican a `config/hypr` y sus subdirectorios.

## Contratos de configuracion

- Mantener la configuracion modular en `conf.d`.
- Evitar cambios globales si el ajuste puede quedar acotado a un modulo.
- Preservar comportamiento visible durante refactors.
- Documentar cualquier cambio que afecte binds, reglas de ventanas, input,
  animaciones o decoracion.

## Validacion esperada

- Revisar sintaxis y coherencia de los archivos modificados.
- Usar `hyprctl reload` solo con confirmacion del usuario, porque recarga la
  sesion activa.
- Si el cambio afecta integracion con AGS, ejecutar la validacion AGS
  proporcional al riesgo.

## Reglas locales

- No revertir cambios Hyprland existentes que no haya hecho el agente.
- No mover bloques grandes entre archivos sin confirmacion.
- Mantener nombres y orden de modulos legibles para facilitar rollback manual.
