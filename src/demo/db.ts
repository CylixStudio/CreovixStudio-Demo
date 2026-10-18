/**
 * Demo database. A tiny in-memory PostgREST look-alike used in place of Supabase.
 * It runs in the browser (localStorage backed) and on the server (request scoped,
 * rebuilt from fixtures plus the visitor overlay). Nothing here touches a network.
 */

export type Row = Record<string, unknown>;

/** Table key columns. Anything not listed uses `id`. */
export const PRIMARY_KEYS: Record<string, string[]> = {
  user_subscriptions: ["user_id"],
  custom_chat_command_settings: ["user_id"],
  default_chat_commands: ["user_id", "command_id"],
  chat_text_alerts: ["user_id", "alert_id"],
  giveaway_settings: ["user_id"],
  link_in_bio_profiles: ["user_id"],
  link_in_bio_themes: ["user_id"],
  mark_point_settings: ["user_id"],
  media_playback_state: ["user_id"],
  stream_schedule_settings: ["user_id"],
  studio_settings: ["key"],
  kick_app_bot_identity: ["user_id"],
};

const NO_UPDATED_AT = new Set(["audit_logs", "events", "chat_text_alert_sends", "loyalty_sales"]);

export function pkOf(table: string): string[] {
  return PRIMARY_KEYS[table] ?? ["id"];
}

export function rowKey(table: string, row: Row): string {
  return pkOf(table)
    .map((column) => String(row[column] ?? ""))
    .join("|");
}

export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    return (char === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function newToken(): string {
  return newUuid().replace(/-/g, "");
}

/** Column defaults that Postgres would have supplied. */
const DEFAULTS: Record<string, () => Row> = {
  widgets: () => ({ public_token: `demo-${newUuid()}`, is_enabled: true, config: {}, state: {} }),
  media_request_settings: () => ({ overlay_token: `demo-${newToken()}`, mod_token: `demo-${newToken()}` }),
  giveaway_settings: () => ({ overlay_token: `demo-${newToken()}` }),
  mark_point_settings: () => ({ share_token: `demo-${newToken()}` }),
  stream_schedule_settings: () => ({ share_token: `demo-${newToken()}` }),
  overlays: () => ({ public_token: `demo-${newToken()}`, is_public: true }),
};

/** Unique columns beyond the primary key. */
const UNIQUES: Record<string, string[][]> = {
  link_in_bio_profiles: [["slug"]],
  widgets: [["public_token"]],
  subathons: [["slug"]],
};

/** parent table -> embedded table -> foreign key on the embedded table. */
const EMBEDS: Record<string, Record<string, string>> = {
  subathons: { overlays: "subathon_id", rules: "subathon_id", timer_states: "subathon_id" },
  widgets: { goals: "widget_id" },
};

export type DbError = { message: string; code: string; details: string | null; hint: string | null };
export type DbResult = {
  data: unknown;
  error: DbError | null;
  count: number | null;
  status: number;
  statusText: string;
};

function fail(message: string, code: string): DbResult {
  return {
    data: null,
    error: { message, code, details: null, hint: null },
    count: null,
    status: 400,
    statusText: "Bad Request",
  };
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const x = typeof a === "boolean" ? Number(a) : a;
  const y = typeof b === "boolean" ? Number(b) : b;
  if (typeof x === "number" && typeof y === "number") return x - y;
  const left = String(x);
  const right = String(y);
  return left < right ? -1 : left > right ? 1 : 0;
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === "object" || typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
  return String(a) === String(b);
}

function likeToRegExp(pattern: string, insensitive: boolean): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\*?]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, insensitive ? "is" : "s");
}

function parseLiteral(raw: string): unknown {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw.replace(/^"(.*)"$/, "$1");
}

function parseList(raw: string): string[] {
  return raw
    .replace(/^[({[]/, "")
    .replace(/[)}\]]$/, "")
    .split(",")
    .map((item) => item.trim().replace(/^"(.*)"$/, "$1"))
    .filter((item) => item.length > 0);
}

type Predicate = (row: Row) => boolean;

function columnValue(row: Row, column: string): unknown {
  if (!column.includes("->")) return row[column];
  const [head, ...path] = column.split(/->>?/);
  let current: unknown = row[head ?? ""];
  for (const key of path) {
    if (current && typeof current === "object") current = (current as Row)[key];
    else return undefined;
  }
  return current;
}

function asList(operand: unknown): unknown[] {
  return Array.isArray(operand) ? operand : parseList(String(operand));
}

function operatorPredicate(column: string, operator: string, operand: unknown): Predicate {
  const read = (row: Row) => columnValue(row, column);
  switch (operator) {
    case "eq":
      return (row) => looseEqual(read(row), operand);
    case "neq":
      return (row) => !looseEqual(read(row), operand);
    case "gt":
      return (row) => read(row) != null && compare(read(row), operand) > 0;
    case "gte":
      return (row) => read(row) != null && compare(read(row), operand) >= 0;
    case "lt":
      return (row) => read(row) != null && compare(read(row), operand) < 0;
    case "lte":
      return (row) => read(row) != null && compare(read(row), operand) <= 0;
    case "like":
    case "ilike": {
      const regex = likeToRegExp(String(operand), operator === "ilike");
      return (row) => regex.test(String(read(row) ?? ""));
    }
    case "is":
      return (row) => (operand === null ? read(row) == null : looseEqual(read(row), operand));
    case "in": {
      const list = asList(operand);
      return (row) => list.some((item) => looseEqual(read(row), item));
    }
    case "cs":
    case "contains": {
      return (row) => {
        const value = read(row);
        if (Array.isArray(value)) {
          return asList(operand).every((item) => value.some((entry) => looseEqual(entry, item)));
        }
        if (value && typeof value === "object" && operand && typeof operand === "object") {
          return Object.entries(operand as Row).every(([key, expected]) => looseEqual((value as Row)[key], expected));
        }
        return false;
      };
    }
    case "cd":
    case "containedBy": {
      const list = asList(operand);
      return (row) => {
        const value = read(row);
        return Array.isArray(value) && value.every((entry) => list.some((item) => looseEqual(entry, item)));
      };
    }
    case "ov":
    case "overlaps": {
      const list = asList(operand);
      return (row) => {
        const value = read(row);
        return Array.isArray(value) && value.some((entry) => list.some((item) => looseEqual(entry, item)));
      };
    }
    default:
      return () => true;
  }
}

function splitTopLevel(expression: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expression.length; i += 1) {
    const char = expression[i];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(expression.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(expression.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function conditionPredicate(part: string): Predicate {
  const group = /^(and|or)\((.*)\)$/s.exec(part);
  if (group) {
    const subs = splitTopLevel(group[2] ?? "").map(conditionPredicate);
    return group[1] === "or" ? (row) => subs.some((sub) => sub(row)) : (row) => subs.every((sub) => sub(row));
  }
  const match = /^([\w>-]+?)\.(not\.)?(\w+)\.(.*)$/s.exec(part);
  if (!match) return () => true;
  const operator = match[3] ?? "eq";
  const raw = match[4] ?? "";
  const operand = ["in", "cs", "cd", "ov"].includes(operator) ? raw : parseLiteral(raw);
  const base = operatorPredicate(match[1] ?? "", operator, operand);
  return match[2] ? (row) => !base(row) : base;
}

function orPredicate(expression: string): Predicate {
  const subs = splitTopLevel(expression).map(conditionPredicate);
  return (row) => subs.some((sub) => sub(row));
}

type SelectNode = { columns: string[]; embeds: Array<{ table: string; select: SelectNode }> };

function parseSelect(source: string): SelectNode {
  const node: SelectNode = { columns: [], embeds: [] };
  for (const part of splitTopLevel(source)) {
    const embed = /^(?:\w+:)?(\w+)(?:!\w+)?\((.*)\)$/s.exec(part);
    if (embed) node.embeds.push({ table: embed[1] ?? "", select: parseSelect(embed[2] ?? "*") });
    else node.columns.push(part.replace(/^\w+:(?!:)/, ""));
  }
  if (node.columns.length === 0) node.columns.push("*");
  return node;
}

type Mode = "select" | "insert" | "update" | "upsert" | "delete";

class Query implements PromiseLike<DbResult> {
  private mode: Mode = "select";
  private payload: Row[] = [];
  private patch: Row = {};
  private predicates: Predicate[] = [];
  private orders: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = [];
  private limitValue: number | null = null;
  private offsetValue = 0;
  private selectSource = "*";
  private returning = false;
  private wantCount = false;
  private head = false;
  private singleMode: "none" | "one" | "maybe" = "none";
  private onConflict: string[] | null = null;
  private ignoreDuplicates = false;

  constructor(
    private readonly db: DemoDb,
    private readonly table: string,
  ) {}

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    if (this.mode !== "select") this.returning = true;
    this.selectSource = columns;
    if (options?.count) this.wantCount = true;
    if (options?.head) this.head = true;
    return this;
  }
  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }
  upsert(values: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.mode = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.onConflict = options?.onConflict ? options.onConflict.split(",").map((item) => item.trim()) : null;
    this.ignoreDuplicates = options?.ignoreDuplicates === true;
    return this;
  }
  update(values: Row) {
    this.mode = "update";
    this.patch = values;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }

  private add(predicate: Predicate) {
    this.predicates.push(predicate);
    return this;
  }
  eq(column: string, value: unknown) {
    return this.add(operatorPredicate(column, "eq", value));
  }
  neq(column: string, value: unknown) {
    return this.add(operatorPredicate(column, "neq", value));
  }
  gt(column: string, value: unknown) {
    return this.add(operatorPredicate(column, "gt", value));
  }
  gte(column: string, value: unknown) {
    return this.add(operatorPredicate(column, "gte", value));
  }
  lt(column: string, value: unknown) {
    return this.add(operatorPredicate(column, "lt", value));
  }
  lte(column: string, value: unknown) {
    return this.add(operatorPredicate(column, "lte", value));
  }
  like(column: string, value: string) {
    return this.add(operatorPredicate(column, "like", value));
  }
  ilike(column: string, value: string) {
    return this.add(operatorPredicate(column, "ilike", value));
  }
  is(column: string, value: unknown) {
    return this.add(operatorPredicate(column, "is", value));
  }
  in(column: string, values: unknown[]) {
    return this.add(operatorPredicate(column, "in", values));
  }
  contains(column: string, value: unknown) {
    return this.add(operatorPredicate(column, "contains", value));
  }
  containedBy(column: string, value: unknown) {
    return this.add(operatorPredicate(column, "containedBy", value));
  }
  overlaps(column: string, value: unknown) {
    return this.add(operatorPredicate(column, "overlaps", value));
  }
  match(query: Row) {
    for (const [column, value] of Object.entries(query)) this.eq(column, value);
    return this;
  }
  not(column: string, operator: string, value: unknown) {
    const operand = operator === "in" && typeof value === "string" ? parseList(value) : value;
    const base = operatorPredicate(column, operator, operand);
    return this.add((row) => !base(row));
  }
  filter(column: string, operator: string, value: unknown) {
    return this.add(operatorPredicate(column, operator, value));
  }
  or(expression: string) {
    return this.add(orPredicate(expression));
  }
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false, nullsFirst: options?.nullsFirst });
    return this;
  }
  limit(count: number) {
    this.limitValue = count;
    return this;
  }
  range(from: number, to: number) {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }
  abortSignal() {
    return this;
  }
  returns() {
    return this;
  }
  single() {
    this.singleMode = "one";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    let result: DbResult;
    try {
      result = this.execute();
    } catch (error) {
      result = fail(error instanceof Error ? error.message : "demo db error", "XX000");
    }
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  private project(rows: Row[], source: string): Row[] {
    const node = parseSelect(source);
    const all = node.columns.includes("*");
    return rows.map((row) => {
      const out: Row = all ? { ...row } : {};
      if (!all) {
        for (const column of node.columns) {
          const key = (column.split("::")[0] ?? column).trim();
          if (key.includes("->")) out[key.split(/->>?/).pop() ?? key] = columnValue(row, key);
          else if (key in row) out[key] = row[key];
        }
      }
      for (const embed of node.embeds) {
        const fk = EMBEDS[this.table]?.[embed.table];
        if (!fk) continue;
        const children = this.db.rows(embed.table).filter((child) => String(child[fk] ?? "") === String(row["id"] ?? ""));
        out[embed.table] = new Query(this.db, embed.table).project(children, embed.select.columns.join(","));
      }
      return clone(out);
    });
  }

  private matching(): Row[] {
    return this.db.rows(this.table).filter((row) => this.predicates.every((predicate) => predicate(row)));
  }

  private finish(rows: Row[], count: number): DbResult {
    let data: unknown = this.returning || this.mode === "select" ? this.project(rows, this.selectSource) : null;
    if (this.head) data = null;
    if (this.singleMode !== "none" && Array.isArray(data)) {
      if (data.length === 1) data = data[0];
      else if (data.length === 0 && this.singleMode === "maybe") data = null;
      else {
        return {
          data: null,
          error: {
            message: "JSON object requested, multiple (or no) rows returned",
            code: "PGRST116",
            details: `The result contains ${data.length} rows`,
            hint: null,
          },
          count: null,
          status: 406,
          statusText: "Not Acceptable",
        };
      }
    }
    return {
      data,
      error: null,
      count: this.wantCount ? count : null,
      status: this.mode === "insert" ? 201 : 200,
      statusText: "OK",
    };
  }

  private normalizeInsert(input: Row): Row {
    const now = new Date().toISOString();
    const row: Row = { ...(DEFAULTS[this.table]?.() ?? {}), ...clone(input) };
    for (const key of Object.keys(row)) if (row[key] === undefined) delete row[key];
    const keys = pkOf(this.table);
    if (keys.length === 1 && keys[0] === "id" && row["id"] == null) row["id"] = newUuid();
    if (row["created_at"] == null && this.table !== "studio_settings") row["created_at"] = now;
    if (row["updated_at"] == null && !NO_UPDATED_AT.has(this.table)) row["updated_at"] = now;
    return row;
  }

  private execute(): DbResult {
    const table = this.table;
    if (this.mode === "select") {
      let rows = this.matching();
      const total = rows.length;
      for (const order of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const left = columnValue(a, order.column);
          const right = columnValue(b, order.column);
          if (left == null || right == null) {
            if (left == null && right == null) return 0;
            const nullsFirst = order.nullsFirst ?? !order.ascending;
            return (left == null ? -1 : 1) * (nullsFirst ? 1 : -1);
          }
          const diff = compare(left, right);
          return order.ascending ? diff : -diff;
        });
      }
      if (this.offsetValue) rows = rows.slice(this.offsetValue);
      if (this.limitValue != null) rows = rows.slice(0, this.limitValue);
      return this.finish(rows, total);
    }
    if (this.mode === "insert") {
      const created: Row[] = [];
      for (const input of this.payload) {
        const row = this.normalizeInsert(input);
        const key = rowKey(table, row);
        const existing = [...this.db.rows(table), ...created];
        if (existing.some((item) => rowKey(table, item) === key)) {
          return fail(`duplicate key value violates unique constraint "${table}_pkey"`, "23505");
        }
        for (const columns of UNIQUES[table] ?? []) {
          if (
            columns.every((column) => row[column] != null) &&
            existing.some((item) => columns.every((column) => looseEqual(item[column], row[column])))
          ) {
            return fail(`duplicate key value violates unique constraint "${table}_${columns.join("_")}_key"`, "23505");
          }
        }
        created.push(row);
      }
      for (const row of created) this.db.put(table, row);
      return this.finish(created, created.length);
    }
    if (this.mode === "upsert") {
      const out: Row[] = [];
      const conflict = this.onConflict ?? pkOf(table);
      for (const input of this.payload) {
        const existing = this.db
          .rows(table)
          .find((row) => conflict.every((column) => input[column] !== undefined && looseEqual(row[column], input[column])));
        if (existing) {
          if (this.ignoreDuplicates) continue;
          const merged: Row = { ...existing, ...clone(input) };
          if ("updated_at" in existing && input["updated_at"] === undefined) merged["updated_at"] = new Date().toISOString();
          this.db.put(table, merged, existing);
          out.push(merged);
        } else {
          const row = this.normalizeInsert(input);
          this.db.put(table, row);
          out.push(row);
        }
      }
      return this.finish(out, out.length);
    }
    if (this.mode === "update") {
      const updated: Row[] = [];
      for (const row of this.matching()) {
        const next: Row = { ...row, ...clone(this.patch) };
        if ("updated_at" in row && this.patch["updated_at"] === undefined) next["updated_at"] = new Date().toISOString();
        this.db.put(table, next, row);
        updated.push(next);
      }
      return this.finish(updated, updated.length);
    }
    const rows = this.matching();
    for (const row of rows) this.db.remove(table, row);
    return this.finish(rows, rows.length);
  }
}

export type RpcHandler = (db: DemoDb, args: Row) => unknown;
export type DemoSnapshot = Record<string, Row[]>;

export class DemoDb {
  private tables = new Map<string, Map<string, Row>>();
  rpcHandlers: Record<string, RpcHandler> = {};
  onMutate: ((table: string) => void) | null = null;

  constructor(snapshot?: DemoSnapshot) {
    if (snapshot) this.load(snapshot);
  }

  load(snapshot: DemoSnapshot): void {
    this.tables.clear();
    for (const [table, rows] of Object.entries(snapshot)) {
      const map = new Map<string, Row>();
      for (const row of rows) map.set(rowKey(table, row), clone(row));
      this.tables.set(table, map);
    }
  }

  /** Replaces one table wholesale without firing onMutate. */
  setTable(table: string, rows: Row[]): void {
    const map = new Map<string, Row>();
    for (const row of rows) map.set(rowKey(table, row), clone(row));
    this.tables.set(table, map);
  }

  snapshot(): DemoSnapshot {
    const out: DemoSnapshot = {};
    for (const [table, map] of this.tables) out[table] = [...map.values()].map((row) => clone(row));
    return out;
  }

  rows(table: string): Row[] {
    return [...(this.tables.get(table)?.values() ?? [])];
  }

  put(table: string, row: Row, previous?: Row): void {
    const map = this.tables.get(table) ?? new Map<string, Row>();
    if (previous) map.delete(rowKey(table, previous));
    map.set(rowKey(table, row), row);
    this.tables.set(table, map);
    this.onMutate?.(table);
  }

  remove(table: string, row: Row): void {
    this.tables.get(table)?.delete(rowKey(table, row));
    this.onMutate?.(table);
  }

  from(table: string): Query {
    return new Query(this, table);
  }

  rpc(name: string, args: Row = {}): PromiseLike<DbResult> & { single(): Promise<DbResult>; maybeSingle(): Promise<DbResult> } {
    const run = (): DbResult => {
      const handler = this.rpcHandlers[name];
      if (!handler) return { data: null, error: null, count: null, status: 200, statusText: "OK" };
      try {
        return { data: handler(this, args), error: null, count: null, status: 200, statusText: "OK" };
      } catch (error) {
        return fail(error instanceof Error ? error.message : "rpc failed", "P0001");
      }
    };
    return {
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
      single: async () => run(),
      maybeSingle: async () => run(),
    } as PromiseLike<DbResult> & { single(): Promise<DbResult>; maybeSingle(): Promise<DbResult> };
  }
}
