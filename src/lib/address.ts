/** Title-cases each word (ej. "san isidro" -> "San Isidro") para que lo que
 * el cliente escribe en calle/localidad/barrio quede bien redactado a medida
 * que tipea, ya que todavía no hay autocompletado real de geocoding (fase
 * futura, ver docs/adr-address-redesign.md). Deliberadamente simple: no
 * maneja excepciones de preposiciones en español ("de", "del"). */
export function capitalizeWords(text: string): string {
  return text.replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export type AddressDraft = {
  street: string;
  streetNumber: string;
  city: string;
  province: string;
};

/** Reproduce en el cliente la misma validación que corre en el server
 * (api/orders/request-service.ts, api/orders/guest-checkout.ts) para dar el
 * error apenas se puede, sin depender de ese chequeo — el server nunca
 * confía en que esto corrió. Cubre el caso real de Marcos Abate: escribió la
 * altura ("547") en el campo de localidad y dejó la localidad real vacía. */
export function validateAddressDraft(draft: AddressDraft): string | null {
  if (!draft.street.trim()) return 'Indicá la calle del domicilio de atención.';
  if (!draft.streetNumber.trim()) return 'Indicá la altura (número) del domicilio, o "s/n" si no tiene.';
  if (!draft.province) return 'Elegí la provincia de esta visita.';
  const city = draft.city.trim();
  if (!city) return 'Indicá la localidad de esta visita.';
  if (/^\d+$/.test(city)) {
    return 'La localidad no puede ser un número — revisá que no hayas puesto la altura en ese campo por error.';
  }
  return null;
}
