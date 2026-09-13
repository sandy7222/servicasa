import type { Technician } from '../types';

function formatDateEs(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

export type TechnicianContractParams = {
  technician: Technician;
  commissionRate: number;
  platformLegalName: string;
  platformLegalCuit: string;
};

/**
 * Contrato de Prestación de Servicios Independientes entre TecniUrbano
 * ("LA PLATAFORMA") y un técnico ("EL PRESTADOR") — módulo Contratos del
 * Hub de Admin (charla con Sandy, 13/9). Formaliza en un documento
 * firmable lo mismo que ya dice src/lib/legalTerms.ts
 * (TERMS_TECNICO_TEXT): vínculo comercial independiente, sin
 * exclusividad, facturación directa al cliente, comisión de la
 * Plataforma — no lo reemplaza, lo complementa como papel firmable.
 *
 * IMPORTANTE: este texto es un borrador técnico, no una redacción
 * validada por un abogado — mismo criterio que legalTerms.ts. Antes de
 * usarlo para firmar de verdad conviene que lo revise un abogado. Ver
 * plan-contrato-tecnico.md.
 *
 * Cualquier dato que falte (DNI, CUIT, domicilio, datos de la Plataforma)
 * se deja como placeholder entre corchetes en vez de dejar el contrato a
 * medio completar en silencio — así se nota de un vistazo qué falta cargar
 * antes de imprimir la versión final.
 */
export function buildTechnicianContractText(params: TechnicianContractParams): string {
  const { technician, commissionRate, platformLegalName, platformLegalCuit } = params;
  const today = formatDateEs(new Date());
  const platformName = platformLegalName.trim() || '[Completar razón social de la Plataforma]';
  const platformCuit = platformLegalCuit.trim() || '[Completar CUIT de la Plataforma]';
  const dni = technician.dni?.trim() || '[Completar DNI]';
  const cuit = technician.cuit?.trim() || '[Completar CUIT / monotributo]';
  const domicilio = technician.address?.trim() || technician.zone?.trim() || '[Completar domicilio]';
  const rubro = technician.specialty?.trim() || '[Completar rubro]';
  const commission = formatPercent(commissionRate);

  return `En la Ciudad Autónoma de Buenos Aires, a ${today}, entre ${platformName}, CUIT ${platformCuit}, en su carácter de operador de la plataforma tecnológica TecniUrbano (en adelante, "LA PLATAFORMA"), por una parte, y ${technician.name}, DNI ${dni}, CUIT/monotributo ${cuit}, con domicilio en ${domicilio} (en adelante, "EL PRESTADOR"), por la otra, acuerdan celebrar el presente Contrato de Prestación de Servicios Independientes, sujeto a las siguientes cláusulas:

PRIMERA — Objeto. EL PRESTADOR prestará, de forma independiente y con sus propios medios, servicios de reparación, mantenimiento o instalación en el rubro de ${rubro} a los clientes que contraten a través de LA PLATAFORMA, en los términos y condiciones publicados en www.tecniurbano.online/terminos_y_condiciones/tecnico, que EL PRESTADOR declara conocer y aceptar, y que forman parte integrante de este contrato.

SEGUNDA — Naturaleza del vínculo. Las partes dejan expresamente establecido que el presente contrato es de naturaleza comercial y no genera relación de dependencia laboral entre LA PLATAFORMA y EL PRESTADOR, en los términos del art. 23 y concordantes de la Ley de Contrato de Trabajo. EL PRESTADOR presta sus servicios con plena autonomía técnica y organizativa, puede aceptar o rechazar los pedidos que se le ofrezcan, no está sujeto a un horario impuesto por LA PLATAFORMA, no recibe instrucciones sobre el modo de ejecutar su trabajo más allá de las condiciones generales del servicio, y puede prestar servicios similares a terceros o por cuenta propia, sin exclusividad hacia LA PLATAFORMA.

TERCERA — Inscripción fiscal y facturación. EL PRESTADOR declara mantener una inscripción fiscal vigente (monotributo o responsable inscripto) y se obliga a emitir el comprobante fiscal correspondiente a cada trabajo directamente al cliente que lo recibió, por el valor total del servicio prestado. La pérdida de esa inscripción fiscal es causal de suspensión de la cuenta en LA PLATAFORMA.

CUARTA — Comisión. LA PLATAFORMA percibirá, en concepto de intermediación tecnológica, una comisión del ${commission} sobre el valor de cada trabajo, que se descontará al momento de liquidar a EL PRESTADOR y por la cual LA PLATAFORMA emitirá el comprobante correspondiente. Esta comisión podrá actualizarse; los cambios se comunicarán a través de la Plataforma con razonable anticipación.

QUINTA — Duración y rescisión. El presente contrato rige desde su firma por tiempo indeterminado, y cualquiera de las partes puede rescindirlo en cualquier momento, sin necesidad de invocar causa, dando aviso a la otra por los medios de contacto declarados. LA PLATAFORMA podrá además suspender o dar de baja la cuenta de EL PRESTADOR ante incumplimientos graves de las condiciones del servicio, reclamos fundados y reiterados de clientes, o irregularidades en su situación fiscal.

SEXTA — Jurisdicción. Para cualquier controversia derivada de este contrato, las partes se someten a los tribunales ordinarios competentes de la Ciudad Autónoma de Buenos Aires, con renuncia a cualquier otro fuero o jurisdicción.

En prueba de conformidad, se firma un ejemplar de este contrato en el lugar y fecha indicados.`;
}
