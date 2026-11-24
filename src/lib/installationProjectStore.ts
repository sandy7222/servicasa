import { supabase } from './supabase';

/**
 * Guardado de proyectos de instalación en la cuenta del técnico (plan-proyecto-instalacion.md, Fase 2C).
 * Tabla `installation_projects` con RLS: cada técnico ve solo los suyos. `data` es el proyecto sin el nombre; el motor
 * recalcula todo al abrirlo, así que no se guardan resultados.
 */

export type SavedProjectSummary = { id: string; name: string; updatedAt: string; planPath: string | null; planName: string | null };

const TABLE = 'installation_projects';

const splitDraft = <T extends { name: string }>(draft: T) => {
  const { name, ...data } = draft;
  return { name: name.trim() || 'Proyecto sin nombre', data };
};

export async function listProjects(): Promise<SavedProjectSummary[]> {
  const { data, error } = await supabase.from(TABLE).select('id, name, updated_at, plan_path, plan_name').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: { id: string; name: string; updated_at: string; plan_path: string | null; plan_name: string | null }) => ({
    id: r.id, name: r.name, updatedAt: r.updated_at, planPath: r.plan_path ?? null, planName: r.plan_name ?? null,
  }));
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

/** Borra el proyecto y, si tenía, el archivo del plano (el archivo se intenta borrar primero; si falla no frena el borrado). */
export async function deleteProject(id: string, planPath?: string | null): Promise<void> {
  if (planPath) await supabase.storage.from(PLAN_BUCKET).remove([planPath]).catch(() => undefined);
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

// --- Plano adjunto (bucket privado 'installation-plans', carpeta <técnico>/<proyecto>/) ---

export const PLAN_BUCKET = 'installation-plans';
export const PLAN_MAX_BYTES = 10 * 1024 * 1024;
export const PLAN_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** null si el archivo sirve; si no, el motivo para mostrarle al técnico. */
export function validatePlanFile(file: { type: string; size: number }): string | null {
  if (!PLAN_TYPES.includes(file.type)) return 'El plano debe ser PDF, JPG o PNG.';
  if (file.size > PLAN_MAX_BYTES) return 'El plano pesa más de 10 MB.';
  if (file.size === 0) return 'El archivo está vacío.';
  return null;
}

/** Sube el plano, lo vincula al proyecto y borra el anterior. Devuelve la ruta y el nombre guardados. */
export async function attachPlan(technicianId: string, projectId: string, file: File, previousPath?: string | null): Promise<{ path: string; name: string }> {
  const problem = validatePlanFile(file);
  if (problem) throw new Error(problem);
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${technicianId}/${projectId}/${Date.now()}-${safe}`;
  const { error: upError } = await supabase.storage.from(PLAN_BUCKET).upload(path, file, { contentType: file.type });
  if (upError) throw upError;
  const { error } = await supabase.from(TABLE).update({ plan_path: path, plan_name: file.name.slice(0, 200), updated_at: new Date().toISOString() }).eq('id', projectId);
  if (error) {
    await supabase.storage.from(PLAN_BUCKET).remove([path]).catch(() => undefined);
    throw error;
  }
  if (previousPath) await supabase.storage.from(PLAN_BUCKET).remove([previousPath]).catch(() => undefined);
  return { path, name: file.name };
}

/** Enlace temporal (2 minutos) para ver el plano. */
export async function planUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PLAN_BUCKET).createSignedUrl(path, 120);
  if (error || !data) throw error ?? new Error('No se pudo abrir el plano.');
  return data.signedUrl;
}

export async function removePlan(projectId: string, path: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ plan_path: null, plan_name: null, updated_at: new Date().toISOString() }).eq('id', projectId);
  if (error) throw error;
  await supabase.storage.from(PLAN_BUCKET).remove([path]).catch(() => undefined);
}
