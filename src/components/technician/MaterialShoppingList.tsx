import React, { useState } from 'react';
import { Package, Plus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ServiceOrder } from '../../types';

export const MATERIAL_SHOPPING_UNITS = [
  'unidades',
  'metros',
  'metros cuadrados',
  'kilogramos',
  'litros',
  'docena',
  'caja',
  'rollo',
  'par',
];

type Props = { order: ServiceOrder };

export const MaterialShoppingList: React.FC<Props> = ({ order }) => {
  const { addMaterialExpense, removeMaterialExpense } = useApp();
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState(MATERIAL_SHOPPING_UNITS[0]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const canEdit = order.status !== 'completed' && order.status !== 'cancelled';

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!description.trim()) return;
    const ok = addMaterialExpense(order.id, {
      description,
      unit,
      quantity,
      unitPrice: 0,
      notes,
    });
    if (ok) {
      setDescription('');
      setQuantity(1);
      setNotes('');
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-xs">
      <div className="flex items-start gap-2">
        <Package className="mt-0.5 h-4 w-4 text-teal-700 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Lista para que el cliente compre</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Anotá lo que hace falta para terminar el trabajo. El cliente lo lleva a la ferretería. No se cobra acá ni lo pagás vos.
          </p>
        </div>
      </div>

      {canEdit && (
        <form onSubmit={handleSubmit} className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">Material</label>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ej: Visagras 3 pulgadas"
                className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">Unidad</label>
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-teal-500 font-medium"
              >
                {MATERIAL_SHOPPING_UNITS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">Cantidad</label>
              <input
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                min={0.01}
                step="any"
                className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-teal-500 font-mono font-bold"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">Nota (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ej: que sean de hierro, no de aluminio"
              className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-md transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar a la lista
            </button>
          </div>
        </form>
      )}

      <div className="space-y-1.5">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
          Para comprar ({order.materialExpenses.length})
        </h4>
        {order.materialExpenses.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Si el cliente ya tiene los materiales, dejá la lista vacía.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-950">
            {order.materialExpenses.map((item) => (
              <div key={item.id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.description}</span>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {item.quantity} {item.unit}
                    {item.notes ? ` · ${item.notes}` : ''}
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeMaterialExpense(order.id, item.id)}
                    className="text-slate-400 hover:text-rose-600 shrink-0"
                    aria-label="Sacar de la lista"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
