# RELEASE Runbook

## Objetivo
Cerrar una versión estable, trazable y fácil de revertir.

## Proceso
1. Repo limpio (`git status`).
2. Ejecutar gates:
   - `bootstrap/check-deps.sh --strict`
   - `bootstrap/ags-smoke.sh`
   - `bootstrap/qa.sh`
3. Verificar logs y visual final.
4. Commit con mensaje claro.
5. Push.
6. Tag opcional de estado estable.

## Checklist
- [ ] Working tree limpio
- [ ] Gates en verde
- [ ] Validación visual final
- [ ] Commit claro
- [ ] Push exitoso
- [ ] Tag (si aplica)

## Salida
- Commit:
- Tag:
- Estado:
