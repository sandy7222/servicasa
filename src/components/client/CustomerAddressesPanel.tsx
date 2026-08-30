import React, { useState } from 'react';
import { MapPin, Plus, Star, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCustomerAddresses } from '../../lib/useCustomerAddresses';
import { validateAddressDraft, splitAddressLine } from '../../lib/address';
import { AddressFields, type AddressFieldsValue } from '../common/AddressFields';

const BLANK_DRAFT: AddressFieldsValue = { street: '', streetNumber: '', neighborhood: '', city: '', province: '' };

/** "Mis direcciones" en el perfil del cliente — resuelve el reclamo original
 * de que no podía actualizar su domicilio desde su cuenta. Reusa el mismo
 * hook (useCustomerAddresses) y componente (AddressFields) que
 * ServiceRequestForm.tsx, sin provincia (customer_addresses no la guarda —
 * ver docs/adr-address-redesign.md, Fase 3). */
export const CustomerAddressesPanel: React.FC = () => {
  const { currentUser, showToast } = useApp();
  const { addresses, createAddress, updateAddress, deleteAddress, setDefaultAddress } = useCustomerAddresses(currentUser?.customerId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [addressDraft, setAddressDraft] = useState<AddressFieldsValue>(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  if (!currentUser?.customerId) return null;

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setLabelDraft('');
    setAddressDraft(BLANK_DRAFT);
  };

  const startEdit = (id: string) => {
    const address = addresses.find((a) => a.id === id);
    if (!address) return;
    const { street, streetNumber } = splitAddressLine(address.addressLine);
    setCreating(false);
    setEditingId(id);
    setLabelDraft(address.label ?? '');
    setAddressDraft({ street, streetNumber, neighborhood: address.neighborhood ?? '', city: address.city, province: '' });
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
  };

  const save = async () => {
    const error = validateAddressDraft(addressDraft, false);
    if (error) {
      showToast(error, 'warning');
      return;
    }
    setSaving(true);
    const input = {
      label: labelDraft.trim() || null,
      addressLine: `${addressDraft.street.trim()} ${addressDraft.streetNumber.trim()}`.trim(),
      neighborhood: addressDraft.neighborhood.trim(),
      city: addressDraft.city.trim(),
    };
    const ok = editingId ? await updateAddress(editingId, input) : Boolean(await createAddress(input, false));
    setSaving(false);
    if (!ok) {
      showToast('No se pudo guardar la dirección.', 'error');
      return;
    }
    showToast('Dirección guardada.', 'success');
    cancel();
  };

  const remove = async (id: string) => {
    const ok = await deleteAddress(id);
    setPendingDelete(null);
    if (!ok) {
      showToast('No se pudo eliminar la dirección.', 'error');
      return;
    }
    showToast('Dirección eliminada.', 'success');
  };

  const makeDefault = async (id: string) => {
    const ok = await setDefaultAddress(id);
    if (!ok) showToast('No se pudo actualizar la dirección predeterminada.', 'error');
  };

  const editorOpen = creating || editingId !== null;

  return (
    <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-teal-600" />
          <div>
            <h3 className="text-sm font-bold">Mis direcciones</h3>
            <p className="text-[11px] text-slate-500">Se editan acá — no afecta a pedidos ya creados.</p>
          </div>
        </div>
        {!editorOpen && (
          <button type="button" onClick={startCreate} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white">
            <Plus className="w-3.5 h-3.5" />Agregar
          </button>
        )}
      </div>

      {!editorOpen && addresses.length === 0 && (
        <p className="text-xs text-slate-500">Todavía no guardaste ninguna dirección.</p>
      )}

      {!editorOpen && addresses.length > 0 && (
        <div className="space-y-2">
          {addresses.map((address) => (
            <div key={address.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {address.label && <span className="text-xs font-bold text-slate-800">{address.label}</span>}
                  {address.isDefault && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 border border-teal-200">
                      <Star className="w-2.5 h-2.5" />Predeterminada
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 truncate">
                  {[address.addressLine, address.neighborhood, address.city].filter(Boolean).join(', ')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!address.isDefault && (
                  <button type="button" onClick={() => void makeDefault(address.id)} className="text-[11px] font-bold text-teal-700 hover:underline">
                    Predeterminar
                  </button>
                )}
                <button type="button" onClick={() => startEdit(address.id)} className="text-[11px] font-bold text-slate-600 hover:underline">
                  Editar
                </button>
                <button type="button" onClick={() => setPendingDelete(address.id)} className="p-1 rounded text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50/40 p-3">
          <label className="block text-xs font-semibold text-slate-700">
            Nombre (opcional)
            <input value={labelDraft} onChange={(event) => setLabelDraft(event.target.value)} placeholder="Ej.: Casa, Trabajo" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <AddressFields value={addressDraft} onChange={setAddressDraft} showProvince={false} />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={cancel} className="px-3 py-2 text-xs font-semibold text-slate-600">Cancelar</button>
            <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar dirección'}
            </button>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60" onClick={() => setPendingDelete(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-900">Eliminar dirección</h3>
            <p className="text-xs text-slate-600 mt-1">Los pedidos que ya usaron esta dirección no se ven afectados.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setPendingDelete(null)} className="px-3 py-2 text-xs font-semibold text-slate-600">Cancelar</button>
              <button type="button" onClick={() => void remove(pendingDelete)} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
