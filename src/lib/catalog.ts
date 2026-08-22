import { supabase } from './supabase';

export type ServiceRubro = { id: string; name: string; slug: string; icon?: string | null; visitDeposit: number };
export type CatalogCategory = { id: string; rubroId: string; rubroName: string; rubroSlug: string; name: string; description?: string | null; basePrice: number; unit: string; unitType: string; materialsIncluded: boolean };
type DbCategory = { id: string; rubro_id: string; name: string; description: string | null; base_price: number; unit: string; unit_type: string; materials_included: boolean; service_rubros: { name: string; slug: string } | null };
export type TarifarioItem = { id: string; name: string; description: string; price: number; subcategoria: string | null; subcategoryId: string | null };

export const formatPrice = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);

export async function getRubros(): Promise<ServiceRubro[]> {
  const { data, error } = await supabase.from('service_rubros').select('id, name, slug, icon, visit_deposit').eq('is_active', true).order('name');
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, slug: row.slug, icon: row.icon, visitDeposit: Number(row.visit_deposit) }));
}

export async function getCategoriesByRubro(rubroId?: string): Promise<CatalogCategory[]> {
  let query = supabase.from('service_categories').select('id, rubro_id, name, description, base_price, unit, unit_type, materials_included, service_rubros(name, slug)').eq('is_active', true).order('sort_order');
  if (rubroId) query = query.eq('rubro_id', rubroId);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as DbCategory[]).map((row) => ({ id: row.id, rubroId: row.rubro_id, rubroName: row.service_rubros?.name ?? 'Sin rubro', rubroSlug: row.service_rubros?.slug ?? '', name: row.name, description: row.description, basePrice: Number(row.base_price), unit: row.unit, unitType: row.unit_type, materialsIncluded: row.materials_included }));
}

// El tarifario detallado vive en `services` (mismo catálogo público de
// "Servicios" del Admin Hub), no en service_categories. Todos los rubros
// tienen ítems cargados con subcategoria/subcategory_id (ver
// plan-categorias-subcategorias.md) — el orden real por display_order se
// resuelve del lado del cliente (QuoteBuilder.tsx) contra catalogSubcategories,
// no acá, así que alcanza con ordenar por nombre.
export async function getTarifarioByRubroName(rubroName: string): Promise<TarifarioItem[]> {
  const { data, error } = await supabase.from('services').select('id, name, description, price, subcategoria, subcategory_id').eq('category', rubroName).eq('active', true).order('name');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    subcategoria: row.subcategoria as string | null,
    subcategoryId: row.subcategory_id as string | null,
  }));
}

export async function getRubroBySlug(slug: string): Promise<ServiceRubro | null> {
  const { data, error } = await supabase.from('service_rubros').select('id, name, slug, icon, visit_deposit').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, name: data.name, slug: data.slug, icon: data.icon, visitDeposit: Number(data.visit_deposit) } : null;
}
