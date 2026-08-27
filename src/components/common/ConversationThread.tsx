import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type { DbMessage } from '../../lib/supabase';
import { fetchConversation, mapMessage, markConversationRead, sendMessage } from '../../lib/conversations';
import type { Conversation, MessageSenderRole } from '../../types';

const formatDateTime = (value: string) => new Date(value).toLocaleString('es-AR');

/**
 * Hilo de una conversación — compartido por los 3 roles (RLS ya deja pasar
 * solo lo que corresponde). Se suscribe a Realtime sobre `messages` filtrado
 * por esta conversación puntual, en vez de sumar la tabla al refresco global
 * de AppContext (eso recargaría todo el catálogo por cada mensaje de chat).
 */
export function ConversationThread({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { currentUser, showToast } = useApp();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const senderRole: MessageSenderRole = currentUser?.role === 'admin' ? 'admin' : currentUser?.role === 'technician' ? 'technician' : 'customer';

  const load = async () => {
    try {
      const data = await fetchConversation(conversationId);
      setConversation(data);
      if (data && currentUser?.id) void markConversationRead(conversationId, currentUser.id);
    } catch {
      showToast('No se pudo cargar la conversación.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as DbMessage;
          setConversation((prev) => {
            if (!prev || prev.messages.some((m) => m.id === row.id)) return prev;
            return { ...prev, messages: [...prev.messages, mapMessage(row)] };
          });
          if (row.sender_id !== currentUser?.id && currentUser?.id) {
            void markConversationRead(conversationId, currentUser.id);
          }
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length]);

  const submit = async () => {
    if (!body.trim() || !currentUser?.id) return;
    setSending(true);
    try {
      await sendMessage(conversationId, currentUser.id, senderRole, body.trim());
      setBody('');
    } catch {
      showToast('No se pudo enviar el mensaje.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <main className="max-w-3xl mx-auto px-4 py-10 text-center text-slate-500">Cargando conversación…</main>;
  if (!conversation) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-slate-500">No encontramos esa conversación, o no tenés acceso a ella.</p>
        <button onClick={onBack} className="mt-3 text-teal-700 font-bold hover:underline">← Volver</button>
      </main>
    );
  }

  const otherParticipants = conversation.participants.filter((p) => p.profileId !== currentUser?.id);
  const title = conversation.orderTitle || conversation.subject || otherParticipants.map((p) => p.displayName).join(', ') || 'Conversación';

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:underline">
        <ArrowLeft className="w-4 h-4" />Volver
      </button>

      <section className="rounded-2xl bg-[#0f1b35] text-white p-4 sm:p-5">
        <h1 className="text-lg font-black">{title}</h1>
        <p className="text-xs text-slate-400 mt-1">
          {otherParticipants.map((p) => `${p.displayName ?? 'Usuario'} (${p.role === 'technician' ? 'técnico' : p.role === 'customer' ? 'cliente' : 'admin'})`).join(' · ') || 'Sin otros participantes'}
        </p>
      </section>

      <section className="rounded-xl bg-white border border-slate-200 p-4">
        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
          {conversation.messages.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Todavía no hay mensajes. Escribí el primero.</p>}
          {conversation.messages.map((m) => {
            const isMine = m.senderId === currentUser?.id;
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-2.5 text-sm ${isMine ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <div className={`text-[10px] mt-1 ${isMine ? 'text-teal-100' : 'text-slate-400'}`}>{formatDateTime(m.createdAt)}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-100 mt-3 pt-3 flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }}
            rows={1}
            placeholder="Escribir un mensaje…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none"
          />
          <button onClick={() => void submit()} disabled={sending || !body.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-teal-300 px-4 py-2 text-xs font-bold shrink-0">
            <Send className="w-3.5 h-3.5" />Enviar
          </button>
        </div>
      </section>
    </main>
  );
}
