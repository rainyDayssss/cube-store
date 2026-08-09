/**
 * In-memory mock of the Supabase client surface used by the store service.
 *
 * The single testing seam (spec, Testing Decisions): store-service functions
 * (`placeOrder`, `transitionOrderStatus`, catalog queries, ...) receive a
 * Supabase client; in tests they receive this mock, seeded per-test via
 * `createMockSupabase({ products: [...], ... })`.
 *
 * Supported: chainable `from(table).select/insert/update/delete` with eq/neq/
 * gt/gte/lt/lte/ilike/in filters, `order` (single or multi-column — repeated
 * calls compose like PostgREST, first call is the primary key), `limit`,
 * `range`, `single`, `maybeSingle`, column projection,
 * `select(..., { count: "exact" })` (total matching rows before range/limit,
 * mirroring PostgREST), `rpc` (registered via `mockRpc`), and `failNext` for
 * forcing errors in failure-path tests. Returned data is a copy, so mutating
 * it never corrupts the in-memory tables (use `.db` to assert on actual state).
 */

type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

export type MockError = { message: string; code?: string; details?: string };
export type QueryResult<T = unknown> = {
  data: T | null;
  error: MockError | null;
  /** Total matching rows before range/limit — set when select asks for `count: "exact"`. */
  count?: number | null;
};

type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "ilike" | "in";
type Filter = { op: FilterOp; column: string; value: unknown };
type QueryOp =
  | "select"
  | "insert" | "update" | "delete" | "rpc"
  | "storage-upload"
  | "storage-remove";
type QueryMode = "list" | "single" | "maybeSingle";
export type PendingFailure = {
  op?: QueryOp;
  table?: string;
  /** Override the simulated error (e.g. a real Postgres code like 23503). */
  error?: MockError;
};
type RpcHandler = (args: Record<string, unknown>) => unknown;

const NO_ROWS_ERROR: MockError = {
  message: "JSON object requested, multiple (or no) rows returned",
  code: "PGRST116",
  details: "The result contains 0 rows",
};

const MULTIPLE_ROWS_ERROR: MockError = {
  message: "JSON object requested, multiple (or no) rows returned",
  code: "PGRST116",
  details: "The result contains more than one row",
};

export type MockStorageObject = {
  name: string;
  contentType?: string;
};

export type MockStorage = Record<string, MockStorageObject[]>;

class MockContext {
  readonly tables: Tables = {};
  readonly storageObjects: MockStorage = {};
  private readonly failures: PendingFailure[] = [];
  private readonly rpcs = new Map<string, RpcHandler>();

  constructor(initial?: Partial<Tables>) {
    for (const [name, rows] of Object.entries(initial ?? {})) {
      if (rows !== undefined) {
        this.tables[name] = rows.map((row) => ({ ...row }));
      }
    }
  }

  failNext(pending: PendingFailure): void {
    this.failures.push(pending);
  }

  takeFailure(op: QueryOp, table: string): PendingFailure | null {
    const index = this.failures.findIndex(
      (pending) =>
        (pending.op === undefined || pending.op === op) &&
        (pending.table === undefined || pending.table === table),
    );
    if (index === -1) return null;
    const [failure] = this.failures.splice(index, 1);
    return failure;
  }

  ensureTable(table: string): Row[] {
    if (!this.tables[table]) {
      this.tables[table] = [];
    }
    return this.tables[table];
  }

  mockRpc(name: string, handler: RpcHandler): void {
    this.rpcs.set(name, handler);
  }

  callRpc(name: string, args: Record<string, unknown>): QueryResult {
    const failure = this.takeFailure("rpc", name);
    if (failure) {
      return {
        data: null,
        error: failure.error ?? { message: "Simulated failure", code: "MOCK" },
      };
    }
    const handler = this.rpcs.get(name);
    if (!handler) {
      return { data: null, error: { message: `No mock registered for RPC "${name}"` } };
    }
    return { data: (handler(args) ?? null) as unknown, error: null };
  }
}

class MockQueryBuilder implements PromiseLike<QueryResult> {
  private filters: Filter[] = [];
  private sorts: { column: string; ascending: boolean }[] = [];
  private limitCount: number | null = null;
  private rangeStart: number | null = null;
  private rangeEnd: number | null = null;
  private mode: QueryMode = "list";
  private projection: string | null = null;
  private payload: Row | Row[] | null = null;
  private countOption: "exact" | null = null;
  private returned = false;

  constructor(
    private readonly ctx: MockContext,
    private readonly table: string,
    private op: QueryOp,
  ) {}

  // --- filters ---

  eq(column: string, value: unknown): this {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ op: "neq", column, value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ op: "gt", column, value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ op: "gte", column, value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ op: "lt", column, value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ op: "lte", column, value });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters.push({ op: "ilike", column, value: pattern });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ op: "in", column, value: values });
    return this;
  }

  // --- paging / shaping ---

  order(column: string, opts?: { ascending?: boolean }): this {
    this.sorts.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number): this {
    this.rangeStart = from;
    this.rangeEnd = to;
    return this;
  }

  single(): this {
    this.mode = "single";
    return this;
  }

  maybeSingle(): this {
    this.mode = "maybeSingle";
    return this;
  }

  // --- terminal operations ---

  select(columns?: string, opts?: { count?: "exact" }): this {
    this.projection = columns ?? "*";
    this.countOption = opts?.count ?? null;
    this.returned = true;
    return this;
  }

  insert(rows: Row | Row[]): this {
    this.payload = rows;
    this.op = "insert";
    return this;
  }

  update(rows: Row): this {
    this.payload = rows;
    this.op = "update";
    return this;
  }

  delete(): this {
    this.op = "delete";
    return this;
  }

  // --- thenable ---

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }

  // --- internals ---

  private async run(): Promise<QueryResult> {
    const failure = this.ctx.takeFailure(this.op, this.table);
    if (failure) {
      return {
        data: null,
        error: failure.error ?? { message: "Simulated failure", code: "MOCK" },
      };
    }
    switch (this.op) {
      case "select":
        return this.runSelect();
      case "insert":
        return this.runInsert();
      case "update":
        return this.runUpdate();
      case "delete":
        return this.runDelete();
      default:
        // RPC calls are handled by the context, never through the builder.
        return { data: null, error: { message: "RPC is not a table operation" } };
    }
  }

  private runSelect(): QueryResult {
    const rows = this.ctx.tables[this.table] ?? [];
    let matched = rows.filter((row) => this.matches(row));

    // PostgREST semantics: `count` reflects ALL rows matching the filters,
    // before range/limit pagination is applied.
    const count = this.countOption === "exact" ? matched.length : null;

    if (this.sorts.length > 0) {
      // PostgREST composes repeated `.order()` calls into one multi-column
      // ORDER BY — the first call is the primary key. Reapplying the keys
      // from least-significant to most-significant with a stable sort yields
      // the same lexicographic order (a stable sort by the primary key last
      // lets the secondary keys break only its ties).
      matched = [...matched];
      for (let i = this.sorts.length - 1; i >= 0; i--) {
        const { column, ascending } = this.sorts[i];
        matched.sort((a, b) => compareValues(a[column], b[column], ascending));
      }
    }

    if (this.rangeStart !== null && this.rangeEnd !== null) {
      matched = matched.slice(this.rangeStart, this.rangeEnd + 1);
    } else if (this.limitCount !== null) {
      matched = matched.slice(0, this.limitCount);
    }

    return this.shapeResult(matched.map((row) => project(row, this.projection)), count);
  }

  private runInsert(): QueryResult {
    const table = this.ctx.ensureTable(this.table);
    const raw = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : [];
    const inserted = raw.map((row) => ({ ...row }));
    table.push(...inserted);
    return this.shapeResult(inserted.map((row) => project(row, this.projection)));
  }

  private runUpdate(): QueryResult {
    const table = this.ctx.tables[this.table];
    if (!table) {
      return { data: null, error: { message: `Table "${this.table}" does not exist` } };
    }
    const updated: Row[] = [];
    for (const row of table) {
      if (this.matches(row)) {
        Object.assign(row, this.payload ?? {});
        updated.push({ ...row });
      }
    }
    return this.shapeResult(updated.map((row) => project(row, this.projection)));
  }

  private runDelete(): QueryResult {
    const table = this.ctx.tables[this.table];
    if (!table) {
      return { data: null, error: { message: `Table "${this.table}" does not exist` } };
    }
    const deleted: Row[] = [];
    const kept: Row[] = [];
    for (const row of table) {
      if (this.matches(row)) {
        deleted.push({ ...row });
      } else {
        kept.push(row);
      }
    }
    this.ctx.tables[this.table] = kept;
    return this.shapeResult(deleted.map((row) => project(row, this.projection)));
  }

  private shapeResult(rows: Row[], count: number | null = null): QueryResult {
    if (!this.returned) {
      return { data: null, error: null, count };
    }
    if (this.mode === "single") {
      if (rows.length === 0) return { data: null, error: NO_ROWS_ERROR, count };
      if (rows.length > 1) return { data: null, error: MULTIPLE_ROWS_ERROR, count };
      return { data: rows[0], error: null, count };
    }
    if (this.mode === "maybeSingle") {
      if (rows.length === 0) return { data: null, error: null, count };
      if (rows.length > 1) return { data: null, error: MULTIPLE_ROWS_ERROR, count };
      return { data: rows[0], error: null, count };
    }
    return { data: rows, error: null, count };
  }

  private matches(row: Row): boolean {
    return this.filters.every((filter) => filterMatches(filter, row));
  }
}

export interface MockSupabase {
  from(table: string): MockQueryBuilder;
  rpc(name: string, args?: Record<string, unknown>): Promise<QueryResult>;
  failNext(pending: PendingFailure): void;
  mockRpc(name: string, handler: RpcHandler): void;
  /** Live in-memory tables — read these to assert on state after operations. */
  readonly db: Tables;
  /**
   * Minimal Storage surface: uploads and removals land in `storageObjects`;
   * `failNext({ op: "storage-upload" | "storage-remove", table: <bucket> })`
   * simulates Storage errors for failure-path tests.
   */
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        file: unknown,
        opts?: { contentType?: string },
      ): Promise<QueryResult<{ path: string }>>;
      remove(paths: string[]): Promise<QueryResult<string[]>>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
  /** Storage objects by bucket (name + optional content type) — assert on these. */
  readonly storageObjects: MockStorage;
}

export function createMockSupabase(initial?: Partial<Tables>): MockSupabase {
  const ctx = new MockContext(initial);

  return {
    from(table: string) {
      return new MockQueryBuilder(ctx, table, "select");
    },
    rpc(name: string, args: Record<string, unknown> = {}) {
      return Promise.resolve(ctx.callRpc(name, args));
    },
    failNext(pending: PendingFailure) {
      ctx.failNext(pending);
    },
    mockRpc(name: string, handler: RpcHandler) {
      ctx.mockRpc(name, handler);
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(
            path: string,
            _file: unknown,
            opts?: { contentType?: string },
          ): Promise<QueryResult<{ path: string }>> {
            const failure = ctx.takeFailure("storage-upload", bucket);
            if (failure) {
              return {
                data: null,
                error: failure.error ?? {
                  message: "Simulated storage upload failure",
                  code: "MOCK",
                },
              };
            }
            const list = (ctx.storageObjects[bucket] ??= []);
            if (!list.some((object) => object.name === path)) {
              list.push({ name: path, contentType: opts?.contentType });
            }
            return { data: { path }, error: null };
          },
          async remove(paths: string[]): Promise<QueryResult<string[]>> {
            const failure = ctx.takeFailure("storage-remove", bucket);
            if (failure) {
              return {
                data: null,
                error: failure.error ?? {
                  message: "Simulated storage removal failure",
                  code: "MOCK",
                },
              };
            }
            const list = ctx.storageObjects[bucket] ?? [];
            ctx.storageObjects[bucket] = list.filter(
              (object) => !paths.includes(object.name),
            );
            return { data: paths, error: null };
          },
          getPublicUrl(path: string): { data: { publicUrl: string } } {
            return {
              data: {
                publicUrl: `https://mock.supabase.co/storage/v1/object/public/${bucket}/${path}`,
              },
            };
          },
        };
      },
    },
    get db() {
      return ctx.tables;
    },
    get storageObjects() {
      return ctx.storageObjects;
    },
  };
}

// --- helpers ---

function filterMatches(filter: Filter, row: Row): boolean {
  const actual = row[filter.column];
  switch (filter.op) {
    case "eq":
      return actual === filter.value;
    case "neq":
      return actual !== filter.value;
    case "gt":
      return compareTo(filter.value, actual) > 0;
    case "gte":
      return compareTo(filter.value, actual) >= 0;
    case "lt":
      return compareTo(filter.value, actual) < 0;
    case "lte":
      return compareTo(filter.value, actual) <= 0;
    case "ilike":
      return typeof filter.value === "string" && ilikeMatches(actual, filter.value);
    case "in":
      return Array.isArray(filter.value) && filter.value.includes(actual);
  }
}

/** Returns < 0 when `actual` is greater than `expected`, matching PostgREST semantics. */
function compareTo(expected: unknown, actual: unknown): number {
  return compareValues(actual, expected, true);
}

function compareValues(a: unknown, b: unknown, ascending: boolean): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  const result = a < b ? -1 : a > b ? 1 : 0;
  return ascending ? result : -result;
}

function ilikeMatches(actual: unknown, pattern: string): boolean {
  if (typeof actual !== "string") return false;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped.replace(/%/g, ".*").replace(/_/g, ".")}$`, "i");
  return regex.test(actual);
}

function project(row: Row, columns: string | null): Row {
  if (!columns || columns === "*") return { ...row };
  const picked: Row = {};
  for (const column of columns.split(",")) {
    const name = column.trim();
    if (name && name in row) {
      picked[name] = row[name];
    }
  }
  return picked;
}
