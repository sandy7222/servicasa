# Plan: módulo "Proyecto de instalación" (electricistas)

> **Estado:** borrador, 13/11/2026. **No se programa todavía**: Sandy completa la metodología en la próxima clase (falta el paso 6 y siguientes).
> **Fuente técnica:** la Reglamentación AEA 90364-7-770 (instalaciones eléctricas en inmuebles), de cumplimiento obligatorio, aplicada según los apuntes de clase de Sandy. La app **aplica** las reglas y cita el artículo/tabla; **no reproduce el texto del libro**. Los valores técnicos los valida Sandy (la IA no da indicaciones técnicas de electricidad).

## Qué es y qué no es
- Una **herramienta opcional** en el panel del técnico, solo visible para técnicos con la especialidad **Electricidad**.
- Sirve para calcular un **proyecto de instalación domiciliaria** (obra nueva o instalación completa) y, si el técnico quiere, **pasarlo a un presupuesto** para el cliente.
- **No** cambia el circuito de reparaciones/servicios: nada nuevo obligatorio en las órdenes.
- El resultado es una **guía de cálculo**: el técnico revisa, puede corregir cualquier valor, y él firma y responde por el proyecto final (leyenda visible en pantalla y en el presupuesto).

## Los pasos (según los apuntes del ejemplo de clase)
| # | Paso | Qué carga el técnico | Qué calcula la app | Valores que carga Sandy (configuración) |
|---|---|---|---|---|
| 1 | **Superficie Límite de Aplicación (SLA)** | Ambientes: nombre, m², cubierto o semicubierto | SLA = Σ superficie cubierta + Σ superficie semicubierta / 2 | — |
| 2 | **Tipo / grado de electrificación** | — | Grado según SLA (ej.: SLA < 60 m² → electrificación mínima) | Límites de SLA y de potencia de cada grado |
| 3 | **Número mínimo de bocas y circuitos** | Tipo de cada ambiente; si hay aire acondicionado u otras cargas | Tabla "bocas por circuito y ambiente" (IUG / TUG / ACU…) y circuitos mínimos | Bocas mínimas por tipo de ambiente y grado; circuitos mínimos por grado |
| 4 | **Demanda de Potencia Máxima Simultánea (DPMS)** | — (puede corregir) | Potencia por circuito (ej.: IUG = bocas × coeficiente × VA por boca; TUG = valor fijo; ACU = potencia del equipo) y DPMS = suma de los circuitos que corresponda; verifica si se mantiene el grado | Coeficientes y VA por tipo de circuito; qué circuitos suman en la DPMS; límite de potencia por grado |
| 5 | **Protecciones y conductores** | — (puede corregir) | Por circuito: I = S/U, In de la protección, Iz y sección del conductor; seccional y principal; tipo de ITM e interruptor diferencial | Tabla corriente → In → Iz → sección; tensión de cálculo; criterio de ITM e ID |
| 6 | **Canalizaciones y conductores** | Tipo de canalización | Caño y conductores (F, N, PE) por circuito | **Pendiente: Sandy lo completa en la próxima clase** |
| 7+ | **(siguientes pasos de la clase)** | | | Pendiente |
| — | **Materiales y presupuesto** | Precios / mano de obra (opcional) | Lista de materiales (bocas, cajas, cable por metro, caño, ITM, ID, tablero) → ítems del presupuesto con los precios del catálogo | Correspondencia de cada resultado con ítems del catálogo de precios |

### Ejemplo de referencia (para los tests)
El ejemplo de los apuntes queda como **caso de prueba**: la app tiene que reproducir sus resultados (SLA 24,81 m²; electrificación mínima; 3 circuitos IUG/TUG/ACU; S IUG = 158,4 VA; S TUG = 2.200 VA; DPMS = 2.358,4 VA < 3,7 kVA → se mantiene el grado mínimo; tabla de protecciones IUG 6 A / 1,5 mm², TUG 16 A / 2,5 mm², ACU 16 A / 2,5 mm², seccional 25 A / 4 mm² con ID 30 mA tipo A; ITM bipolar curva C 3 kA).

**Dudas abiertas para Sandy (antes de programar):**
1. En la DPMS del ejemplo se suman IUG + TUG. ¿El circuito ACU (2.600 W) no entra en esa suma? ¿Cuál es la regla?
2. En el paso 4 dice "4 bocas" de IUG y en la tabla del paso 3 aparecen 3 (habitación, baño, balcón): ¿hay un cuarto ambiente en la primera hoja?
3. La primera hoja se ve chica: reenviarla más de cerca (medidas de los ambientes y aclaraciones del proyecto).

## Diseño técnico (propuesta)
- **Datos:** tabla `installation_projects` (técnico, cliente/orden opcional, ambientes y resultados en JSON, versión de las reglas usadas, fechas). RLS: cada técnico ve los suyos; admin ve todos.
- **Reglas configurables:** tabla `installation_rules` (o `system_settings` de tipo json) editable solo por admin desde "Configuración → Tablas de cálculo", con la referencia de artículo/tabla de la AEA en cada valor. El cálculo **siempre** lee de ahí: nada técnico escrito a fuego en el código.
- **Cálculo:** funciones puras en `src/lib/installationProject.ts`, una por paso, con tests que reproducen el ejemplo de clase.
- **Pantalla:** "Proyecto de instalación" en el menú del técnico (solo electricistas), asistente paso a paso con el resultado de cada paso en tablas como las de los apuntes, edición manual de cualquier valor, guardado de borradores, impresión/PDF.
- **Presupuesto:** botón "Pasar a presupuesto" que crea los ítems en el presupuesto de una orden (con precios del catálogo), sin enviarlo: el técnico lo revisa y lo envía como siempre.
- **Leyenda:** "Cálculo orientativo según AEA 90364-7-770. El técnico matriculado verifica y es responsable del proyecto."

## Fases
- **Fase 0 (👤 Sandy):** completar la metodología en clase; contestar las dudas; reenviar la hoja 1.
- **Fase 1 (🤖):** funciones de cálculo + tests con el ejemplo + tabla de reglas configurables (con los valores del ejemplo como punto de partida, a validar por Sandy).
- **Fase 2 (🤖):** pantalla del asistente para el técnico (solo electricistas), guardado e impresión.
- **Fase 3 (🤖):** "Pasar a presupuesto" con el catálogo de precios.
- **Fase 4 (👤🤖):** prueba con un proyecto real de Sandy y ajustes.

## Bitácora
| Fecha | Qué se hizo |
|---|---|
| 13/11/2026 | Plan escrito a partir de los apuntes de clase de Sandy (pasos 1 a 5 del ejemplo, paso 6 empezado). Decisiones: módulo opcional, solo electricistas, valores técnicos configurables por Sandy, sin reproducir el texto de la norma. |
