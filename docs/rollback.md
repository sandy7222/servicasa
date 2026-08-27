# Rollback — Vercel y migraciones de Supabase

Fase 9 del roadmap. Dos mecanismos separados, porque son dos sistemas separados: el código (Vercel) tiene rollback instantáneo; el esquema (Supabase) no — cada cambio de schema necesita una migración inversa escrita a mano.

## Vercel (código)

**Un deploy fallido nunca se promociona.** Ya es el comportamiento por defecto: Vercel solo marca un deployment como `READY` si el build (`npm run build`) termina bien. El alias de producción (`tecniurbano.online`) solo se mueve a deployments `READY` — un build roto se queda en `ERROR` y el dominio sigue sirviendo la versión anterior sin que nadie tenga que hacer nada. Confirmado el 26/8: cada push a `main` genera un deployment `target: production`, y el dominio sigue automáticamente al más reciente que esté `Ready`.

**Rollback manual** (cuando un deploy sí quedó `Ready` pero rompió algo en producción):

```bash
# 1. Ver el historial de deployments de producción
npx vercel ls tecniurbano --prod

# 2. Volver a apuntar el dominio a uno anterior (instantáneo, no reconstruye nada)
npx vercel rollback <deployment-id-o-url>
```

`vercel rollback` re-apunta el alias al instante — no hay rebuild, así que es rápido incluso bajo presión.

**Ojo con esto:** cada deployment de Vercel queda con las variables de entorno que estaban configuradas en el momento en que se construyó, no las de ahora. Si hiciste rollback a un deploy viejo después de cambiar una variable de entorno (agregar una nueva, rotar una credencial), ese deploy viejo puede no tener la variable nueva, o puede tener una credencial que ya rotaste. Antes de un rollback bajo presión, confirmá que las env vars relevantes no cambiaron entre el deploy bueno y el actual.

## Migraciones de Supabase (esquema)

**No hay rollback automático.** Los archivos en `supabase/migrations/` son solo el `up` — no existen archivos `.down.sql` ni un mecanismo de reversión automática. Revertir un cambio de esquema significa escribir y aplicar una migración nueva que deshaga el cambio anterior, con el mismo criterio que usamos toda esta sesión: mostrar el DDL, probarlo con un script rollback-safe (`begin; ... rollback;`) contra la base real antes de aplicarlo de verdad.

Ejemplo concreto de esta sesión — si hiciera falta revertir `20260825130000_scope_technicians_select_policy.sql`:

```sql
drop policy if exists "technicians_select_scoped" on "public"."technicians";
-- recrear la política vieja acá, si de verdad hiciera falta
```

**Importante:** no todas las migraciones son candidatas razonables a "rollback". Las que corrigen un bug real de seguridad (como la de arriba, o `20260825140000_technician_public_view_security_invoker.sql`) no deberían revertirse nunca salvo que rompan algo funcional — revertirlas reintroduce el hallazgo que se cerró. El rollback de esquema es para cuando una migración tiene un error de sintaxis/lógica, no para deshacer una corrección de seguridad porque "algo dejó de andar" — en ese caso el arreglo es otra migración que ajuste el comportamiento sin volver a la versión insegura.

**El gap real:** el código (Vercel) y el esquema (Supabase) no están versionados juntos — no hay una única operación que revierta "el commit X con la migración Y" de forma atómica. Si un deploy rompe algo porque asume una columna que una migración todavía no aplicó (o viceversa), el rollback de Vercel por sí solo no alcanza; hay que revisar a mano si la migración que acompañaba ese deploy también necesita revertirse. Mitigación práctica: seguir aplicando migraciones ANTES de mergear el código que las necesita (como se hizo toda la sesión), nunca al revés.
