import { useEffect, useState } from 'react';
import { Plus, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchClaims } from '../../lib/supportCases';
import type { ClaimCase } from '../../types';
import { NewClaimModal } from '../admin/NewClaimModal';
import { ClaimPriorityBadge, ClaimStatusBadge, CLAIM_TYPE_LABELS, formatDate } from '../admin/claimShared';

/**
 * "Mis reclamos" para cliente y técnico — RLS ya deja pasar solo los casos
 * propios (support_cases_select_customer / _technician), así que fetchClaims()
 * no necesita ningún filtro extra acá.
 */
export function MyClaimsPanel({ onOpen }: { onOpen: (claimId: string) => void }) {
  const { currentUser } = useApp();
  const [claims, setClaims] = useState<ClaimCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const isCustomer = currentUser?.role === 'customer';

  const load = async () => {
    setLoading(true);
    try {
      setClaims(await fetchClaims());
    } catch {
      // Silencioso: si todavía no hay casos propios, no hace falta alarmar.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return null;
  if (claims.length === 0 && !isCustomer) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          Reclamos y garantías
        </div>
        {isCustomer && (
          <button
            onClick={() => setIsNewOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-2.5 py-1.5 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />Abrir reclamo
          </button>
        )}
      </div>
      {claims.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No tenés reclamos abiertos.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {claims.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="w-full text-left py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 -mx-1 px-1 rounded"
            >
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{c.subject}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.caseNumber} · {CLAIM_TYPE_LABELS[c.type]} · {formatDate(c.openedAt)}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ClaimPriorityBadge priority={c.priority} />
                <ClaimStatusBadge status={c.status} />
              </div>
            </button>
          ))}
        </div>
      )}
      {isCustomer && (
        <NewClaimModal
          mode="customer"
          isOpen={isNewOpen}
          onClose={() => setIsNewOpen(false)}
          onCreated={() => { setIsNewOpen(false); void load(); }}
        />
      )}
    </div>
  );
}
