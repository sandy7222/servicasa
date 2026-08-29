import React, { useEffect, useMemo, useState } from 'react';
import { FileCheck2, Minus, Plus, Send, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatArs } from '../../lib/pricing';
import { getCategoriesByRubro, getRubros, getTarifarioByRubroName, type CatalogCategory, type ServiceRubro, type TarifarioItem } from '../../lib/catalog';
import { groupItemsBySubcategory } from '../../lib/catalogOrder';
import { SubcategorySectionHeader } from '../common/SubcategorySectionHeader';
import { supabase } from '../../lib/supabase';
import type { OrderQuote, ServiceOrder } from '../../types';

type Props = { order: ServiceOrder };

const slugForServiceType = (serviceType: string) => {
  const value = serviceType.toLowerCase().replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u');
  if (value.includes('instalacion') || value.includes('refriger')) return 'refrigeracion';
  if (value.includes('electric')) return 'electricidad';
  if (value.includes('cerrajer')) return 'cerrajeria';
  if (value.includes('soldadur')) return 'soldadura';
  return '';
};

export const QuoteBuilder: React.FC<Props> = ({ order }) => {
  const { currentUser, materials, catalogSubcategories, refreshRemoteData, showToast } = useApp();
  const quote = order.quotes?.[0] as OrderQuote | undefined;
  const [rubros, setRubros] = useState<ServiceRubro[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [tarifario, setTarifario] = useState<TarifarioItem[]>([]);
  const [tarifarioSearch, setTarifarioSearch] = useState('');
  const [rubroId, setRubroId] = useState('');
  const [notes, setNotes] = useState(quote?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingTarifario, setLoadingTarifario] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState(materials[0]?.id ?? '');
  const [materialQty, setMaterialQty] = useState(1);

  const canDiagnose = order.workMode === 'diagnosis' && order.paymentStatus === 'deposit_paid';
  const isDraft = !quote || quote.status === 'draft';
  const totals = useMemo(() => ({
    total: quote?.totalAmount ?? 0,
    labor: quote?.subtotalLabor ?? 0,
    materials: quote?.subtotalMaterials ?? 0,
    deposit: quote?.visitDepositCredit ?? order.visitDepositAmount ?? 0,
    remaining: quote?.remainingAmount ?? 0,
  }), [order.visitDepositAmount, quote]);

  useEffect(() => {
    void (async () => {
      try {
        const available = await getRubros();
        setRubros(available);
        const suggested = available.find((rubro) => rubro.slug === slugForServiceType(order.serviceType));
        setRubroId(suggested?.id ?? available[0]?.id ?? '');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'No se pudo cargar el catálogo.', 'error');
      } finally { setLoadingCatalog(false); }
    })();
  }, [order.serviceType, showToast]);

  useEffect(() => {
    if (!rubroId) { setCategories([]); return; }
    void (async () => {
      try { setCategories(await getCategoriesByRubro(rubroId)); }
      catch (error) { showToast(error instanceof Error ? error.message : 'No se pudieron cargar los servicios.', 'error'); }
    })();
  }, [rubroId, showToast]);

  useEffect(() => {
    const rubro = rubros.find((r) => r.id === rubroId);
    if (!rubro) { setTarifario([]); return; }
    void (async () => {
      setLoadingTarifario(true);
      try { setTarifario(await getTarifarioByRubroName(rubro.name)); }
      catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo cargar el tarifario.', 'error'); }
      finally { setLoadingTarifario(false); }
    })();
  }, [rubroId, rubros, showToast]);

  const filteredTarifario = useMemo(() => {
    const query = tarifarioSearch.trim().toLowerCase();
    if (!query) return tarifario;
    return tarifario.filter((item) => item.name.toLowerCase().includes(query));
  }, [tarifario, tarifarioSearch]);

  const tarifarioGroups = useMemo(
    () => groupItemsBySubcategory<TarifarioItem>(filteredTarifario, catalogSubcategories, { includeInactive: true }),
    [filteredTarifario, catalogSubcategories]
  );

  const ensureDraft = async (): Promise<string> => {
    if (quote) return quote.id;
    const { data, error } = await supabase.from('order_quotes').insert({
      order_id: order.id, version: 1, status: 'draft', notes: notes.trim() || null,
      visit_deposit_credit: order.visitDepositAmount ?? 0,
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: currentUser?.id ?? null,
    }).select('id').single();
    if (error || !data) throw new Error(error?.message || 'No se pudo crear el borrador.');
    return data.id as string;
  };

  const addCategory = async (category: CatalogCategory) => {
    if (!isDraft) return;
    setBusy(true);
    try {
      const existing = quote?.items.find((item) => item.categoryId === category.id);
      if (existing) {
        const { error } = await supabase.from('order_quote_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const quoteId = await ensureDraft();
        const { error } = await supabase.from('order_quote_items').insert({
          quote_id: quoteId, category_id: category.id, item_type: 'labor', description: category.name,
          quantity: 1, unit: category.unit, unit_price: category.basePrice, sort_order: quote?.items.length ?? 0,
        });
        if (error) throw error;
      }
      await refreshRemoteData();
    } catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo agregar el servicio.', 'error'); }
    finally { setBusy(false); }
  };

  const addTarifarioItem = async (item: TarifarioItem) => {
    if (!isDraft) return;
    setBusy(true);
    try {
      const existing = quote?.items.find((qi) => qi.serviceId === item.id);
      if (existing) {
        const { error } = await supabase.from('order_quote_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const quoteId = await ensureDraft();
        const { error } = await supabase.from('order_quote_items').insert({
          quote_id: quoteId, service_id: item.id, item_type: 'labor', description: item.name,
          quantity: 1, unit: 'unidad', unit_price: item.price, sort_order: quote?.items.length ?? 0,
        });
        if (error) throw error;
      }
      await refreshRemoteData();
    } catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo agregar el servicio.', 'error'); }
    finally { setBusy(false); }
  };

  const addMaterial = async () => {
    if (!isDraft) return;
    const material = materials.find((m) => m.id === selectedMaterialId);
    if (!material) return showToast('Elegí un repuesto del inventario.', 'warning');
    if (materialQty <= 0) return showToast('La cantidad debe ser mayor a cero.', 'warning');
    setBusy(true);
    try {
      const existing = quote?.items.find((item) => item.itemType === 'material' && item.description === material.name);
      if (existing) {
        const { error } = await supabase.from('order_quote_items').update({ quantity: existing.quantity + materialQty }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const quoteId = await ensureDraft();
        const { error } = await supabase.from('order_quote_items').insert({
          quote_id: quoteId, item_type: 'material', description: material.name,
          quantity: materialQty, unit: material.unit, unit_price: material.costEstimate, sort_order: quote?.items.length ?? 0,
        });
        if (error) throw error;
      }
      await refreshRemoteData();
      setMaterialQty(1);
    } catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo agregar el repuesto.', 'error'); }
    finally { setBusy(false); }
  };

  const updateItem = async (itemId: string, values: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { error } = await supabase.from('order_quote_items').update(values).eq('id', itemId);
      if (error) throw error;
      await refreshRemoteData();
    } catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo actualizar el ítem.', 'error'); }
    finally { setBusy(false); }
  };

  const deleteItem = async (itemId: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from('order_quote_items').delete().eq('id', itemId);
      if (error) throw error;
      await refreshRemoteData();
    } catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo quitar el ítem.', 'error'); }
    finally { setBusy(false); }
  };

  const saveNotes = async () => {
    if (!quote) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('order_quotes').update({ notes: notes.trim() || null }).eq('id', quote.id);
      if (error) throw error;
      await refreshRemoteData();
      showToast('Borrador actualizado.', 'success');
    } catch (error) { showToast(error instanceof Error ? error.message : 'No se pudieron guardar los hallazgos.', 'error'); }
    finally { setBusy(false); }
  };

  const sendQuote = async () => {
    if (!quote || quote.items.length === 0) { showToast('Agregá al menos un servicio del catálogo antes de enviar.', 'warning'); return; }
    if (!window.confirm('Al enviarlo, las categorías, cantidades y precios quedarán congelados. ¿Continuar?')) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('order_quotes').update({ status: 'sent', notes: notes.trim() || null, sent_at: new Date().toISOString() }).eq('id', quote.id);
      if (error) throw error;
      await refreshRemoteData();
      showToast('Presupuesto enviado al cliente. Ya no puede modificarse.', 'success');
    } catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo enviar el presupuesto.', 'error'); }
    finally { setBusy(false); }
  };

  if (order.workMode !== 'diagnosis') return null;
  if (!canDiagnose) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><strong>Esperando la seña de visita.</strong> El diagnóstico se habilita cuando el pago sea confirmado por Mercado Pago.</div>;

  return <section className="space-y-3">
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"><div className="flex items-start gap-2"><FileCheck2 className="mt-0.5 h-4 w-4 text-teal-700" /><div><h3 className="text-sm font-bold text-slate-900">Diagnóstico y presupuesto</h3><p className="text-[11px] text-slate-500">Elegí servicios del catálogo publicado. El sistema fija el precio antes de guardar.</p></div></div></div>
    {!isDraft ? <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-xs text-teal-900"><strong>Presupuesto enviado.</strong> El cliente ya puede revisarlo desde su portal. No podés cambiarlo.</div> : <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"><div className="flex items-center justify-between gap-2"><h4 className="text-xs font-bold text-slate-800">Servicios publicados</h4><select value={rubroId} onChange={(event) => setRubroId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">{rubros.map((rubro) => <option key={rubro.id} value={rubro.id}>{rubro.icon} {rubro.name}</option>)}</select></div>{loadingCatalog ? <p className="text-xs text-slate-500">Cargando catálogo…</p> : <div className="grid gap-2 sm:grid-cols-2">{categories.map((category) => { const selected = quote?.items.find((item) => item.categoryId === category.id); return <button key={category.id} type="button" disabled={busy} onClick={() => void addCategory(category)} className={`rounded-lg border p-3 text-left transition disabled:opacity-60 ${selected ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300'}`}><span className="block text-xs font-bold text-slate-900">{category.name}</span><span className="mt-1 block text-[10px] text-slate-500">{category.description}</span><span className="mt-2 block text-xs font-black text-teal-800">{formatArs(category.basePrice)} por {category.unit}</span>{selected && <span className="mt-1 block text-[10px] font-bold text-teal-700">Agregado: {selected.quantity} {selected.unit}</span>}</button>; })}</div>}</div>

      {(loadingTarifario || tarifario.length > 0) && <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-bold text-slate-800">Tarifario completo ({tarifario.length} ítems)</h4></div>
        <input value={tarifarioSearch} onChange={(event) => setTarifarioSearch(event.target.value)} placeholder="Buscar por nombre…" className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs" />
        {loadingTarifario ? <p className="text-xs text-slate-500">Cargando tarifario…</p> : <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
          {tarifarioGroups.length === 0 && <p className="text-xs text-slate-500">Sin resultados para "{tarifarioSearch}".</p>}
          {tarifarioGroups.map((group) => <div key={group.id ?? 'sin-subcategoria'}>
            <SubcategorySectionHeader name={group.name} count={group.items.length} ungrouped={!group.id} compact sticky />
            <div className="space-y-1">{group.items.map((item) => { const selected = quote?.items.find((qi) => qi.serviceId === item.id); return <button key={item.id} type="button" disabled={busy} onClick={() => void addTarifarioItem(item)} className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left transition disabled:opacity-60 ${selected ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300'}`}><span className="text-[11px] text-slate-800">{item.name}{selected && <span className="ml-1 font-bold text-teal-700">· x{selected.quantity}</span>}</span><span className="shrink-0 text-[11px] font-black text-teal-800">{formatArs(item.price)}</span></button>; })}</div>
          </div>)}
        </div>}
      </div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"><h4 className="text-xs font-bold text-slate-800">Repuestos a comprar</h4>{materials.length === 0 ? <p className="text-xs text-slate-500">No hay repuestos cargados en el inventario.</p> : <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-[11px] font-semibold text-slate-600">Repuesto<select value={selectedMaterialId} onChange={(event) => setSelectedMaterialId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs">{materials.map((m) => <option key={m.id} value={m.id}>{m.name} · {formatArs(m.costEstimate)}/{m.unit}</option>)}</select></label><label className="w-20 text-[11px] font-semibold text-slate-600">Cantidad<input type="number" min={1} value={materialQty} onChange={(event) => setMaterialQty(Math.max(1, Number(event.target.value) || 1))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label><button type="button" disabled={busy || !isDraft} onClick={() => void addMaterial()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Agregar repuesto</button></div>}</div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"><label className="block text-xs font-bold text-slate-700">Hallazgos y notas para el cliente<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="Explicá el diagnóstico y la solución propuesta." /></label><button type="button" disabled={!quote || busy} onClick={() => void saveNotes()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50">Guardar borrador</button></div>
    </>}
    {quote && <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"><div className="flex justify-between border-b pb-2 text-sm"><strong>Detalle presupuestado</strong><strong>{formatArs(totals.total)}</strong></div>{quote.items.map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-2.5 text-xs"><div className="flex items-start justify-between gap-2"><span><strong>{item.description}</strong>{item.itemType === 'material' && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">Repuesto</span>}<span className="mt-0.5 block text-[10px] text-slate-500">Precio publicado: {formatArs(item.unitPrice)} por {item.unit}</span></span>{isDraft && <button type="button" disabled={busy} onClick={() => void deleteItem(item.id)} aria-label="Eliminar ítem" className="text-rose-600"><Trash2 className="h-4 w-4" /></button>}</div>{isDraft && <div className="mt-2 flex items-center gap-2"><button type="button" disabled={busy || item.quantity <= 1} onClick={() => void updateItem(item.id, { quantity: item.quantity - 1 })} className="rounded border border-slate-300 p-1"><Minus className="h-3 w-3" /></button><span className="min-w-8 text-center font-bold">{item.quantity}</span><button type="button" disabled={busy} onClick={() => void updateItem(item.id, { quantity: item.quantity + 1 })} className="rounded border border-slate-300 p-1"><Plus className="h-3 w-3" /></button><input defaultValue={item.notes ?? ''} onBlur={(event) => { if (event.target.value !== (item.notes ?? '')) void updateItem(item.id, { notes: event.target.value.trim() || null }); }} placeholder="Nota opcional" className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-[11px]" /></div>}{item.notes && !isDraft && <p className="mt-1 text-[10px] text-slate-600">Nota: {item.notes}</p>}<strong className="mt-2 block text-right">{formatArs(item.subtotal)}</strong></div>)}<div className="flex justify-between text-[11px] text-slate-500"><span>Mano de obra: {formatArs(totals.labor)}</span><span>Repuestos: {formatArs(totals.materials)}</span></div><div className="flex justify-between text-xs text-slate-600"><span>Seña acreditada</span><span>-{formatArs(totals.deposit)}</span></div><div className="flex justify-between border-t pt-2 text-sm font-bold text-teal-800"><span>{quote.status === 'accepted' ? 'Saldo' : 'Restante'}</span>{quote.status === 'accepted' ? <span className="text-emerald-700">Pagado</span> : <span>{formatArs(totals.remaining)}</span>}</div></div>}
    {isDraft && quote && <button type="button" disabled={busy} onClick={() => void sendQuote()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />Enviar presupuesto al cliente</button>}
  </section>;
};
