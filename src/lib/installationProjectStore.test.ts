import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { table: string; op: string; payload?: unknown; filter?: [string, unknown] };
const calls: Call[] = [];
let nextResult: { data: unknown; error: unknown } = { data: null, error: null };

// Cadena mínima de supabase-js: cada paso devuelve el mismo objeto "thenable".
const chain = (table: string, op: string, payload?: unknown): any => {
  const call: Call = { table, op, payload };
  calls.push(call);
  const api: any = {
    select: () => api,
    order: () => api,
    eq: (col: string, val: unknown) => { call.filter = [col, val]; return api; },
    single: () => Promise.resolve(nextResult),
    maybeSingle: () => Promise.resolve(nextResult),
    then: (res: (v: unknown) => unknown) => Promise.resolve(nextResult).then(res),
  };
  return api;
};

const storageCalls: Array<{ op: string; path?: string | string[] }> = [];
let uploadError: { message: string } | null = null;
vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path: string) => { storageCalls.push({ op: 'upload', path }); return Promise.resolve({ error: uploadError }); },
        remove: (paths: string[]) => { storageCalls.push({ op: 'remove', path: paths }); return Promise.resolve({ error: null }); },
        createSignedUrl: (path: string) => { storageCalls.push({ op: 'sign', path }); return Promise.resolve({ data: { signedUrl: 'https://signed/x' }, error: null }); },
      }),
    },
    from: (table: string) => ({
      select: (cols?: string) => chain(table, `select:${cols}`),
      insert: (payload: unknown) => chain(table, 'insert', payload),
      update: (payload: unknown) => chain(table, 'update', payload),
      delete: () => chain(table, 'delete'),
    }),
  },
}));

const { attachPlan, deleteProject, duplicateProject, listProjects, openProject, planUrl, removePlan, saveProject, validatePlanFile } = await import('./installationProjectStore');

beforeEach(() => {
  calls.length = 0;
  nextResult = { data: null, error: null };
  storageCalls.length = 0;
  uploadError = null;
});

describe('installationProjectStore', () => {
  it('crea un proyecto nuevo con el técnico, el nombre y el resto como data', async () => {
    nextResult = { data: { id: 'p1' }, error: null };
    const id = await saveProject('tech-1', { name: ' Depto 3B ', rooms: [], circuits: [] } as { name: string });
    expect(id).toBe('p1');
    expect(calls[0]).toMatchObject({ table: 'installation_projects', op: 'insert', payload: { technician_id: 'tech-1', name: 'Depto 3B', data: { rooms: [], circuits: [] } } });
  });

  it('con id actualiza ese proyecto (no crea otro) y sin nombre usa uno por defecto', async () => {
    const id = await saveProject('tech-1', { name: '  ' }, 'p9');
    expect(id).toBe('p9');
    expect(calls[0]).toMatchObject({ op: 'update', filter: ['id', 'p9'], payload: { name: 'Proyecto sin nombre' } });
  });

  it('duplicar guarda una fila nueva llamada "… (copia)"', async () => {
    nextResult = { data: { id: 'p2' }, error: null };
    expect(await duplicateProject('tech-1', { name: 'Casa' })).toBe('p2');
    expect(calls[0]).toMatchObject({ op: 'insert', payload: { name: 'Casa (copia)' } });
  });

  it('abre un proyecto devolviendo data + nombre, y null si no existe', async () => {
    nextResult = { data: { name: 'Casa', data: { iccA: 3250 } }, error: null };
    expect(await openProject('p1')).toEqual({ iccA: 3250, name: 'Casa' });
    nextResult = { data: null, error: null };
    expect(await openProject('nada')).toBeNull();
  });

  it('lista con el formato de la app y propaga los errores', async () => {
    nextResult = { data: [{ id: 'a', name: 'X', updated_at: '2026-11-23T10:00:00Z', plan_path: null, plan_name: 'plano.pdf' }], error: null };
    expect(await listProjects()).toEqual([{ id: 'a', name: 'X', updatedAt: '2026-11-23T10:00:00Z', planPath: null, planName: 'plano.pdf' }]);
    nextResult = { data: null, error: new Error('rls') };
    await expect(listProjects()).rejects.toThrow('rls');
    await expect(deleteProject('a')).rejects.toThrow('rls');
  });
});

describe('plano adjunto', () => {
  const file = (name: string, type: string, size = 100) => new File([new Uint8Array(size)], name, { type });

  it('valida tipo, tamaño y vacío', () => {
    expect(validatePlanFile({ type: 'application/pdf', size: 1000 })).toBeNull();
    expect(validatePlanFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validatePlanFile({ type: 'application/zip', size: 1000 })).toMatch(/PDF, JPG o PNG/);
    expect(validatePlanFile({ type: 'application/pdf', size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(validatePlanFile({ type: 'application/pdf', size: 0 })).toMatch(/vacío/);
  });

  it('sube a la carpeta técnico/proyecto, vincula el proyecto y borra el plano anterior', async () => {
    const r = await attachPlan('tech-1', 'proj-1', file('Plano 1° piso.pdf', 'application/pdf'), 'tech-1/proj-1/viejo.pdf');
    expect(r.name).toBe('Plano 1° piso.pdf');
    expect(r.path).toMatch(/^tech-1\/proj-1\/\d+-Plano-1--piso\.pdf$/);
    expect(storageCalls[0]).toMatchObject({ op: 'upload', path: r.path });
    expect(calls[0]).toMatchObject({ op: 'update', filter: ['id', 'proj-1'], payload: { plan_path: r.path, plan_name: 'Plano 1° piso.pdf' } });
    expect(storageCalls[1]).toEqual({ op: 'remove', path: ['tech-1/proj-1/viejo.pdf'] });
  });

  it('un archivo inválido no sube nada, y si falla el vínculo se borra lo subido', async () => {
    await expect(attachPlan('t', 'p', file('a.zip', 'application/zip'))).rejects.toThrow('PDF, JPG o PNG');
    expect(storageCalls).toHaveLength(0);
    nextResult = { data: null, error: new Error('rls') };
    await expect(attachPlan('t', 'p', file('a.pdf', 'application/pdf'))).rejects.toThrow('rls');
    expect(storageCalls.map((c) => c.op)).toEqual(['upload', 'remove']);
  });

  it('da un enlace temporal, quita el plano y al borrar el proyecto borra también el archivo', async () => {
    expect(await planUrl('t/p/x.pdf')).toBe('https://signed/x');
    await removePlan('p', 't/p/x.pdf');
    expect(calls[0]).toMatchObject({ op: 'update', payload: { plan_path: null, plan_name: null } });
    expect(storageCalls.at(-1)).toEqual({ op: 'remove', path: ['t/p/x.pdf'] });
    storageCalls.length = 0;
    await deleteProject('p', 't/p/x.pdf');
    expect(storageCalls).toEqual([{ op: 'remove', path: ['t/p/x.pdf'] }]);
  });
});
