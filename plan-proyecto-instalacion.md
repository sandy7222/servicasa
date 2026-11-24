# Plan: módulo "Proyecto de instalación" (electricistas)

> **Estado (23/11/2026):** Fases 0, 1, 2B y 2C (código) hechas; Fase 2 hecha en su primera versión. **Fase 2C hecha y migración aplicada.** Se hace antes la Fase 3B (la 3 necesita sus precios); motor de precio de 3B ya hecho, cómputo de materiales (3B.1) también hecho; listas de precios (3B.2) también hechas en motor; pantalla del presupuesto de obra hecha (`InstallationBudgetPanel.tsx`: materiales, insumos, herramientas, mano de obra, porcentajes, precio y anticipo); nota de presupuesto para el cliente (3B.7) hecha; 3B (con composición interna) y Fase 3 hechas; sigue la Fase 4 (prueba real con un proyecto de Sandy). Después: 3 (pasar a presupuesto), 3B (presupuesto formal de obra) y 4 (prueba real).
> **Fuente técnica:** la Reglamentación AEA 90364-7-770 (instalaciones eléctricas en inmuebles), de cumplimiento obligatorio, aplicada según los apuntes de clase de Sandy. La app **aplica** las reglas y cita el artículo/tabla; **no reproduce el texto del libro**. Los valores técnicos los valida Sandy (la IA no da indicaciones técnicas de electricidad).

---

## 0. Para el agente que retome este plan (leer primero)

**Qué es este proyecto:** ServiCasa / TecniUrbano, plataforma que conecta clientes con técnicos de oficios (React + TypeScript + Vite, Supabase, Vercel, Mercado Pago). Este módulo es una herramienta **opcional** para técnicos electricistas.

**Archivos del módulo:**
| Archivo | Qué tiene |
|---|---|
| `src/lib/installationProject.ts` | Motor de cálculo: funciones puras, reglas en `DEFAULT_RULES` (cada valor con su tabla de la AEA). |
| `src/lib/installationProject.test.ts` | Tests: reproducen el ejemplo de clase. **Todo cambio del motor tiene que mantenerlos en verde.** |
| `src/components/technician/InstallationProjectView.tsx` | Pantalla del técnico (`/technician/proyecto-instalacion`), memoria de cálculo imprimible; hoy guarda en `localStorage`. |
| `src/components/technician/InstallationProjectView.test.tsx` | Tests de la pantalla y de `isElectrician`. |
| `src/lib/technicianTools.ts` | `isElectrician` (la entrada solo aparece para la especialidad Electricidad). |
| `src/components/technician/QuoteBuilder.tsx` | Presupuesto normal de una orden (ítems de catálogo). **No se modifica** salvo en la Fase 3. |

**Comandos:** `npx vitest run src/lib/installationProject.test.ts src/components/technician/InstallationProjectView.test.tsx` (tests del módulo); `npx tsc --noEmit` (tipos).

**Reglas de trabajo (de Sandy, no negociables):**
1. Responder en **español**, simple y paso a paso. Sandy no lee código: explicar qué cambia en la pantalla, no en el código.
2. **Buscar antes de construir:** antes de agregar algo, revisar si ya existe (grep en `src/` y `api/`).
3. **No tocar lo que ya funciona** en producción (presupuestos, pagos, órdenes) para construir esto: el módulo es aparte.
4. Nada técnico escrito a fuego en la lógica: los valores van en `InstallationRules` con la cita de la tabla.
5. Vercel Hobby tiene un **límite de 12 funciones**: endpoints nuevos van como rutas dentro de `api/gateway.ts`, nunca como archivos nuevos en `api/`.
6. Las **migraciones** de Supabase las aplica Sandy a mano en el editor SQL (el conector de Claude no siempre ve el proyecto). Escribir el archivo en `supabase/migrations/`, dárselo y **no desplegar** código que dependa de la migración antes de que confirme.
7. Commits en `main` solo con el OK de Sandy; push solo si lo pide. Producción despliega desde `main`.
8. Al terminar cada fase: tests en verde, anotar en la **Bitácora** de este archivo (fecha, qué se hizo, commit).

---

## Qué es y qué no es
- Una **herramienta opcional** en el panel del técnico, solo visible para técnicos con la especialidad **Electricidad**.
- Sirve para calcular un **proyecto de instalación domiciliaria** (obra nueva o instalación completa) y, si el técnico quiere, **armar un presupuesto de obra** para el cliente.
- **No** cambia el circuito de reparaciones/servicios: nada nuevo obligatorio en las órdenes. Para una reparación chica el técnico sigue usando el presupuesto de siempre.
- El resultado es una **guía de cálculo**: el técnico revisa, puede corregir cualquier valor, y él firma y responde por el proyecto final (leyenda visible en pantalla y en el presupuesto).

## Los pasos (según los apuntes del ejemplo de clase)
| # | Paso | Qué carga el técnico | Qué calcula la app | Valores que carga Sandy (configuración) |
|---|---|---|---|---|
| 1 | **Superficie Límite de Aplicación (SLA)** | Ambientes: nombre, m², cubierto o semicubierto | SLA = Σ superficie cubierta + Σ superficie semicubierta / 2 | — |
| 2 | **Tipo / grado de electrificación** | — | Grado según SLA (ej.: SLA < 60 m² → electrificación mínima) | Límites de SLA y de potencia de cada grado |
| 3 | **Número mínimo de bocas y circuitos** | Tipo de cada ambiente; si hay aire acondicionado u otras cargas | Tabla "bocas por circuito y ambiente" (IUG / TUG / ACU…) y circuitos mínimos | Bocas mínimas por tipo de ambiente y grado; circuitos mínimos por grado |
| 4 | **Demanda de Potencia Máxima Simultánea (DPMS)** | — (puede corregir) | Potencia por circuito (ej.: IUG = bocas × coeficiente × VA por boca; TUG = valor fijo; ACU = potencia del equipo) y DPMS = suma de los circuitos que corresponda; verifica si se mantiene el grado | Coeficientes y VA por tipo de circuito; qué circuitos suman en la DPMS; límite de potencia por grado |
| 5 | **Protecciones y conductores** | Icc del punto de suministro (dato de la distribuidora / del profesor) | Por circuito: I = S/U, In de la protección, Iz y sección del conductor; seccional y principal; tipo de ITM e interruptor diferencial; **poder de corte ≥ Icc** (Fase 2B) | Tabla corriente → In → Iz → sección; tensión de cálculo; poderes de corte normalizados |
| 6 | **Canalizaciones y conductores** (AEA pág. 32) | Tipo de canalización | Por circuito: caño (ej. IRAM 62386-21, RSP 20), conductores F y N (IRAM NM 247-3) y PE, con su sección | Tipos de caño y cable permitidos; sección del PE según la de fase |
| 7 | **Caída de tensión** | Longitud de cada circuito y de la línea seccional; cos φ por circuito | ΔU = 2 × ρ × L / S × I × cos φ por circuito; verifica seccional ≤ 1 % Un, circuito ≤ 2 % Un y total ≤ 3 % Un. **Si no verifica, propone la sección siguiente y vuelve a calcular** | ρ del conductor; límites de % de Un; tensión; secciones normalizadas |
| 8 | **Corriente de cortocircuito y exigencia térmica** | — (puede cargar el I²t del fabricante) | 8 A: poder de corte de ITM y capacidad del ID ≥ Icc. 8 B: K² × S² ≥ I²t por circuito **y para la línea seccional**; **si no verifica, sube la sección** (Fase 2B) | K por material/aislación (115 Cu/PVC); tabla de I²t máximo por In, poder de corte, clase y curva |
| 9 | **Unifilar** | — | Diagrama: protección principal (ID), peine, PAT (jabalina, bornera), ITM y conductores por circuito, cuadro circuito / bocas / DPMS | Símbolos y componentes estándar |
| — | **Materiales y presupuesto** | Precios / mano de obra (opcional) | Ver Fases 3 y 3B | Ver Fases 3 y 3B |

### Dónde está cada paso en la norma
**AEA 90364-7-770, Edición 2026** (`C:\Users\sandy\Downloads\AEA 90364-7-770 ED. 2026 — AEA.PDF`, escaneado, **sin texto extraíble**: la página N de la norma es la página N+10 del PDF). Al programar cada paso, leer **solo** esas páginas para tomar los valores (sin copiar el texto en la app):

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

**Guía AEA 90364-7-770, Edición 2017** (`C:\Users\sandy\Downloads\Guia AEA.pdf`, **con texto**; página del PDF = página de la Guía + 8). Se usó en el TP N° 1 para el paso 8, porque la Ed. 2026 no se puede leer:

| Dato | Dónde | Página de la Guía (PDF) |
|---|---|---|
| K para cables activos: cobre con PVC, 70 → 160 °C = **115** | Tabla 770.15.II | 48 (56) |
| I²t: "no es calculable por el proyectista, es un valor garantizado por el fabricante" | 770.15.2.2 | 48 (56) |
| Protección del ID contra cortocircuitos y su capacidad de ruptura | 770.15.2.2.5 y 770-B.2.4, Tabla 770-B.X | 48 (56) y 73 (81) |
| **I²t máximo orientativo** de ITM IEC 60898-1 hasta 16 A | **Tabla 770-B.VIII** | 72 (80) |
| **I²t máximo orientativo** de ITM de 16 A < In ≤ 32 A | **Tabla 770-B.IX** | 72 (80) |
| Ejemplo resuelto: TUG 2,5 mm², C16, 6 kA, clase 3 → 42.000 A²s; 82.656 ≥ 42.000 | 770-B.2.3 | 73 (81) |

> ⚠️ Antes de cargar estos valores, confirmar con Sandy que la Ed. 2026 mantiene la misma numeración y los mismos valores (él tiene el libro impreso).

### Ejemplo de referencia de clase (caso de prueba 1, ya en los tests)
La app tiene que reproducir sus resultados (SLA 24,81 m²; electrificación mínima; 3 circuitos IUG/TUG/ACU; S IUG = 158,4 VA; S TUG = 2.200 VA; DPMS = 2.358,4 VA < 3,7 kVA → se mantiene el grado mínimo; tabla de protecciones IUG 6 A / 1,5 mm², TUG 16 A / 2,5 mm², ACU 16 A / 2,5 mm², seccional 25 A / 4 mm² con ID 30 mA tipo A; ITM bipolar curva C 3 kA).

Pasos 6 a 9 del ejemplo (apuntes del 16/11): canalización RSP 20 / IRAM 62386-21 y conductores IRAM NM 247-3 (F y N: IUG 1,5; TUG 2,5; ACU 2,5; seccional 4 → 6 mm²). Caída de tensión con ρ = 0,017, longitudes IUG 4 m / TUG 7,5 m / ACU 2 m / seccional 20 m, cos φ 0,85 en todos los cálculos (confirmado con el apunte de un compañero, 21/11; el 0,75 era un error de copia): ΔU IUG 0,056 V, TUG 0,867 V, ACU 0,27 V, seccional 3,29 V con 4 mm² (no verifica 1 % = 2,2 V) → 6 mm²: 2,19 V; totales IUG 2,24 V, TUG 3,06 V, ACU 2,46 V ≤ 3 % (6,6 V). Exigencia térmica K = 115, I²t = 18.000 A²s (ITM curva C clase 3, **3 kA** → fila de 3.000 A de la Tabla 770-B.VIII): IUG 1,5 mm² y TUG/ACU 2,5 mm² verifican. Unifilar: ID 2×40 A 30 mA, peine 63 A bipolar, PAT con jabalina 1.500 mm y bornera de 8 salidas, PE 1×6 mm² a tierra y 1×2,5 mm² por circuito; IUG 2×10 A, TUG 2×16 A, ACU 2×16 A (todas C 3 kA); 4 bocas IUG (158 VA), 4 bocas TUG (2.200 VA), 1 boca AA (2.600 W). Plano: departamento en 3er piso, habitación 16 m², baño 6 m², balcón 2,5 m², escala 1:50.

> Nota: el ejemplo de clase no informa Icc. Para que siga en verde después de la Fase 2B, el test lo corre con Icc = 3.000 A (sus térmicas de 3 kA verifican justo) o sin Icc (la verificación de poder de corte queda "sin dato").

### Caso de prueba 2: el Trabajo Práctico N° 1 de Sandy (resultado final validado el 23/11/2026)
Departamento en 3er piso, Constitución 1734, C.A.B.A. Memoria completa en `C:\Users\sandy\Downloads\trabajo practico\TP1_memoria_AEA.docx` / `.pdf` (11 páginas) y nota en `TP1_nota_de_presupuesto.pdf`.

| Dato | Valor |
|---|---|
| Icc (dato del profesor) | **3.250 A** |
| Circuitos | IUG 5 bocas (L = 11 m), TUG 11 bocas (L = 12 m), ACU 2.600 VA (L = 11 m), seccional L = 11 m (9 m verticales + 2 m) |
| Corrientes | IUG 0,90 A · TUG 10 A · ACU 11,82 A · seccional 22,72 A (la memoria usa 198 VA en IUG, factor 0,66; el motor usa 2/3 → 200 VA y 22,73 A: diferencia aceptable) |
| Protecciones | ITM bipolares curva C **4,5 kA** clase 3: IUG 10 A, TUG 16 A, ACU 16 A; seccional protegida por 25 A 4,5 kA; ID 2×40 A 30 mA |
| 8 A — poder de corte | 3 kA: 3.000 < 3.250 **no verifica** → se adoptan 4,5 kA: 4.500 ≥ 3.250 verifica. ID SICA 785640 (3 kA con fusible de respaldo 63 A): **no verifica**; ID Chint 6 kA: verifica |
| 8 B — exigencia térmica | I²t = **30.000** A²s (Tabla 770-B.VIII, 4.500 A, clase 3, C) y **39.000** A²s (Tabla 770-B.IX, 25 A). IUG 1,5 mm²: 29.756 < 30.000 **no verifica → sube a 2,5 mm²** (82.656). TUG/ACU 2,5 mm²: 82.656. Seccional 4 mm²: 211.600 ≥ 39.000 |
| Caídas (cos φ 0,85, ρ 0,017) | seccional 4 mm² 1,81 V · IUG 2,5 mm² 0,11 V · TUG 1,39 V · ACU 1,50 V; totales IUG 1,92 V, TUG 3,19 V, ACU 3,31 V (≤ 6,6 V) |

---

## Lecciones del TP N° 1 que el motor todavía no tiene (origen de la Fase 2B)
1. **Poder de corte:** la Icc es un dato de entrada. Toda térmica debe tener poder de corte ≥ Icc; el diferencial, capacidad de cortocircuito ≥ Icc (o la que garantiza el fabricante con su protección de respaldo). Hoy el motor no pide Icc ni lo verifica.
2. **I²t depende de la térmica elegida:** el motor usa un **18.000 fijo**, que solo vale para 3 kA, clase 3, curva C, In ≤ 16 A. Al pasar a 4,5 kA es 30.000; para 25 A es 39.000. Tiene que salir de una tabla (In, poder de corte, clase, curva) o del dato del fabricante que cargue el técnico.
3. **Si no verifica la exigencia térmica, subir la sección** (igual que hoy se hace con la caída de tensión). Caso real: IUG de 1,5 a 2,5 mm².
4. **La línea seccional también se verifica en el 8 B**, con el I²t de la protección que la alimenta.
5. **cos φ = 0,85 en todos los circuitos** (ya corregido en `c8da54a`).
6. **Llaves combinadas:** sus 3 conductores (línea y dos retornos) van con la sección del circuito IUG; si el IUG sube de sección, ellos también (impacta en materiales).

---

## Diseño técnico
- **Datos:** tabla `installation_projects` (técnico, cliente/orden opcional, ambientes, circuitos, resultados y presupuesto en JSON, versión de las reglas usadas, fechas). RLS: cada técnico ve los suyos; admin ve todos.
- **Reglas configurables:** hoy en `DEFAULT_RULES` (código). Más adelante, tabla `installation_rules` (o `system_settings` tipo json) editable solo por admin, con la referencia de artículo/tabla en cada valor. El cálculo **siempre** lee de ahí.
- **Cálculo:** funciones puras en `src/lib/installationProject.ts`, una por paso, con tests.
- **Pantalla:** asistente paso a paso con tablas como las de los apuntes, edición manual de cualquier valor, guardado, impresión/PDF.
- **Leyenda:** "Cálculo orientativo según AEA 90364-7-770. El técnico matriculado verifica y es responsable del proyecto."

---

## Fases

### ✅ Fase 0 (👤 Sandy) — metodología. Cerrada el 16/11/2026.
### ✅ Fase 1 (🤖) — motor de cálculo + tests con el ejemplo. `85d2e38`.
### ✅ Fase 2 (🤖) — pantalla del técnico y memoria imprimible (primera versión). `344828c`, `ca2e086`, `c8da54a`.

### ✅ Fase 2B (🤖) — Correcciones del motor (cortocircuito y exigencia térmica) — hecha el 23/11/2026 (sin commit todavía)
**Objetivo:** que el motor reproduzca el caso de prueba 2 (TP N° 1) sin romper el caso 1.
- [x] 2B.1 **Entrada:** `ProjectInput.iccA?: number` (Icc del punto de suministro). Por circuito y seccional: `breakingCapacityA?` (poder de corte elegido) y, opcional, `i2tOverride?` (I²t del fabricante). Para el ID: `rcdShortCircuitA?` (capacidad de cortocircuito garantizada).
- [x] 2B.2 **Reglas:** `breakingCapacities: [3000, 4500, 6000, 10000]`; `defaultEnergyClass: 3`; `defaultCurve: 'C'`; tabla `i2tMax` con las Tablas 770-B.VIII (In ≤ 16 A) y 770-B.IX (16 < In ≤ 32 A) por poder de corte, clase (2 y 3; clase 1 = "sin límite": no se puede verificar sin dato del fabricante) y curva (B y C). Valores clase 3: ≤16 A → B 15.000/25.000/35.000/70.000, C 18.000/30.000/42.000/84.000; 16–32 A → B 18.000/32.000/45.000/90.000, C 22.000/39.000/55.000/110.000 (para 3.000/4.500/6.000/10.000 A). Clase 2: ≤16 A → B 31.000/60.000/100.000/240.000, C 37.000/75.000/120.000/290.000; 16–32 A → B 40.000/80.000/130.000/310.000, C 50.000/100.000/160.000/370.000. Reemplaza `thermal.i2t`. Los valores se cargan con la cita de la Guía 2017 y la marca "a confirmar con Ed. 2026" (ver "Única comprobación pendiente de Sandy").
- [x] 2B.3 **Propuesta automática:** si el técnico no fija el poder de corte, la app propone el menor normalizado ≥ Icc (Icc 3.250 → 4.500 A).
- [x] 2B.4 **Verificación 8 A:** por circuito y seccional, `breakingOk = breakingCapacityA ≥ iccA`; para el ID, `rcdShortCircuitA ≥ iccA` (sin dato → advertencia "confirmar con el fabricante"). Sin Icc cargada → resultado "sin dato", no error.
- [x] 2B.5 **Verificación 8 B:** I²t = `i2tOverride` o el de la tabla según In, poder de corte, clase y curva. Si no verifica y el técnico no fijó la sección, subir a la siguiente normalizada y marcar `sectionIncreasedForThermal` (análogo a `sectionIncreasedForDrop`). Recalcular la caída con la sección nueva.
- [x] 2B.6 **Seccional en el 8 B:** misma verificación con la protección de la seccional (In 25 A en el caso 2 → Tabla 770-B.IX → 39.000).
- [x] 2B.7 **Pantalla y memoria:** mostrar Icc, el 8 A (fila por protección con VERIFICA / NO VERIFICA), en el 8 B la fila de la tabla usada ("Tabla 770-B.VIII: 4.500 A, clase 3, C → 30.000 A²·s") y la marca de sección aumentada; leyenda "el I²t real es dato garantizado por el fabricante".
- [x] 2B.8 **Tests:** caso 1 sigue en verde (Icc 3.000 o sin Icc); caso 2 completo (tabla de arriba): propone 4,5 kA, IUG sube a 2,5 mm² por térmica, seccional 211.600 ≥ 39.000, ID de 3 kA no verifica y de 6 kA sí.
- **Terminado cuando:** los dos casos pasan, `tsc` sin errores y Sandy revisa la memoria impresa del caso 2 contra su TP.

### 🟡 Fase 2C (🤖 + 👤 migración) — Guardar en la cuenta
- [x] Migración `supabase/migrations/20261124030159_installation_projects.sql` (+ RLS solo del dueño) — **aplicada en producción el 24/11/2026.**
- [x] Guardar/abrir/duplicar/eliminar desde la pantalla (`src/lib/installationProjectStore.ts` + panel "Mis proyectos guardados"). El borrador sigue en `localStorage`; "Guardar en mi cuenta" sube lo que haya en el dispositivo.
- [x] Adjuntar el plano (PDF, JPG o PNG, hasta 10 MB) en el bucket privado `installation-plans` (carpeta `<técnico>/<proyecto>/`, solo el dueño; mismo patrón que `technician-documents`). Código y migración `20261124034559_installation_plans.sql` **aplicada en producción el 24/11/2026**. Al borrar el proyecto se borra también el archivo.

### ✅ Fase 3 (🤖) — "Pasar a presupuesto" de una orden
- [x] Botón en el proyecto (sección 8 del presupuesto; `installationQuoteItems.ts`): elegir una orden del técnico y crear ítems en `order_quote_items` (`item_type` = `labor` | `material`, ya existe el CHECK) **sin enviarlo**; el técnico lo revisa y lo envía como siempre desde `QuoteBuilder`.
- [x] Mapeo: **solo materiales e insumos** (decisión de Sandy 24/11): la base exige que la mano de obra venga del catálogo publicado (trigger `apply_catalog_price_to_quote_item`), así que el técnico la elige en `QuoteBuilder`.
- [x] No cambia la lógica de precios ni de pagos; solo órdenes del técnico con presupuesto en borrador o sin presupuesto (mismo criterio que `QuoteBuilder`).

### ⏳ Fase 3B (🤖) — Presupuesto formal de obra (módulo aparte, dentro del asistente)
Reproduce las secciones 10 a 14 del TP N° 1. Es **opcional** y solo para obras completas.
- [x] 3B.1 (hecho: `src/lib/installationTakeoff.ts`, cantidades sugeridas con la regla de cada una, editables; falta mostrarlas en pantalla) **Cómputo de materiales** desde el proyecto: cables por metro (+10 % de desperdicio) por sección y color, caños en tiras de 3 m (RSP 20 circuitos, RSP 25 seccional), cajas (octogonales para bocas de luz, rectangulares para llaves y tomas), conectores, cuplas y curvas, mecanismos y tapas, plafones, ITM, ID, peine, bornera, jabalina, cable de PAT, cinta y precintos. Cantidades editables.
- [x] 3B.2 (motor hecho: `src/lib/installationPrices.ts` con precio prestado marcado, rollo cerrado y pegado de precios; test con las 27 líneas del caso 2: 787.626,73 y 1.080.303,24 al centavo; falta la pantalla) **Dos listas de precios** (opción 1 "por precio" y opción 2 "por calidad/marca"): el técnico carga o pega los precios; marca de ítem faltante en una casa (se usa el de la otra, con asterisco); cables por rollo cerrado cuando la casa no vende por metro. **No** se hace scraping automático de tiendas en esta fase.
- [x] 3B.3 (pantalla: lista de insumos que suma como material) **Insumos** que se consumen (discos, hojas, mechas, grampas, tarugos): se cobran como material.
- [x] 3B.4 **Depreciación de herramientas** (no se cobra la herramienta, solo el desgaste): cuota anual = (valor de origen − residual) / vida útil; cargo = cuota anual × horas en obra / horas de uso al año. Supuestos por defecto: residual 10 %, 5 años, 400 h/año (cuota = 18 % del valor). Editables por herramienta.
- [x] 3B.5 **Mano de obra:** tareas × horas de oficial y de ayudante × valor hora (referencia UOCRA, editable), + cargas sociales (%, defecto 50 %). Plazo = horas de oficial / 8 h por día (redondeo hacia arriba).
- [x] 3B.6 **Precio:** costo directo = materiales + insumos + depreciación + mano de obra con cargas + visita (monto fijo); + gastos generales (% sobre directo, defecto 10 %); + beneficio (% sobre directo + GG, defecto 10 %). Anticipo = visita + 50 % de (materiales + insumos) + depreciación; saldo al terminar.
- [x] 3B.7 (hecho: `src/lib/installationQuoteNote.ts` + sección 7 del panel; abre la nota en otra pestaña para imprimir o guardar PDF; la composición interna del precio está en `src/lib/installationComposition.ts` y en el panel, con documento imprimible aparte) **Salidas:** desglose para el cliente, composición del precio (cálculo interno) y **nota de presupuesto en PDF** con el **logo de TecniUrbano** (`src/assets/logo-tecniurbano.png`), datos del técnico y del cliente, alcance, condiciones (precios sin IVA, validez 10 días, plazo, no incluye, forma de pago) y la línea de **garantía con la redacción de los Términos** (`src/lib/legalTerms.ts`, sección 5: "si el trabajo no queda bien, se soluciona sin cargo dentro de los 30 días posteriores a su finalización; reclamo hasta 48 h después"), con la palabra **"respaldada"** (la ejecución es responsabilidad del técnico independiente, sección 4 de los Términos).
- [x] 3B.8 (`src/lib/installationCaso2.test.ts`: listas de precios → precio → nota, al centavo en las dos opciones) **Test (oráculo, caso 2, opción 1):** materiales 787.626,73; insumos 94.710,00; depreciación 6.586,99; MO básica 986.520,00 (78 h oficial × 7.828 + 66 h ayudante × 5.696) → con cargas 1.479.780,00; visita 60.000,00; costo directo 2.428.703,72; GG 242.870,37; beneficio 267.157,41; **total 2.938.731,50**; anticipo 507.755,35 (17,3 %); saldo 2.430.976,15. Opción 2: materiales 1.080.303,24 → total 3.292.870,08; anticipo 654.093,61 (19,9 %).
- Tareas del caso 2 (oficial h / ayudante h): replanteo 4/2; canaletas y perforaciones 8/16; caños, cajas y accesorios 20/10; tapado 6/12; pasado de conductores 8/8; línea seccional 6/6; tablero seccional 8/4; mecanismos y plafones 10/4; puesta a tierra 4/4; ensayos y puesta en servicio 4/0.
- Herramientas del caso 2 (valor de origen / horas): amoladora 483.644,90 / 16; rotomartillo 463.649,00 / 12; telurímetro 399.644,00 / 2; multímetro 47.564,00 / 6; pinza pelacables 17.037,00 / 10; cinta pasacable 8.019,90 / 8; buscapolo 2.740,00 / 6.

### 🟡 Fase 4 (👤🤖) — Prueba con un proyecto real de Sandy y ajustes.
- [x] 🤖 Botón **"Cargar ejemplo (TP N° 1)"** (`src/lib/installationExampleTp1.json`): departamento de 37,94 m² (grado Mínimo), Icc 3.250 A, ID 6 kA, y el presupuesto del caso 2 (cantidades del plano, precios de las dos casas, herramientas, tareas, valor hora). Da 2.935.510,94 / 3.288.985,98: **difiere de la memoria (2.938.731,50 / 3.292.870,08) solo por las 2 llaves de combinación y la térmica de 25 A de la seccional**, que el cómputo automático no incluye (se agregan a mano si se quiere igualar).
- [ ] 👤 Sandy prueba logueado como electricista: guardar/abrir/duplicar en la cuenta, presupuesto, nota en PDF, pasar a presupuesto una orden real, celular.
- [ ] 🤖 Ajustes según lo que encuentre Sandy.

---

## Decisiones de diseño ya tomadas (23/11/2026, no volver a preguntar a Sandy)
Estamos construyendo un **modelo** (una herramienta), no un proyecto: los datos propios de cada proyecto (Icc, poder de corte y clase de cada térmica, tipo del ID) los **carga el técnico**; a Sandy no se le piden.
1. **Poder de corte, clase y curva de cada protección:** el técnico las **elige de una lista** mirando la ficha del fabricante. Si no las carga, la herramienta usa por defecto **poder de corte = menor normalizado ≥ Icc, clase 3, curva C** y lo muestra con el aviso "valor supuesto, confirmar con el fabricante". El valor por defecto de clase vive en `DEFAULT_RULES` y Sandy lo puede cambiar después desde la configuración.
2. **I²t:** el técnico puede cargar el valor **garantizado por el fabricante** (`i2tOverride`); si lo hace, la herramienta lo usa en lugar de la tabla. Si no, usa las Tablas 770-B.VIII / 770-B.IX según In, poder de corte, clase y curva. Clase 1 ("sin límite especificado") sin dato del fabricante: la verificación queda **"sin dato"**, no "verifica".
3. **Diferencial (ID):** el técnico carga su capacidad de cortocircuito garantizada (`rcdShortCircuitA`). Si es **menor que la Icc**, la herramienta marca "NO VERIFICA" y avisa que hay que elegir un ID con capacidad suficiente o confirmar con el fabricante la protección de respaldo. Sin dato: "confirmar con el fabricante". (En el TP N° 1 se aplicó este criterio: ID de 3 kA no verifica con Icc 3.250 A; ID de 6 kA sí.)
4. **Tipo del ID (A o AC):** el técnico lo elige; por defecto tipo A como en el ejemplo de clase. Queda una consulta suelta con el profesor, que **no bloquea** el desarrollo.
5. **Sin Icc cargada:** las verificaciones de cortocircuito quedan en "sin dato" (no son error), para no romper proyectos sin ese dato.

## Única comprobación pendiente de Sandy (puede esperar)
- (2B, al cargar los valores) Confirmar con el libro impreso de la **Ed. 2026** que las Tablas 770.15.II, 770-B.VIII y 770-B.IX tienen los mismos valores que la Guía 2017. El agente deja los valores cargados con la cita de la Guía 2017 y la marca "a confirmar con Ed. 2026".

## Decisiones abiertas de la Fase 3B (preguntar a Sandy cuando se llegue a esa fase)
1. ¿La comisión de la plataforma (17 % sin IVA sobre el trabajo, ver `plan-cobro-repartido.md`) se muestra en la nota del presupuesto de obra o queda interna?
2. Garantía: ¿una obra completa tiene la misma garantía de 30 días que un servicio común?
3. ¿Valor hora de referencia UOCRA o uno propio de TecniUrbano?

## Bitácora
| Fecha | Qué se hizo |
|---|---|
| 13/11/2026 | Plan escrito a partir de los apuntes de clase de Sandy (pasos 1 a 5 del ejemplo, paso 6 empezado). Decisiones: módulo opcional, solo electricistas, valores técnicos configurables por Sandy, sin reproducir el texto de la norma. |
| 16/11/2026 | **Fase 1 hecha** (`85d2e38`): motor `src/lib/installationProject.ts` con reglas de la AEA (tablas 770.7.I, 770.8.I–III, 770.9.I–II, 770.13.I, 770.16.I, 770.19.IV) y el ejemplo de clase como test. **Fase 2 (primera versión) hecha:** pantalla `InstallationProjectView` en `/technician/proyecto-instalacion`, entrada en Ajustes solo para Electricidad (`isElectrician`), proponer circuitos mínimos, memoria de cálculo imprimible; guarda en el dispositivo (localStorage). Pendiente de Fase 2: guardar en la cuenta (tabla + migración) y adjuntar el plano. Para consultar con el profesor: el criterio "DPMS < 3,7 kVA" no está en la Ed. 2026 (grado solo por superficie) y la Tabla 770.9.I usa 2/3 (no 0,66). |
| 16/11/2026 | Metodología completa: pasos 6 (canalizaciones), 7 (caída de tensión, con recálculo de sección), 8 (exigencia térmica), 9 (unifilar), plano del ejemplo y entregables del TP N° 1. Fase 0 casi cerrada: faltan las 3 dudas. |
| 21/11/2026 | Caída propia de cada circuito terminal ≤ 2 % Un (`ca2e086`). cos φ 0,85 también en ACU (`c8da54a`). |
| 23/11/2026 | **Fase 2B hecha:** el motor pide la Icc y verifica el poder de corte de cada ITM y del diferencial (8 A); el I²t sale de las Tablas 770-B.VIII/IX según In, poder de corte, clase y curva (o del fabricante si el técnico lo carga); si no verifica la exigencia térmica sube la sección (`sectionIncreasedForThermal`); la seccional también se verifica; sin dato = "sin dato"; supuestos avisados en `assumptions`. El caso del TP N° 1 pasa como test (IUG 1,5 → 2,5 mm² con 4,5 kA; seccional 211.600 ≥ 39.000; ID de 3 kA no verifica, de 6 kA sí). Pantalla: sección "3. Cortocircuito" (Icc, ID), campos de poder de corte / clase / curva / I²t por protección, columnas 8 A y 8 B en la memoria. 37 tests del módulo y 508 en total en verde, `tsc` limpio. Sin verificación visual en el navegador (requiere iniciar sesión como electricista). |
| 23/11/2026 | Decisiones de diseño de la Fase 2B fijadas (el técnico carga poder de corte, clase, I²t del fabricante y datos del ID; valores por defecto avisados; sin Icc = "sin dato"). Plan ampliado con lo aprendido en el TP N° 1: Fase 2B (Icc, poder de corte, I²t por tabla, subir sección por exigencia térmica, seccional en el 8 B), Fase 2C (guardar en la cuenta), Fase 3B (presupuesto formal de obra con oráculo numérico) y sección "para el agente que retome". |
| 23/11/2026 | Fase 2C en código: migración `installation_projects` (aplicada el 24/11), módulo de guardado, panel para guardar/abrir/duplicar/eliminar, 5 tests nuevos (513 en total). Queda opcional: adjuntar plano. |
