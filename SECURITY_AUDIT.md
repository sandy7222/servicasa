# Security Audit — Validación de IDs y Acceso Cruzado

**Fecha:** 2026-08-17  
**Estado:** 🔴 Crítico - Se identificaron vulnerabilidades de acceso

---

## Resumen Ejecutivo

Se encontraron **3 categorías de vulnerabilidades** donde un usuario malintencionado podría:
1. ✗ Leer datos de otros usuarios/roles sin autorización (técnicos ajenos, clientes ajenos)
2. ✗ Modificar órdenes, materiales o tareas de otros usuarios
3. ✗ Asignar órdenes arbitrariamente sin validación de permisos

---

## Vulnerabilidades Identificadas

### 1. **Mutaciones SIN validación de permisos (Lado Cliente)**

#### Archivos afectados:
- `src/lib/supabaseMutations.ts`
- `src/context/AppContext.tsx`

#### Funciones vulnerables:

```typescript
// ❌ SIN validación: puede modificar órdenes ajenas
export async function persistUpdateOrder(input: {
  orderId: string;
  // ... datos
}): Promise<ServiceOrder>

// ❌ SIN validación: puede cambiar técnico asignado
export async function persistAssignTechnician(input: {
  orderId: string;
  technicianId: string;
}): Promise<void>

// ❌ SIN validación: puede agregar materiales a órdenes ajenas
export async function persistAddUsedMaterial(input: {
  orderId: string;
  materialId: string;
}): Promise<void>

// ❌ SIN validación: puede modificar checklist de órdenes ajenas
export async function persistToggleChecklistItem(itemId: string): Promise<void>
```

#### Riesgo:
- Admin puede leer todas las órdenes (esperado)
- Técnico puede leer/modificar CUALQUIER orden (sin validar que sea suya)
- Cliente puede leer/firmar CUALQUIER orden (sin validar que sea suya)

---

### 2. **Queries de lectura SIN filtro por usuario**

#### Ejemplos en `src/lib/supabaseData.ts`:

```typescript
// ❌ Carga TODAS las órdenes sin filtrar por role/usuario
const { data: ordersData } = await supabase
  .from('service_orders')
  .select('...');

// ❌ Carga TODOS los técnicos sin permiso
const { data: techniciansData } = await supabase
  .from('technicians')
  .select('...');
```

---

### 3. **Faltan validaciones en contexto de aplicación**

En `src/context/AppContext.tsx`:

```typescript
// ❌ No valida si el usuario tiene derecho a crear orden para ese cliente
const createOrder = (data: {
  clientId: string;  // ← No se valida que el usuario sea admin
  assignedTechnicianId?: string;
}): string => {
  // Solo busca en la lista local, sin chequear permisos
  const client = customers.find((c) => c.id === data.clientId);
  // ...
}

// ❌ No valida que la orden pertenezca al usuario actual
const updateOrder = (orderId: string, patch: ...) => {
  // No hay chequeo de ownership
}
```

---

## Matriz de Riesgo

| Función | Admin | Técnico | Cliente | RLS? |
|---------|-------|---------|---------|------|
| `persistUpdateOrder()` | ✓ OK | ❌ LEAK | ❌ LEAK | ❓ Unknown |
| `persistAssignTechnician()` | ✓ OK | ❌ LEAK | ❌ LEAK | ❓ Unknown |
| `persistAddUsedMaterial()` | ✓ OK | ❌ LEAK | ❌ LEAK | ❓ Unknown |
| `fetchAllOrders()` | ✓ OK | ❌ LEAK | ❌ LEAK | ❓ Unknown |
| `fetchAllCustomers()` | ✓ OK | ❌ LEAK | ❌ LEAK | ❓ Unknown |
| `updateTechnician()` | ✓ OK | ❌ LEAK | ❌ LEAK | ❓ Unknown |

---

## Validaciones Requeridas

### A. Lado Cliente (línea de defensa 1)

#### En `src/context/AppContext.tsx`:

```typescript
// Agregar validaciones de ownership antes de llamar a mutaciones

const updateOrder = (orderId: string, patch: ...) => {
  // ✓ DEBE validar que currentUser es Admin
  if (currentUser?.role !== 'admin') {
    throw new Error('Solo admin puede modificar órdenes');
  }
  // O si es técnico, validar que la orden sea suya
  if (currentUser?.role === 'technician') {
    const order = orders.find(o => o.id === orderId);
    if (order?.assignedTechnicianId !== currentUser.technicianId) {
      throw new Error('No puedes modificar órdenes que no te pertenecen');
    }
  }
  // ...
}

const assignTechnician = (orderId: string, technicianId: string) => {
  // ✓ DEBE validar que currentUser es Admin
  if (currentUser?.role !== 'admin') {
    throw new Error('Solo admin puede asignar técnicos');
  }
  // ...
}

const addUsedMaterial = (orderId: string, materialId: string, ...) => {
  // ✓ DEBE validar que currentUser es técnico asignado O admin
  const order = orders.find(o => o.id === orderId);
  const isOwner = currentUser?.technicianId === order?.assignedTechnicianId;
  const isAdmin = currentUser?.role === 'admin';
  
  if (!isOwner && !isAdmin) {
    throw new Error('No tienes permiso para registrar materiales en esta orden');
  }
  // ...
}
```

#### En `src/lib/supabaseData.ts`:

```typescript
// Agregar filtros al cargar datos según el rol

export async function fetchCatalog(currentUser: CurrentUserData | null) {
  // Órdenes: filtrar según rol
  if (currentUser?.role === 'admin') {
    // Cargar todas
  } else if (currentUser?.role === 'technician') {
    // Cargar solo donde assigned_technician_id = currentUser.technicianId
  } else if (currentUser?.role === 'customer') {
    // Cargar solo donde client_id = currentUser.customerId
  }
  
  // Técnicos: nunca exponer lista completa a no-admin
  if (currentUser?.role !== 'admin') {
    // No cargar lista de técnicos, solo nombre del asignado
  }
  
  // Clientes: nunca exponer lista completa a no-admin
  if (currentUser?.role !== 'admin') {
    // No cargar lista de clientes
  }
}
```

---

### B. Lado Servidor (línea de defensa 2 — CRÍTICA)

#### RLS Policies en Supabase:

```sql
-- Tabla: service_orders
-- Admin: acceso completo
CREATE POLICY "admin_service_orders" ON service_orders
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role = 'admin'
    )
  );

-- Técnico: solo sus propias órdenes asignadas
CREATE POLICY "technician_service_orders" ON service_orders
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT p.user_id FROM profiles p
      JOIN technicians t ON p.technician_id = t.id
      WHERE assigned_technician_id = t.id AND p.role = 'technician'
    )
  );

-- Cliente: solo sus propias órdenes
CREATE POLICY "customer_service_orders" ON service_orders
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT p.user_id FROM profiles p
      WHERE customer_id = p.customer_id AND p.role = 'customer'
    )
  );

-- Tabla: order_materials_used
-- Solo técnico asignado a la orden
CREATE POLICY "technician_order_materials" ON order_materials_used
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM service_orders so
      WHERE so.id = order_id
      AND so.assigned_technician_id = (
        SELECT t.id FROM profiles p
        JOIN technicians t ON p.technician_id = t.id
        WHERE p.user_id = auth.uid()
      )
    )
  );

-- Tabla: technicians
-- Admin: acceso completo
-- Otros: prohibido
CREATE POLICY "admin_technicians" ON technicians
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role = 'admin'
    )
  );

-- Tabla: customers
-- Admin: acceso completo
-- Cliente: solo datos propios
CREATE POLICY "admin_customers" ON customers
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "customer_self" ON customers
  FOR SELECT
  USING (
    id = (
      SELECT customer_id FROM profiles WHERE user_id = auth.uid()
    )
  );
```

---

## Plan de Remediación

### Fase 3a: Validaciones en Cliente (1-2 horas)
- [ ] Agregar chequeos de `currentUser?.role` antes de TODAS las mutaciones
- [ ] Validar ownership de órdenes (técnico solo modifica suyas)
- [ ] Filtrar lista de técnicos/clientes según rol en `fetchCatalog()`

### Fase 3b: Hardening en Servidor (3-4 horas)
- [ ] Implementar RLS policies completas en Supabase
- [ ] Desplegar y testear cada policy
- [ ] Verificar que auth.uid() se pasa correctamente

### Fase 3c: Testing de Seguridad (2-3 horas)
- [ ] Crear test suite: intentar modificar órdenes ajenas
- [ ] Validar que RLS rechaza acceso cruzado
- [ ] Verificar respuestas de error son genéricas (no exponen estructura)

---

## Checklista de Validación

### ✓ Por completar:

```
Lado Cliente:
- [ ] createOrder() valida currentUser.role = 'admin'
- [ ] updateOrder() valida ownership por rol
- [ ] assignTechnician() valida currentUser.role = 'admin'
- [ ] addUsedMaterial() valida tecnico asignado
- [ ] toggleChecklistItem() valida acceso a orden
- [ ] fetchCatalog() filtra según rol
- [ ] No expone lista de técnicos a clientes
- [ ] No expone lista de clientes a técnicos

Lado Servidor (Supabase):
- [ ] RLS enabled en service_orders
- [ ] RLS enabled en order_checklist_items
- [ ] RLS enabled en order_time_logs
- [ ] RLS enabled en order_materials_used
- [ ] RLS enabled en technicians (admin-only)
- [ ] RLS enabled en customers (role-scoped)
- [ ] RLS enabled en materials (admin-only)
- [ ] Todas las queries usan auth.uid() correctamente

Pruebas:
- [ ] Técnico A intenta acceder a orden de Técnico B → ERROR
- [ ] Cliente A intenta leer datos de Cliente B → ERROR
- [ ] Cliente intenta asignar técnico → ERROR
- [ ] Técnico intenta modificar datos de otros → ERROR
```

---

## Referencias

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP: Access Control](https://owasp.org/www-community/Access_Control)
- [CWE-639: Authorization Bypass](https://cwe.mitre.org/data/definitions/639.html)

---

**Prioridad:** 🔴 **CRÍTICA** — Debe completarse antes de producción

Generado automáticamente como parte de Fase 3 del Roadmap.
