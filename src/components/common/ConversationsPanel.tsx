import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchConversations } from '../../lib/conversations';
import type { Conversation } from '../../types';

const formatDate = (value: string) => new Date(value).toLocaleDateString('es-AR');

/**
 * Bandeja de conversaciones — RLS ya deja pasar solo lo que corresponde
 * (admin ve todas, cliente/técnico solo las propias), así que no hace falta
 * ningún filtro extra acá. `title` y `emptyLabel` permiten reusar el mismo
 * componente en el admin (bandeja general) y en cliente/técnico ("mis
 * conversaciones").
 */
export function ConversationsPanel({
  onOpen,
  title = 'Conversaciones',
  emptyLabel = 'No hay conversaciones todavía.',
  hideWhenEmpty = false,
}: {
  onOpen: (conversationId: string) => void;
  title?: string;
  emptyLabel?: string;
  hideWhenEmpty?: boolean;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setConversations(await fetchConversations());
      } catch {
        // silencioso: una bandeja vacía por error de red no debería alarmar
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;
  if (conversations.length === 0 && hideWhenEmpty) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
      <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
        <MessageCircle className="w-4 h-4 text-teal-600" />
        {title}
      </div>
      {conversations.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="w-full text-left py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 -mx-1 px-1 rounded"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {c.orderTitle || c.subject || c.participants.map((p) => p.displayName).join(', ') || 'Conversación'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{formatDate(c.lastMessageAt)}</div>
              </div>
              {c.unreadCount > 0 && (
                <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                  {c.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
