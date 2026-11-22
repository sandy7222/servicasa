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
| 6 | **Canalizaciones y conductores** (AEA pág. 32) | Tipo de canalización | Por circuito: caño (ej. IRAM 62386-21, RSP 20), conductores F y N (IRAM NM 247-3) y PE, con su sección | Tipos de caño y cable permitidos; sección del PE según la de fase |
| 7 | **Caída de tensión** | Longitud de cada circuito y de la línea seccional; cos φ por circuito | ΔU = 2 × ρ × L / S × I × cos φ por circuito; verifica seccional ≤ 1 % Un y circuito ≤ límite; suma seccional + circuito ≤ 3 % Un. **Si no verifica, propone la sección siguiente y vuelve a calcular** (en el ejemplo la seccional pasa de 4 a 6 mm²) | ρ del conductor; límites de % de Un; tensión; secciones normalizadas |
| 8 | **Exigencia térmica** | — | Verifica K² × S² ≥ I²t por circuito | K por material/aislación (ej. 115 Cu/PVC); I²t de la protección según curva/clase/poder de corte |
| 9 | **Unifilar** | — | Diagrama: protección principal (ID), peine, PAT (jabalina, bornera), ITM y conductores por circuito, cuadro circuito / bocas / DPMS | Símbolos y componentes estándar |
| — | **Materiales y presupuesto** | Precios / mano de obra (opcional) | Lista de materiales (bocas, cajas, cable por metro, caño, ITM, ID, tablero) → ítems del presupuesto con los precios del catálogo | Correspondencia de cada resultado con ítems del catálogo de precios |

### Dónde está cada paso en la norma (AEA 90364-7-770, Edición 2026)
Sacado del índice general del PDF de Sandy (`C:\Users\sandy\Downloads\AEA 90364-7-770 ED. 2026 — AEA.PDF`, escaneado: la página N de la norma es la página N+10 del PDF). Al programar cada paso, leer **solo** esas páginas para tomar los valores (sin copiar el texto en la app):

| Paso | Cláusula | Página de la norma |
|---|---|---|
| Alcance (viviendas unifamiliares hasta 63 A, Icc ≤ 10 kA) | 770.1 | 7 |
| Clasificación de líneas y circuitos (IUG, TUG, ACU, seccional, concepto de boca) | 770.7 (770.7.1 a 770.7.7) | 15 |
| 1. Superficies a considerar (SLA) | 770.8.1 | 18 |
| 2-3. Grados de electrificación, circuitos mínimos y puntos de utilización (bocas) | 770.8.2 y 770.8.3 (viviendas) | 18 a 24 |
| Ubicación de interruptores y tomacorrientes | 770.8.6 | 25 |
| 4. DPMS según grado y de otros circuitos; carga total | 770.9.1 a 770.9.3 | 26 a 28 |
| Contratación del suministro | 770.9.4 | 29 |
| 6. Canalizaciones, cables y conductores permitidos | 770.12 | 31 a 58 |
| Sección nominal de los cables | 770.13 | 60 |
| 5. Determinación de la sección / corriente admisible | 770.16 | 61 a 62 |
| 5. Aparamenta de maniobra y protección | 770.17 | 66 a 67 |
| Protección contra choques eléctricos (diferencial, puesta a tierra) | 770.18 | 68 a 73 |
| Coordinación cable-protección, caídas de tensión | 770.19.3 y 770.19.6 | 78 y 80 |
| Tableros | 770.20 | 82 a 94 |
| Documentación técnica (contenido mínimo del proyecto) | Anexo 770-A | 103 |
| **Guía práctica para cálculos** (tabla resumen para la sección de cables, cortocircuito, tableros) | Anexo 770-D | 111 a 120 |

### Ejemplo de referencia (para los tests)
El ejemplo de los apuntes queda como **caso de prueba**: la app tiene que reproducir sus resultados (SLA 24,81 m²; electrificación mínima; 3 circuitos IUG/TUG/ACU; S IUG = 158,4 VA; S TUG = 2.200 VA; DPMS = 2.358,4 VA < 3,7 kVA → se mantiene el grado mínimo; tabla de protecciones IUG 6 A / 1,5 mm², TUG 16 A / 2,5 mm², ACU 16 A / 2,5 mm², seccional 25 A / 4 mm² con ID 30 mA tipo A; ITM bipolar curva C 3 kA).

Pasos 6 a 9 del ejemplo (apuntes del 16/11): canalización RSP 20 / IRAM 62386-21 y conductores IRAM NM 247-3 (F y N: IUG 1,5; TUG 2,5; ACU 2,5; seccional 4 → 6 mm²). Caída de tensión con ρ = 0,017, longitudes IUG 4 m / TUG 7,5 m / ACU 2 m / seccional 20 m, cos φ 0,85 en todos los cálculos (confirmado con el apunte de un compañero, 21/11; el 0,75 era un error de copia): ΔU IUG 0,056 V, TUG 0,867 V, ACU 0,27 V, seccional 3,29 V con 4 mm² (no verifica 1 % = 2,2 V) → 6 mm²: 2,19 V; totales IUG 2,24 V, TUG 3,06 V, ACU 2,46 V ≤ 3 % (6,6 V). Exigencia térmica K = 115, I²t = 18.000 A²s (ITM curva C clase 3, 3 kA): IUG 1,5 mm² y TUG/ACU 2,5 mm² verifican. Unifilar: ID 2×40 A 30 mA, peine 63 A bipolar, PAT con jabalina 1.500 mm y bornera de 8 salidas, PE 1×6 mm² a tierra y 1×2,5 mm² por circuito; IUG 2×10 A, TUG 2×16 A, ACU 2×16 A (todas C 3 kA); 4 bocas IUG (158 VA), 4 bocas TUG (2.200 VA), 1 boca AA (2.600 W). Plano: departamento en 3er piso, habitación 16 m², baño 6 m², balcón 2,5 m², escala 1:50.

**Salidas que tiene que generar la app** (las mismas que pide el Trabajo Práctico N° 1): memoria técnica, vista en planta (opcional: subir el plano), unifilar y lista de materiales.

**Dudas abiertas para Sandy (antes de programar):**
1. ~~La térmica de IUG figura de 6 A en el paso 5 y de 10 A en el paso 8 y en el unifilar~~ → **Respuesta de Sandy (16/11): queda en 10 A; con 6 A "no verificaba el estándar del 2 % de tolerancia".** Falta saber qué cuenta exacta no cumplía (¿caída de tensión del circuito? ¿coordinación cable-protección?) para que la app la repita: probar protección → verificar → si no cumple, pasar a la siguiente.
2. ~~En la DPMS del ejemplo se suman IUG + TUG y el ACU (2.600 W) va aparte~~ → **Respuesta de Sandy (16/11): según la AEA, en la DPMS del grado de electrificación (770.9.1) los circuitos de uso específico no suman; suman recién en la DPMS total (770.9.2/770.9.3).** La app calcula las dos: DPMS del grado (IUG + TUG = 2.358,4 VA → verifica el grado) y DPMS total (+ ACU 2.600 W) para la línea seccional. Coincide con el ejemplo: (2.358,4 + 2.600) / 220 V ≈ 22,5 A = corriente de la seccional del paso 5.
3. ~~Las 4 bocas de IUG y 4 de TUG del unifilar: ¿en qué ambientes van?~~ → **Respuesta de Sandy (16/11): se pone el mínimo de IUG y TUG que exige cada circuito; la distribución está en el plano** (en la foto se ven bocas A, B, C, D; la resolución no alcanza para contar los tomas). **Decisión para la app:** propone el mínimo de bocas por ambiente según 770.8.3 y el grado; el técnico puede agregar más; la app suma por circuito y verifica mínimos/máximos. Para el test se usan los totales del unifilar: IUG 4, TUG 4, ACU 1.

**Fase 0 cerrada el 16/11/2026.**

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
| 16/11/2026 | **Fase 1 hecha** (`85d2e38`): motor `src/lib/installationProject.ts` con reglas de la AEA (tablas 770.7.I, 770.8.I–III, 770.9.I–II, 770.13.I, 770.16.I, 770.19.IV) y el ejemplo de clase como test. **Fase 2 (primera versión) hecha:** pantalla `InstallationProjectView` en `/technician/proyecto-instalacion`, entrada en Ajustes solo para Electricidad (`isElectrician`), proponer circuitos mínimos, memoria de cálculo imprimible; guarda en el dispositivo (localStorage). Pendiente de Fase 2: guardar en la cuenta (tabla + migración) y adjuntar el plano. Para consultar con el profesor: el criterio "DPMS < 3,7 kVA" no está en la Ed. 2026 (grado solo por superficie) y la Tabla 770.9.I usa 2/3 (no 0,66). |
| 16/11/2026 | Metodología completa: pasos 6 (canalizaciones), 7 (caída de tensión, con recálculo de sección), 8 (exigencia térmica), 9 (unifilar), plano del ejemplo y entregables del TP N° 1. Fase 0 casi cerrada: faltan las 3 dudas. |
