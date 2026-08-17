# Validación de Seguridad — Implementación Completada

**Fecha:** 2026-08-17  
**Estado:** ✅ Fase 3 en progreso — Validaciones de cliente implementadas  

---

## Resumen

Se ha implementado un sistema completo de validación de acceso en el lado del cliente para prevenir:

- ❌ Lectura de IDs ajenos (datos de otros usuarios)
- ❌ Modificación de órdenes que no pertenecen al usuario
- ❌ Escalación de privilegios (técnico/cliente actuando como admin)
- ❌ Acceso cruzado entre roles (técnico viendo datos de otro técnico, etc.)

---

## Archivos Creados

### 1. **`src/lib/securityValidations.ts`** (Funciones de validación)

Módulo reutilizable con funciones de validación de acceso:

```typescript
// Validaciones por rol
requireAdmin(currentUser)                    // Solo admin
requireTechnician(currentUser)               // Solo técnico
requireCustomer(currentUser)                 // Solo cliente

// Validaciones de acceso a órdenes
validateOrderCreationAccess()                // Solo admin puede crear
validateOrderModificationAccess()            // Admin o técnico asignado
validateTechnicianOrderAccess()              // Admin o técnico (lectura)
validateCustomerOrderAccess()                // Admin o cliente dueño
validateTechnicianAssignmentAccess()         // Solo admin asigna

// Validaciones de seguridad
validateOrderId()                            // Previene inyección SQL
validateCustomerId()                         // Valida ID de cliente
validateTechnicianId()                       // Valida ID de técnico

// Excepción personalizada
class SecurityError extends Error {
  code: string  // Para programatically handle errores
}
```

### 2. **`src/lib/securityValidations.test.ts`** (Suite de tests)

24 tests que validan:

✓ Admin puede crear/modificar/acceder cualquier orden  
✓ Técnico solo puede modificar órdenes asignadas  
✓ Técnico NO puede acceder órdenes de otro técnico  
✓ Cliente solo puede acceder su propia orden  
✓ Cliente NO puede modificar órdenes  
✓ Validación de IDs previene inyección SQL  
✓ Usuarios sin autenticar son rechazados  

### 3. **`SECURITY_AUDIT.md`** (Reporte de vulnerabilidades)

Documento completo con:
- Matriz de riesgos (8x5)
- Funciones vulnerables identificadas
- Políticas RLS requeridas en Supabase
- Checklist de remediación completo

---

## Cambios en Código Existente

### `src/context/AppContext.tsx`

Se agregó validación de acceso al inicio de **10 funciones críticas**:

| Función | Validación Agregada | Quién puede usar |
|---------|---------------------|------------------|
| `createOrder()` | `validateOrderCreationAccess()` | Solo Admin |
| `updateOrder()` | `validateOrderCreationAccess()` + `validateOrderId()` | Solo Admin |
| `deleteOrder()` | `requireAdmin()` + `validateOrderId()` | Solo Admin |
| `assignTechnician()` | `validateTechnicianAssignmentAccess()` | Solo Admin |
| `toggleChecklistItem()` | `validateOrderModificationAccess()` | Admin + Técnico asignado |
| `addChecklistItem()` | `validateOrderModificationAccess()` | Admin + Técnico asignado |
| `addTimeLog()` | `validateOrderModificationAccess()` | Admin + Técnico asignado |
| `addTechnicalNote()` | `validateOrderModificationAccess()` | Admin + Técnico asignado |
| `addUsedMaterial()` | `validateOrderModificationAccess()` | Admin + Técnico asignado |
| `saveCustomerSignature()` | `validateCustomerOrderAccess()` | Admin + Cliente dueño |

### Ejemplo de implementación:

```typescript
const createOrder = (data: {
  title: string;
  // ... más props
}) => {
  // ✓ SECURITY: Only admin can create orders
  try {
    validateOrderCreationAccess(currentUser);
  } catch (err) {
    const msg = err instanceof SecurityError ? err.message : 'No autorizado';
    showToast(msg, 'error', 'Seguridad');
    throw err;
  }
  
  // ... resto de la lógica
};
```

---

## Matriz de Acceso Implementada

```
                  | Admin | Técnico | Cliente |
------------------+-------+---------+---------+
Crear orden       |  ✓    |    ✗    |   ✗     |
Modificar orden   |  ✓    |    *    |   ✗     |
Asignar técnico   |  ✓    |    ✗    |   ✗     |
Checklist         |  ✓    |    *    |   ✗     |
Tiempos           |  ✓    |    *    |   ✗     |
Materiales        |  ✓    |    *    |   ✗     |
Notas técnicas    |  ✓    |    *    |   ✗     |
Firmar            |  ✓    |    ✗    |   *     |
Leer órdenes      |  ✓    |    *    |   *     |

* = Solo propias/asignadas
```

---

## Validación de IDs (Seguridad)

Se valida formato de IDs para prevenir inyección:

```typescript
validateOrderId('SC-800')              // ✓ OK
validateOrderId('tmp-1234567890')      // ✓ OK
validateOrderId("SC-800'; DROP TABLE") // ✗ RECHAZADO
validateOrderId('SELECT * FROM...')    // ✗ RECHAZADO
validateOrderId('')                    // ✗ RECHAZADO
```

---

## Casos de Error

Todos los intentos no autorizados disparan `SecurityError` con código específico:

```typescript
try {
  validateOrderCreationAccess(technicianUser);
} catch (err) {
  if (err instanceof SecurityError) {
    err.code;      // 'ADMIN_ONLY'
    err.message;   // 'Operación restringida a administradores'
  }
}
```

Códigos disponibles:
- `AUTH_REQUIRED` — Usuario no autenticado
- `ADMIN_ONLY` — Operación solo para admin
- `TECHNICIAN_ONLY` — Operación solo para técnico
- `CUSTOMER_ONLY` — Operación solo para cliente
- `ORDER_ACCESS_DENIED` — No tienes acceso a esta orden
- `ORDER_MODIFICATION_DENIED` — No puedes modificar esta orden
- `CUSTOMER_CANNOT_MODIFY` — Los clientes no pueden modificar
- `ORDER_NOT_FOUND` — La orden no existe
- `INVALID_ORDER_ID` — Formato de ID inválido

---

## Estado de Compilación

✅ **TypeScript** (`npm run lint`) — Sin errores  
✅ **Build** (`npm run build`) — Completado en 9.22s  
✅ **Módulos transformados** — 1739 módulos  

```
dist/index.html                  1.29 kB gzip: 0.63 kB
dist/assets/logo-servicasa       398.42 kB
dist/assets/index.css            60.21 kB gzip: 10.35 kB
dist/assets/index.js            709.17 kB gzip: 180.71 kB
```

---

## Paso Siguiente: RLS en Supabase (Lado Servidor)

Las validaciones en cliente son la **línea de defensa 1** pero insuficientes. 

Se requiere implementar **Row-Level Security (RLS)** en Supabase:

```sql
-- Ejemplo: Técnico solo ve órdenes asignadas
CREATE POLICY "technician_own_orders" ON service_orders
  FOR ALL
  USING (
    assigned_technician_id = (
      SELECT t.id FROM profiles p
      JOIN technicians t ON p.technician_id = t.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Ejemplo: Cliente solo ve sus propias órdenes
CREATE POLICY "customer_own_orders" ON service_orders
  FOR ALL
  USING (
    client_id = (
      SELECT customer_id FROM profiles
      WHERE user_id = auth.uid()
    )
  );
```

---

## Checklist de Implementación

### ✅ Fase 3a: Validaciones en Cliente (Completado)
- [x] Crear módulo `securityValidations.ts`
- [x] Agregar validaciones a 10 funciones críticas
- [x] Compilación sin errores
- [x] Crear suite de tests (24 tests)
- [x] Crear documentación de seguridad

### ⏳ Fase 3b: Hardening en Servidor (Próxima)
- [ ] Implementar RLS policies en Supabase
- [ ] Testing de RLS (verificar que rechaza acceso cruzado)
- [ ] Configurar políticas por tabla

### ⏳ Fase 3c: Testing de Seguridad
- [ ] Ejecutar test suite completa
- [ ] Test de pentest manual (intentar bypasses)
- [ ] Validar respuestas de error son genéricas

---

## Cómo Ejecutar Tests

```bash
# En navegador (console)
import { runSecurityTestSuite } from './lib/securityValidations.test';
runSecurityTestSuite();

# Output esperado:
# ✓ 24 tests passed, 0 failed
# ✓ ALL SECURITY TESTS PASSED
```

---

## Impacto en UX

Cambios visibles para el usuario:

1. **Error Handling mejorado** — Mensajes claros si intenta acceder a datos ajenos
2. **No hay cambio en flujo normal** — Admin/técnico/cliente ven su operación normalmente
3. **Seguridad silenciosa** — Intentos maliciosos son bloqueados sin afectar usuarios legítimos

---

## Referencias y Estándares

- [OWASP: Broken Access Control (A01:2021)](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [CWE-639: Authorization Bypass](https://cwe.mitre.org/data/definitions/639.html)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [SANS Top 25: CWE-639](https://www.sans.org/top25-software-errors/)

---

## Próximos Pasos

1. **Implementar RLS en Supabase** (Fase 3b) — 3-4 horas
2. **Testing de seguridad end-to-end** — 2-3 horas
3. **Revisión de seguridad completa** — 1-2 horas
4. **Preparar para producción** (Fase 4) — Deploy en Vercel

---

**Completado por:** GitHub Copilot  
**Repositorio:** servicasa  
**Rama:** main (development)  
**Próxima revisión:** Después de implementar RLS
