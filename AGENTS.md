# Agente operativo para dotfiles

Este repositorio mantiene un entorno Linux basado en Hyprland + AGS. Los agentes
deben usar los runbooks como contrato operativo, aplicar cambios pequenos y
validar antes de declarar un resultado estable.

## Ubicacion de instrucciones

- `AGENTS.md` en la raiz define reglas globales para todo el repo.
- `config/ags/AGENTS.md` define reglas especificas para AGS.
- `config/hypr/AGENTS.md` define reglas especificas para Hyprland.
- `bootstrap/AGENTS.md` define reglas especificas para scripts operativos.
- No guardar instrucciones dentro de `.git/`; esa carpeta es metadata interna
  de Git y no forma parte normal del contenido versionado del proyecto.

## Mision

- Mantener el escritorio estable, trazable y facil de revertir.
- Resolver bugs con causa raiz confirmada, no con parches a ciegas.
- Mejorar UX visual sin romper runtime.
- Refactorizar solo cuando reduzca deuda real y preserve comportamiento visible.
- Preparar releases solo cuando los gates esten en verde.

## Contexto del repo

- `config/hypr`: configuracion modular de Hyprland.
- `config/ags`: barra, popups y Control Center en TypeScript/SCSS para AGS.
- `bootstrap`: scripts de deploy, preflight, smoke test y QA.
- `runbooks`: procedimientos base para bugfix, UI polish, refactor y release.
- `docs`: arquitectura, workflow diario y notas operativas.

## Router de runbooks

Clasificar cada solicitud antes de actuar:

- Bug, error, log roto, crash o comportamiento incorrecto:
  usar `runbooks/BUGFIX.md`.
- Mejora visual, claridad, espaciado, jerarquia o interaccion:
  usar `runbooks/UI-POLISH.md`.
- Limpieza interna, simplificacion, modularizacion o deuda tecnica:
  usar `runbooks/REFACTOR.md`.
- Cierre estable, commit, push o tag:
  usar `runbooks/RELEASE.md`.

Si una solicitud mezcla categorias, usar este orden de prioridad:

1. Bugfix.
2. Refactor minimo necesario.
3. UI polish.
4. Release.

## Autonomia

El agente puede hacer sin pedir confirmacion:

- Leer archivos del repo.
- Inspeccionar `git status`, `git diff` y logs locales.
- Editar archivos versionados cuando la solicitud implique cambios.
- Ejecutar validaciones no destructivas:
  - `bash bootstrap/check-deps.sh --strict`
  - `cd config/ags && npm run typecheck`
  - `cd config/ags && npm run lint`
  - `bash bootstrap/ags-smoke.sh`
  - `bash bootstrap/qa.sh`
  - `bash bootstrap/bar-diagnose.sh`
- Reiniciar `ags.service` cuando sea parte de smoke/QA.

El agente debe pedir confirmacion explicita antes de:

- Hacer `commit`, `push` o crear tags.
- Ejecutar `bootstrap/deploy.sh`.
- Borrar archivos o mover configuraciones grandes.
- Instalar paquetes del sistema.
- Ejecutar actualizaciones reales del sistema.
- Ejecutar rollback con Snapper/Btrfs.
- Tocar secretos o archivos privados bajo `config/ags/private`.
- Usar comandos destructivos de Git como `reset --hard`, `clean`, force push o
  restauraciones masivas.

## Reglas de trabajo

- Revisar `git status --short` antes de editar.
- No revertir cambios existentes que no haya hecho el agente.
- Mantener cambios acotados al objetivo pedido.
- Preferir patrones existentes del repo sobre abstracciones nuevas.
- No cambiar comportamiento visible durante un refactor.
- No declarar un gate como PASS si no fue ejecutado.
- Si un gate no puede correr por entorno, reportarlo como no ejecutado y explicar
  el bloqueo.

## Flujo base

1. Entender solicitud, alcance y riesgo.
2. Revisar estado del repo.
3. Elegir runbook.
4. Leer archivos relevantes.
5. Reproducir o confirmar el problema cuando aplique.
6. Aplicar el cambio minimo suficiente.
7. Ejecutar validacion proporcional al riesgo.
8. Entregar resumen con archivos tocados, resultado y riesgos restantes.

## Matriz de validacion

- Cambios solo docs: revisar formato y contenido; no hace falta QA runtime.
- Cambios TypeScript AGS:
  - `cd config/ags && npm run typecheck`
  - `cd config/ags && npm run lint`
  - `bash bootstrap/ags-smoke.sh`
- Cambios SCSS/visual:
  - `cd config/ags && npm run lint`
  - `bash bootstrap/qa.sh`
- Cambios scripts `bootstrap` o `config/ags/scripts`:
  - `bash -n <script>`
  - prueba del modo `--help` o `--dry-run` si existe.
  - `bash bootstrap/qa.sh` si afecta runtime.
- Cambios Hyprland:
  - revisar sintaxis/configuracion modificada.
  - validar con `hyprctl reload` solo si el usuario acepta recargar la sesion.
- Release:
  - correr todos los gates bloqueantes.

## Criterios de parada

Detenerse y pedir direccion si:

- La solicitud requiere una accion destructiva o irreversible.
- El alcance permitido no esta claro y el cambio podria tocar muchos modulos.
- Un secreto, token o archivo privado es necesario.
- Falta una dependencia requerida y el agente no puede instalar paquetes.
- Los gates fallan por una razon no relacionada con el cambio.

## Estilo de respuesta

- Responder en espanol cuando el usuario escriba en espanol.
- Ser concreto: causa, cambio, validacion, pendiente.
- Incluir comandos ejecutados y resultado relevante.
- No ocultar incertidumbre ni inventar validaciones.
- Preferir resumen corto al final; los detalles largos van en docs o diffs.
