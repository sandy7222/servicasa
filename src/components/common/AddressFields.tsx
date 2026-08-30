import React from 'react';
import { ARGENTINA_PROVINCES } from '../../lib/argentina';
import { capitalizeWords } from '../../lib/address';

export type AddressFieldsValue = {
  street: string;
  streetNumber: string;
  neighborhood: string;
  city: string;
  province: string;
};

/** Único punto donde se arma el domicilio de un pedido — usado tanto en
 * ServiceRequestForm.tsx (cliente logueado) como en GuestServiceRequestForm.tsx
 * (invitado), que antes duplicaban byte a byte el mismo bloque de inputs.
 * Ver docs/adr-address-redesign.md, Fase 2. */
export const AddressFields: React.FC<{
  value: AddressFieldsValue;
  onChange: (next: AddressFieldsValue) => void;
  /** false para direcciones guardadas: customer_addresses no tiene columna
   * de provincia (ver docs/adr-address-redesign.md, Fase 3), así que no
   * tiene sentido mostrar un selector que no se va a guardar. */
  showProvince?: boolean;
}> = ({ value, onChange, showProvince = true }) => {
  const set = (key: keyof AddressFieldsValue, raw: string) => onChange({ ...value, [key]: raw });
  const setCapitalized = (key: keyof AddressFieldsValue, raw: string) => onChange({ ...value, [key]: capitalizeWords(raw) });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <label className="text-xs font-semibold text-slate-700">
          Calle
          <input
            value={value.street}
            onChange={(event) => setCapitalized('street', event.target.value)}
            placeholder="Ej.: Suipacha"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Número
          <input
            value={value.streetNumber}
            onChange={(event) => set('streetNumber', event.target.value)}
            placeholder="Ej.: 547"
            inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className={showProvince ? 'grid sm:grid-cols-2 gap-2' : 'grid gap-2'}>
        <label className="text-xs font-semibold text-slate-700">
          Localidad
          <input
            value={value.city}
            onChange={(event) => setCapitalized('city', event.target.value)}
            placeholder="Ej.: Burzaco"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        {showProvince && (
          <label className="text-xs font-semibold text-slate-700">
            Provincia
            <select
              value={value.province}
              onChange={(event) => set('province', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>Elegí tu provincia</option>
              {ARGENTINA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="block text-xs font-semibold text-slate-700">
        Barrio <span className="font-normal text-slate-400">(opcional, ej. en CABA)</span>
        <input
          value={value.neighborhood}
          onChange={(event) => setCapitalized('neighborhood', event.target.value)}
          placeholder="Ej.: Palermo"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
};
