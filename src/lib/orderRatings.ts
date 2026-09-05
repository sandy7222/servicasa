import { supabase } from './supabase';
import type { Database } from '../types/database.types';

type OrderRatingRow = Database['public']['Tables']['order_ratings']['Row'];

const CREATE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

export const NEW_TECHNICIAN_RATING_THRESHOLD = 3;

export function isNewTechnicianRating(count: number | null | undefined): boolean {
  return (count ?? 0) < NEW_TECHNICIAN_RATING_THRESHOLD;
}

type TechnicianRatingSortable = {
  name: string;
  rating: number;
  totalRatingsCount?: number | null;
};

export function compareTechniciansByRating(a: TechnicianRatingSortable, b: TechnicianRatingSortable): number {
  const aNew = isNewTechnicianRating(a.totalRatingsCount);
  const bNew = isNewTechnicianRating(b.totalRatingsCount);
  if (aNew !== bNew) return aNew ? 1 : -1;
  if (b.rating !== a.rating) return b.rating - a.rating;
  return a.name.localeCompare(b.name, 'es');
}

export type OrderRating = {
  id: string;
  orderId: string;
  technicianId: string;
  customerId: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  editedAt: string | null;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function parseInstant(value: string | null | undefined): number | null {
  if (!value) return null;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return direct;
  const isoish = Date.parse(value.replace(' ', 'T'));
  return Number.isNaN(isoish) ? null : isoish;
}

export function canCreateRating(completedAt: string | null | undefined, now = Date.now()): boolean {
  const completed = parseInstant(completedAt);
  if (completed == null) return false;
  return now - completed <= CREATE_WINDOW_MS;
}

export function canEditRating(createdAt: string | null | undefined, now = Date.now()): boolean {
  const created = parseInstant(createdAt);
  if (created == null) return false;
  return now - created <= EDIT_WINDOW_MS;
}

function mapRating(row: OrderRatingRow): OrderRating {
  return {
    id: row.id,
    orderId: row.order_id,
    technicianId: row.technician_id,
    customerId: row.customer_id,
    stars: row.stars,
    comment: row.comment,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

export async function fetchOrderRating(orderId: string): Promise<OrderRating | null> {
  const { data, error } = await supabase
    .from('order_ratings')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  throwIfError(error);
  return data ? mapRating(data as OrderRatingRow) : null;
}

export async function insertOrderRating(input: {
  orderId: string;
  technicianId: string;
  customerId: string;
  stars: number;
  comment?: string;
}): Promise<OrderRating> {
  const comment = input.comment?.trim() ? input.comment.trim() : null;
  const { data, error } = await supabase
    .from('order_ratings')
    .insert({
      order_id: input.orderId,
      technician_id: input.technicianId,
      customer_id: input.customerId,
      stars: input.stars,
      comment,
    })
    .select('*')
    .single();
  throwIfError(error);
  return mapRating(data as OrderRatingRow);
}

export async function updateOrderRating(
  id: string,
  input: { stars: number; comment?: string }
): Promise<OrderRating> {
  const comment = input.comment?.trim() ? input.comment.trim() : null;
  const { data, error } = await supabase
    .from('order_ratings')
    .update({ stars: input.stars, comment })
    .eq('id', id)
    .select('*')
    .single();
  throwIfError(error);
  return mapRating(data as OrderRatingRow);
}
