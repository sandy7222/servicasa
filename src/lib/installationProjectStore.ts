import { supabase } from './supabase';

/**
 * Guardado de proyectos de instalación en la cuenta del técnico (plan-proyecto-instalacion.md, Fase 2C).
 * Tabla `installation_projects` con RLS: cada técnico ve solo los suyos. `data` es el proyecto sin el nombre; el motor
 * recalcula todo al abrirlo, así que no se guardan resultados.
 */

export type SavedProjectSummary = { id: string; name: string; updatedAt: string };

const TABLE = 'installation_projects';

const splitDraft = <T extends { name: string }>(draft: T) => {
  const { name, ...data } = draft;
  return { name: name.trim() || 'Proyecto sin nombre', data };
};

export async function listProjects(): Promise<SavedProjectSummary[]> {
  const { data, error } = await supabase.from(TABLE).select('id, name, updated_at').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: { id: string; name: string; updated_at: string }) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }));
}

export async function openProject<T extends object>(id: string): Promise<({ name: string } & T) | null> {
  const { data, error } = await supabase.from(TABLE).select('name, data').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...(data.data as T), name: data.name as string };
}

/** Crea el proyecto (sin `id`) o lo actualiza (con `id`). Devuelve el id guardado. */
export async function saveProject(technicianId: string, draft: { name: string }, id?: string | null): Promise<string> {
  const { name, data } = splitDraft(draft);
  if (id) {
    const { error } = await supabase.from(TABLE).update({ name, data, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data: row, error } = await supabase.from(TABLE).insert({ technician_id: technicianId, name, data }).select('id').single();
  if (error) throw error;
  return row.id as string;
}

/** Guarda una copia nueva ("… (copia)") y devuelve su id. */
export async function duplicateProject(technicianId: string, draft: { name: string }): Promise<string> {
  return saveProject(technicianId, { ...draft, name: `${draft.name.trim() || 'Proyecto sin nombre'} (copia)` }, null);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
