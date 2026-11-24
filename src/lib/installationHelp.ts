/**
 * Ayuda guiada del "Proyecto de instalación" (solo para técnicos electricistas).
 * Son textos fijos: no usan IA ni se conectan a nada, así que no pueden inventar normas ni cuestan nada.
 * Se muestran desde la cabecita del asistente, únicamente en la pantalla del proyecto (ver HelpHub).
 */

export type InstallationHelpTopic = { id: string; title: string; steps: string[] };

/** Ruta de la pantalla del proyecto: la ayuda solo se ofrece ahí. */
export const INSTALLATION_PROJECT_PATH = '/technician/proyecto-instalacion';

export const INSTALLATION_HELP_TOPICS: InstallationHelpTopic[] = [
  {
    id: 'inicio',
    title: '¿Por dónde empiezo?',
    steps: [
      'Arriba está el "Recorrido del trabajo": los 15 pasos de la guía. Los ✓ se van tildando solos a medida que cargás datos; ○ es pendiente y ⚠ es que hay un problema o un aviso.',
      'Vos solo cargás datos en 4 secciones: 1 Ambientes, 2 Circuitos y línea seccional, 3 Cortocircuito y 4 Ubicación del tablero. El resto lo calcula la app.',
      'Si querés ver cómo funciona antes de cargar algo propio, tocá "Cargar ejemplo (TP N° 1)": carga un proyecto completo.',
      'Todo se guarda solo en este dispositivo. Para tenerlo en tu cuenta, usá "Guardar en mi cuenta".',
    ],
  },
  {
    id: 'ambientes',
    title: 'Sección 1 — Ambientes',
    steps: [
      'Agregá un renglón por cada ambiente de la vivienda: nombre, tipo y superficie en m².',
      'Con las superficies la app calcula la SLA (superficie límite de aplicación) y el grado de electrificación (Mínimo, Medio, Elevado o Superior).',
      'El grado define cuántos circuitos y cuántas bocas como mínimo hay que poner. Se ve en la línea de resumen debajo de los ambientes.',
    ],
  },
  {
    id: 'circuitos',
    title: 'Sección 2 — Circuitos y línea seccional',
    steps: [
      'Tocá "Proponer circuitos mínimos": la app arma los circuitos que pide el grado (por ejemplo, IUG de iluminación y TUG de tomas) con la cantidad mínima de bocas.',
      'También podés usar "Agregar circuito" y cargarlos a mano. Por cada circuito: tipo, cantidad de bocas y largo en metros medido en el plano.',
      'Para IUG y TUG la potencia no se usa: se calcula con las bocas. Para circuitos de carga única (ACU, TUE) sí cargá la potencia en W.',
      'Las columnas "ITM A" y "Sección mm²" dicen "auto": las calcula la app. Solo completalas si querés forzar un valor.',
      'Abajo va la línea seccional: el largo en metros desde el medidor hasta el tablero.',
      'Los avisos "Faltan bocas…" o "El grado pide al menos 1 circuito…" desaparecen cuando llegás a los mínimos.',
    ],
  },
  {
    id: 'cortocircuito',
    title: 'Sección 3 — Cortocircuito (Icc)',
    steps: [
      'La Icc (corriente de cortocircuito) la informa la distribuidora para el punto de conexión. Cargala en amperes en "Icc del suministro".',
      'Con ese dato la app verifica que cada protección pueda cortar esa corriente. Sin Icc, esa verificación queda en "sin dato" y el paso 8 no se tilda.',
      'El diferencial es opcional: si tenés la ficha, cargá su capacidad de cortocircuito; si no, dejalo vacío.',
    ],
  },
  {
    id: 'tablero',
    title: 'Sección 4 — Ubicación del tablero',
    steps: [
      'La app no puede medir el lugar: lo confirmás vos con el plano o en la obra.',
      'Marcá "Es accesible" y "No está cubierto ni oculto" (por ejemplo, que no quede detrás del giro de una puerta).',
      'En "Espacio libre al frente" poné los metros que hay delante del tablero. Se recomienda 0,90 m.',
      'Con las dos casillas marcadas pasa a ✓ el paso 9. Si algo no se cumple, la memoria te avisa que hay que mover el tablero.',
    ],
  },
  {
    id: 'memoria',
    title: 'Cómo leer la memoria de cálculo',
    steps: [
      'Aparece abajo cuando ya hay circuitos. Muestra, paso por paso, la demanda, la protección y la sección de cable de cada línea, los caños, la caída de tensión y el cortocircuito.',
      'Los textos en rojo son avisos: dicen qué falta o qué no cumple. Tocá el paso 10 del recorrido para ir directo.',
      'El botón "Imprimir / PDF" arma la memoria para entregar.',
      'El cálculo es orientativo: el técnico matriculado verifica los resultados y es responsable del proyecto.',
    ],
  },
  {
    id: 'presupuesto',
    title: 'El presupuesto (pasos 11 a 15)',
    steps: [
      '1 Materiales: la app sugiere las cantidades según los circuitos. Poné el precio de cada uno. Para cargar muchos juntos, usá "pegar precios" con la lista de la casa de electricidad.',
      'Si la casa vende el cable en rollos cerrados, usá el campo "total por rollos" en vez de cantidad por precio.',
      '2 Insumos y 3 Herramientas: cargá los insumos y las herramientas que usás; de las herramientas se calcula el desgaste por obra.',
      '4 Mano de obra: agregá las tareas con sus horas y poné el valor de la hora del oficial (y del ayudante si lo usás).',
      '5 Porcentajes y 6 Precio: ajustan cargas, gastos generales y ganancia, y muestran el total final.',
      '7 Nota para el cliente: escribí el nombre del cliente y abrí la nota para imprimir o guardar en PDF.',
      'Esta obra se acuerda y se cobra directamente con el cliente, fuera de la plataforma.',
    ],
  },
];
