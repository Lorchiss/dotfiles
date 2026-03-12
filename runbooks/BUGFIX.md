# BUGFIX Runbook

## Objetivo
Corregir un bug con el menor cambio posible, sin regresiones.

## Entrada
- Síntoma:
- Contexto:
- Alcance (archivos permitidos):

## Proceso
1. Reproducir bug.
2. Aislar causa raíz (no parchear a ciegas).
3. Aplicar fix mínimo.
4. Validar:
   - smoke
   - qa
   - logs relevantes
5. Documentar causa + fix.

## Checklist
- [ ] Bug reproducido
- [ ] Root cause confirmado
- [ ] Fix mínimo aplicado
- [ ] `bootstrap/ags-smoke.sh` PASS
- [ ] `bootstrap/qa.sh` PASS
- [ ] Sin nuevos warnings críticos

## Salida
- Root cause:
- Archivos tocados:
- Resultado final:
