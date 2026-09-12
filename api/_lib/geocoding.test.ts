import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cubre el lookup local agregado sobre ar_localidades (tabla de geocoding
 * local, INDEC/georef, ver plan-zona-trabajo-agenda.md): match local
 * encontrado no debe tocar Nominatim/fetch; sin match local debe caer al
 * fallback existente; y ciudad/provincia vacías o ausentes siguen sin
 * consultar nada, igual que antes de este cambio.
 */

type Row = Record<string, unknown>;

let rows: Row[];

function makeFakeSupabaseAdmin() {
  function builder() {
    const filters: Array<{ col: string; op: 'eq' | 'ilike'; val: unknown }> = [];
    let orderCol: string | null = null;
    let limitN: number | null = null;

    const api = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, op: 'eq', val });
        return api;
      },
      ilike(col: string, val: unknown) {
        filters.push({ col, op: 'ilike', val });
        return api;
      },
      order(col: string) {
        orderCol = col;
        return api;
      },
      limit(n: number) {
        limitN = n;
        return exec();
      },
    };

    function exec() {
      let matched = rows.filter((row) =>
        filters.every(({ col, op, val }) => {
          if (op === 'eq') return row[col] === val;
          const pattern = String(val).replace(/^%/, '').replace(/%$/, '');
          return String(row[col]).includes(pattern);
        })
      );
      if (orderCol) {
        matched = [...matched].sort((a, b) => String(a[orderCol as string]).localeCompare(String(b[orderCol as string])));
      }
      if (limitN != null) matched = matched.slice(0, limitN);
      return Promise.resolve({ data: matched, error: null });
    }

    return api;
  }

  return { from: () => builder() };
}

const fetchMock = vi.fn();

vi.mock('./supabaseAdmin.js', () => ({
  get supabaseAdmin() {
    return makeFakeSupabaseAdmin();
  },
}));

describe('geocodeLocality', () => {
  beforeEach(() => {
    rows = [
      {
        nombre_normalizado: 'san carlos de bariloche',
        provincia_normalizada: 'rio negro',
        lat: -41.134196685,
        lng: -71.310958312,
      },
      {
        nombre_normalizado: 'ciudad de buenos aires',
        provincia_normalizada: 'ciudad autonoma de buenos aires',
        lat: -34.608416378,
        lng: -58.372134681,
      },
    ];
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con match exacto en la tabla local devuelve el punto sin llamar a fetch/Nominatim', async () => {
    const { geocodeLocality } = await import('./geocoding.js');
    const point = await geocodeLocality('San Carlos de Bariloche', 'Río Negro');
    expect(point).toEqual({ lat: -41.134196685, lng: -71.310958312 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resuelve el alias de provincia CABA contra el nombre canónico de la tabla', async () => {
    const { geocodeLocality } = await import('./geocoding.js');
    const point = await geocodeLocality('Ciudad de Buenos Aires', 'CABA');
    expect(point).toEqual({ lat: -34.608416378, lng: -58.372134681 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con match parcial (nombre incompleto) igual encuentra la localidad local', async () => {
    const { geocodeLocality } = await import('./geocoding.js');
    const point = await geocodeLocality('Bariloche', 'Río Negro');
    expect(point).toEqual({ lat: -41.134196685, lng: -71.310958312 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin match local, cae al fallback de Nominatim', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '-27.0', lon: '-65.0' }],
    });
    const { geocodeLocality } = await import('./geocoding.js');
    const point = await geocodeLocality('Una Localidad Que No Existe', 'Río Negro');
    expect(point).toEqual({ lat: -27.0, lng: -65.0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sin ciudad o provincia no consulta ni la tabla local ni Nominatim', async () => {
    const { geocodeLocality } = await import('./geocoding.js');
    expect(await geocodeLocality(null, 'Río Negro')).toBeNull();
    expect(await geocodeLocality(undefined, undefined)).toBeNull();
    expect(await geocodeLocality('Bariloche', '   ')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
