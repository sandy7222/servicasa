import type { VercelRequest, VercelResponse } from '@vercel/node';
import { vi } from 'vitest';

export type TestResponse = VercelResponse & {
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
};

export function request(
  method: string,
  options: {
    body?: Record<string, unknown>;
    query?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): VercelRequest {
  return {
    method,
    body: options.body ?? {},
    query: options.query ?? {},
    headers: { host: 'tecniurbano.test', ...options.headers },
  } as unknown as VercelRequest;
}

export function response(): TestResponse {
  const res = {} as TestResponse;
  Object.assign(res, {
    headers: {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    end() {
      return res;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      res.headers[name] = Array.isArray(value) ? value.join(', ') : String(value);
      return res;
    },
  });
  return res;
}

type QueryResult = { data: unknown; error: unknown };

export function query(
  result: QueryResult = { data: null, error: null },
  hooks: {
    insert?: (value: unknown) => void;
    update?: (value: unknown) => void;
  } = {},
) {
  const builder: Record<string, unknown> = {};
  const chain = vi.fn(() => builder);

  Object.assign(builder, {
    select: chain,
    eq: chain,
    neq: chain,
    is: chain,
    order: chain,
    limit: chain,
    insert: vi.fn((value: unknown) => {
      hooks.insert?.(value);
      return builder;
    }),
    update: vi.fn((value: unknown) => {
      hooks.update?.(value);
      return builder;
    }),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: QueryResult) => void, reject: (reason: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  });

  return builder as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    neq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: PromiseLike<QueryResult>['then'];
  };
}
