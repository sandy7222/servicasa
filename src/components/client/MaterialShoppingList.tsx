import React from 'react';
import { Package } from 'lucide-react';
import type { ServiceOrder } from '../../types';

export const ClientMaterialShoppingList: React.FC<{ order: ServiceOrder }> = ({ order }) => (
  <section className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-1.5">
        <Package className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
          Lista para la ferretería
        </h3>
      </div>
      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
        {order.materialExpenses.length} ítems
      </span>
    </div>
    <p className="text-[11px] text-slate-500 dark:text-slate-400">
      El técnico anotó lo que hace falta para terminar el trabajo. Llevá esta lista a comprar; no se suma al presupuesto.
    </p>
    <div className="space-y-1.5">
      {order.materialExpenses.map((item) => (
        <div
          key={item.id}
          className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
        >
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">{item.description}</span>
            {item.notes && <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.notes}</div>}
          </div>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0 text-[11px] border border-slate-200 dark:border-slate-700">
            {item.quantity} {item.unit}
          </span>
        </div>
      ))}
    </div>
  </section>
);
