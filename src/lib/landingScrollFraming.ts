// Encuadre de scroll para los anchors de la landing pública. No es un offset
// fijo: cada sección tiene distinta altura y su propio padding interno, así
// que se calcula un punto de scroll a partir del título real (no del borde
// exterior de la sección, que ya trae su propio padding) para lograr un
// margen visual consistente después del header sticky.
const HEADER_ID = 'tecniurbano-landing-header';
const TOP_MARGIN_PX = 60; // dentro del rango de 50-70px pedido

function absoluteTop(el: Element): number {
  return el.getBoundingClientRect().top + window.scrollY;
}

function absoluteBottom(el: Element): number {
  return el.getBoundingClientRect().bottom + window.scrollY;
}

/** El título visible real de la sección — no el borde exterior con su padding. */
function findHeading(container: Element): Element {
  return container.querySelector('h2, h3') ?? container;
}

/**
 * Hace scroll hasta el título de `topId` con un margen deliberado debajo del
 * header. `bottomBoundaryId`, cuando se pasa, es el último elemento que debe
 * quedar completamente visible sin que la sección siguiente asome — se usa
 * solo donde hace falta (por ejemplo "Cómo funciona", cuya banda de
 * confianza sigue conceptualmente parte de esa escena aunque sea otro
 * componente en el DOM). Sin ese parámetro, prioriza el margen de 50-70px
 * pedido tal cual, sin recortar el scroll por lo que venga después.
 */
export function scrollToFramedSection(topId: string, bottomBoundaryId?: string): void {
  const topEl = document.getElementById(topId);
  if (!topEl) return;

  const header = document.getElementById(HEADER_ID);
  const headerHeight = header?.offsetHeight ?? 0;

  const heading = findHeading(topEl);
  const idealTop = absoluteTop(heading) - headerHeight - TOP_MARGIN_PX;

  let target = idealTop;
  if (bottomBoundaryId) {
    const boundaryEl = document.getElementById(bottomBoundaryId);
    if (boundaryEl) {
      const ceiling = absoluteBottom(boundaryEl) - window.innerHeight;
      // Si el contenido de destino es más corto que el viewport disponible,
      // se prefiere reducir el margen superior antes que dejar asomar la
      // sección siguiente — es la prioridad explícita para este anchor.
      target = Math.min(idealTop, ceiling);
    }
  }

  window.scrollTo({ top: target, behavior: 'smooth' });
}
