import type { Conversation, ConversationMessage, ConversationParticipant, MessageSenderRole } from '../types';
import { supabase } from './supabase';
import type { DbConversation, DbConversationParticipant, DbMessage } from './supabase';

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function mapParticipant(row: DbConversationParticipant): ConversationParticipant {
  return {
    id: row.id,
    profileId: row.profile_id,
    role: row.role,
    displayName: row.display_name ?? undefined,
  };
}

export function mapMessage(row: DbMessage): ConversationMessage {
  return {
    id: row.id,
    senderId: row.sender_id ?? undefined,
    senderRole: row.sender_role,
    body: row.body,
    isInternal: row.is_internal,
    createdAt: row.created_at,
  };
}

function mapConversation(
  row: DbConversation,
  participants: DbConversationParticipant[],
  messages: DbMessage[],
  unreadCount: number
): Conversation {
  return {
    id: row.id,
    orderId: row.order_id,
    caseId: row.case_id,
    subject: row.subject,
    orderTitle: row.subject_order_title,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    participants: participants.map(mapParticipant),
    messages: messages.map(mapMessage),
    unreadCount,
  };
}

async function fetchUnreadCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('conversation_unread_counts').select('*');
  throwIfError(error);
  const map: Record<string, number> = {};
  for (const row of (data ?? []) as { conversation_id: string; unread_count: number }[]) {
    map[row.conversation_id] = Number(row.unread_count);
  }
  return map;
}

/** Bandeja: todas las conversaciones visibles para el usuario actual (RLS
 * ya filtra a admin/participante), ordenadas por actividad reciente. No trae
 * los mensajes completos — solo lo necesario para la lista. */
export async function fetchConversations(): Promise<Conversation[]> {
  const { data: convRows, error } = await supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false });
  throwIfError(error);
  const conversations = (convRows ?? []) as DbConversation[];
  if (conversations.length === 0) return [];

  const ids = conversations.map((c) => c.id);
  const [participantsResult, unreadCounts] = await Promise.all([
    supabase.from('conversation_participants').select('*').in('conversation_id', ids),
    fetchUnreadCounts(),
  ]);
  throwIfError(participantsResult.error);
  const participants = (participantsResult.data ?? []) as DbConversationParticipant[];

  return conversations.map((row) =>
    mapConversation(
      row,
      participants.filter((p) => p.conversation_id === row.id),
      [],
      unreadCounts[row.id] ?? 0
    )
  );
}

/** Detalle completo de una conversación, con todo su hilo de mensajes. */
export async function fetchConversation(conversationId: string): Promise<Conversation | null> {
  const { data: convRow, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  throwIfError(error);
  if (!convRow) return null;

  const [participantsResult, messagesResult, unreadCounts] = await Promise.all([
    supabase.from('conversation_participants').select('*').eq('conversation_id', conversationId),
    supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
    fetchUnreadCounts(),
  ]);
  throwIfError(participantsResult.error);
  throwIfError(messagesResult.error);

  return mapConversation(
    convRow as DbConversation,
    (participantsResult.data ?? []) as DbConversationParticipant[],
    (messagesResult.data ?? []) as DbMessage[],
    unreadCounts[conversationId] ?? 0
  );
}

/** Cliente o técnico inician una charla sobre una orden propia — la RPC
 * resuelve quién es "el otro lado" a partir de la orden, sin confiar en un
 * profile_id mandado por el navegador. Devuelve la conversación existente
 * si ya había una para ese mismo par orden+participantes. */
export async function startOrderConversation(orderId: string, subject?: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_order_conversation', {
    p_order_id: orderId,
    p_subject: subject ?? null,
  });
  throwIfError(error);
  return data as string;
}

/** Contacto directo con administración, sin orden ni reclamo de por medio.
 * Admin ya ve todo por RLS (is_admin()) sin necesitar ser participante
 * listado — así que alcanza con crearla con un solo participante: quien la
 * inicia. */
export async function startDirectAdminConversation(
  actor: { profileId: string; role: MessageSenderRole; name: string },
  subject: string,
  firstMessage: string
): Promise<string> {
  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ subject, created_by: actor.profileId })
    .select('id')
    .single();
  throwIfError(error);
  const conversationId = (conv as { id: string }).id;

  const { error: participantError } = await supabase.from('conversation_participants').insert({
    conversation_id: conversationId,
    profile_id: actor.profileId,
    role: actor.role === 'admin' ? 'admin' : actor.role,
    display_name: actor.name,
  });
  throwIfError(participantError);

  await sendMessage(conversationId, actor.profileId, actor.role, firstMessage);
  return conversationId;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  senderRole: MessageSenderRole,
  body: string,
  isInternal = false
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    sender_role: senderRole,
    body,
    is_internal: isInternal,
  });
  throwIfError(error);
}

/** Marca como leídos todos los mensajes ajenos de una conversación para el
 * usuario actual — se llama al abrir el hilo. */
export async function markConversationRead(conversationId: string, profileId: string): Promise<void> {
  const { data: unread, error } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .neq('sender_id', profileId)
    .eq('is_internal', false);
  throwIfError(error);
  const messageIds = (unread ?? []).map((m) => (m as { id: string }).id);
  if (messageIds.length === 0) return;

  const { error: readsError } = await supabase
    .from('message_reads')
    .upsert(
      messageIds.map((message_id) => ({ message_id, profile_id: profileId })),
      { onConflict: 'message_id,profile_id', ignoreDuplicates: true }
    );
  throwIfError(readsError);
}

/** Total de mensajes sin leer del usuario actual, para el badge del Header. */
export async function fetchTotalUnreadCount(): Promise<number> {
  const counts = await fetchUnreadCounts();
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}
