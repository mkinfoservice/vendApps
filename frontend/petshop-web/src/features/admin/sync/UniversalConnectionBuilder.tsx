import { useState, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UCBProvider = "MySql" | "Postgres" | "SqlServer" | "Firebird";

type MySqlSslMode   = "None" | "Preferred" | "Required";
type PgSslMode      = "Disable" | "Prefer" | "Require";
type FirebirdCharset = "UTF8" | "ISO8859_1" | "WIN1252" | "NONE";

type UCBFields = {
  host:      string;
  port:      string;
  database:  string;
  user:      string;
  password:  string;
  timeout:   string;
  sslMode:   string;
  encrypt:   boolean;
  trustCert: boolean;
  charset:   FirebirdCharset;
  useDocker: boolean;
};

// ── Defaults por provider ─────────────────────────────────────────────────────

const DEFAULTS: Record<UCBProvider, Partial<UCBFields>> = {
  MySql:     { port: "3306", sslMode: "Preferred", timeout: "5" },
  Postgres:  { port: "5432", sslMode: "Prefer",    timeout: "30" },
  SqlServer: { port: "1433", encrypt: false, trustCert: true, timeout: "30" },
  Firebird:  { port: "3050", charset: "UTF8", timeout: "15" },
};

const EMPTY: UCBFields = {
  host: "localhost", port: "", database: "", user: "", password: "",
  timeout: "", sslMode: "", encrypt: false, trustCert: true,
  charset: "UTF8", useDocker: false,
};

// ── Connection string builders ────────────────────────────────────────────────

export function buildMySqlConnectionString(params: {
  host: string; port?: string; database: string; user: string; password: string;
  sslMode?: MySqlSslMode; timeout?: string; useDocker?: boolean;
}): string {
  const h = resolveDockerHost(params.host, params.useDocker ?? false);
  return `Server=${h};Port=${params.port || "3306"};Database=${params.database};User ID=${params.user};Password=${params.password};SslMode=${params.sslMode || "Preferred"};Connection Timeout=${params.timeout || "5"};`;
}

export function buildPostgresConnectionString(params: {
  host: string; port?: string; database: string; user: string; password: string;
  sslMode?: PgSslMode; timeout?: string; useDocker?: boolean;
}): string {
  const h = resolveDockerHost(params.host, params.useDocker ?? false);
  return `Host=${h};Port=${params.port || "5432"};Database=${params.database};Username=${params.user};Password=${params.password};SSL Mode=${params.sslMode || "Prefer"};Timeout=${params.timeout || "30"};`;
}

export function buildSqlServerConnectionString(params: {
  host: string; port?: string; database: string; user: string; password: string;
  encrypt?: boolean; trustServerCertificate?: boolean; timeout?: string; useDocker?: boolean;
}): string {
  const h = resolveDockerHost(params.host, params.useDocker ?? false);
  const enc   = params.encrypt ?? false;
  const trust = params.trustServerCertificate ?? true;
  return `Server=${h},${params.port || "1433"};Database=${params.database};User Id=${params.user};Password=${params.password};Encrypt=${enc};TrustServerCertificate=${trust};Connection Timeout=${params.timeout || "30"};`;
}

export function buildFirebirdConnectionString(params: {
  host: string; port?: string; databasePath: string;
  user: string; password: string; charset?: string;
}): string {
  return `Database=${params.host}/${params.port || "3050"}:${params.databasePath};User=${params.user};Password=${params.password};Charset=${params.charset || "UTF8"};`;
}

function resolveDockerHost(host: string, useDocker: boolean): string {
  return useDocker && (host === "localhost" || host === "127.0.0.1")
    ? "host.docker.internal"
    : host;
}

function buildFromFields(provider: UCBProvider, f: UCBFields): string {
  switch (provider) {
    case "MySql":
      return buildMySqlConnectionString({ host: f.host, port: f.port, database: f.database, user: f.user, password: f.password, sslMode: f.sslMode as MySqlSslMode, timeout: f.timeout, useDocker: f.useDocker });
    case "Postgres":
      return buildPostgresConnectionString({ host: f.host, port: f.port, database: f.database, user: f.user, password: f.password, sslMode: f.sslMode as PgSslMode, timeout: f.timeout, useDocker: f.useDocker });
    case "SqlServer":
      return buildSqlServerConnectionString({ host: f.host, port: f.port, database: f.database, user: f.user, password: f.password, encrypt: f.encrypt, trustServerCertificate: f.trustCert, timeout: f.timeout, useDocker: f.useDocker });
    case "Firebird":
      return buildFirebirdConnectionString({ host: f.host, port: f.port, databasePath: f.database, user: f.user, password: f.password, charset: f.charset });
  }
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const iCls = () =>
  "w-full h-9 rounded-xl border px-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40";

const iStyle = (): React.CSSProperties => ({
  backgroundColor: "var(--surface-2)",
  borderColor: "var(--border)",
  color: "var(--text)",
});

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text",
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={iCls()}
      style={iStyle()}
      autoComplete={type === "password" ? "new-password" : "off"}
      spellCheck={false}
    />
  );
}

function Toggle({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs font-semibold transition-all"
      style={{ color: checked ? "#7c5cf8" : "var(--text-muted)" }}
    >
      <div
        className="relative w-8 h-4 rounded-full transition-colors shrink-0"
        style={{ backgroundColor: checked ? "#7c5cf8" : "var(--border)" }}
      >
        <div
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
        />
      </div>
      {label}
    </button>
  );
}

// ── UniversalConnectionBuilder ────────────────────────────────────────────────

export function UniversalConnectionBuilder({
  connectorType,
  value,
  onChange,
}: {
  connectorType: UCBProvider;
  value: string;
  onChange: (connectionString: string) => void;
}) {
  const [mode, setMode] = useState<"assisted" | "manual">("assisted");
  const [fields, setFields] = useState<UCBFields>(() => ({
    ...EMPTY,
    ...DEFAULTS[connectorType],
  }));
  const prevProvider = useRef<UCBProvider>(connectorType);

  // Reset campos ao trocar provider
  useEffect(() => {
    if (prevProvider.current !== connectorType) {
      prevProvider.current = connectorType;
      const next = { ...EMPTY, ...DEFAULTS[connectorType] };
      setFields(next);
      if (mode === "assisted") onChange(buildFromFields(connectorType, next));
    }
  }, [connectorType, mode, onChange]);

  // Reconstrói string ao mudar campos (modo assistido)
  useEffect(() => {
    if (mode === "assisted") {
      onChange(buildFromFields(connectorType, fields));
    }
  }, [fields, mode, connectorType, onChange]);

  function set<K extends keyof UCBFields>(k: K, v: UCBFields[K]) {
    setFields((p) => ({ ...p, [k]: v }));
  }

  function applyPreset(preset: "localhost" | "docker" | "lan") {
    const map: Record<string, Partial<UCBFields>> = {
      localhost: { host: "localhost", useDocker: false },
      docker:    { host: "localhost", useDocker: true },
      lan:       { host: "192.168.1.1", useDocker: false },
    };
    setFields((p) => ({ ...p, ...map[preset] }));
  }

  const isMysql    = connectorType === "MySql";
  const isPg       = connectorType === "Postgres";
  const isSqlSrv   = connectorType === "SqlServer";
  const isFirebird = connectorType === "Firebird";
  const hasSsl     = isMysql || isPg;
  const hasDocker  = !isFirebird;

  const sslOptions: string[] = isMysql
    ? ["None", "Preferred", "Required"]
    : ["Disable", "Prefer", "Require"];

  return (
    <div className="space-y-3">
      {/* Mode switcher */}
      <div
        className="flex rounded-xl overflow-hidden border text-xs font-semibold"
        style={{ borderColor: "var(--border)" }}
      >
        {(["assisted", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="flex-1 h-8 transition-all"
            style={{
              backgroundColor: mode === m ? "rgba(124,92,248,0.12)" : "var(--surface-2)",
              color: mode === m ? "#7c5cf8" : "var(--text-muted)",
            }}
          >
            {m === "assisted" ? "✦ Assistido (recomendado)" : "⌨ Editar manualmente"}
          </button>
        ))}
      </div>

      {/* ── Modo Assistido ── */}
      {mode === "assisted" && (
        <div className="space-y-2.5">
          {/* Presets */}
          <div className="flex gap-1.5 flex-wrap">
            {(["localhost", "docker", "lan"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className="h-6 px-2.5 rounded-lg border text-[11px] font-semibold transition-all hover:bg-[var(--surface)]"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                {p === "localhost" ? "Localhost" : p === "docker" ? "Docker" : "Rede local"}
              </button>
            ))}
          </div>

          {/* Host + Port */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="Host *">
                <TextInput
                  value={fields.host}
                  onChange={(v) => set("host", v)}
                  placeholder="localhost"
                />
              </Field>
            </div>
            <Field label="Porta">
              <TextInput
                value={fields.port}
                onChange={(v) => set("port", v)}
                placeholder={DEFAULTS[connectorType].port}
              />
            </Field>
          </div>

          {/* Database / Path */}
          <Field label={isFirebird ? "Caminho do banco (.fdb) *" : "Database *"}>
            <TextInput
              value={fields.database}
              onChange={(v) => set("database", v)}
              placeholder={isFirebird ? "/data/base.fdb" : "nome_do_banco"}
            />
          </Field>

          {/* User + Password */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Usuário *">
              <TextInput
                value={fields.user}
                onChange={(v) => set("user", v)}
                placeholder={isFirebird ? "SYSDBA" : "root"}
              />
            </Field>
            <Field label="Senha">
              <TextInput
                value={fields.password}
                onChange={(v) => set("password", v)}
                placeholder="••••••••"
                type="password"
              />
            </Field>
          </div>

          {/* SSL (MySQL / Postgres) */}
          {hasSsl && (
            <Field label="Modo SSL">
              <select
                value={fields.sslMode}
                onChange={(e) => set("sslMode", e.target.value)}
                className={iCls()}
                style={iStyle()}
              >
                {sslOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
          )}

          {/* SQL Server: Encrypt + TrustCert */}
          {isSqlSrv && (
            <div className="flex items-center gap-5 pt-0.5">
              <Toggle
                label="Encrypt"
                checked={fields.encrypt}
                onChange={(v) => set("encrypt", v)}
              />
              <Toggle
                label="Trust Certificate"
                checked={fields.trustCert}
                onChange={(v) => set("trustCert", v)}
              />
            </div>
          )}

          {/* Firebird: Charset */}
          {isFirebird && (
            <Field label="Charset">
              <select
                value={fields.charset}
                onChange={(e) => set("charset", e.target.value as FirebirdCharset)}
                className={iCls()}
                style={iStyle()}
              >
                {(["UTF8", "ISO8859_1", "WIN1252", "NONE"] as FirebirdCharset[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}

          {/* Timeout (exceto Firebird que não usa) */}
          {!isFirebird && (
            <Field label="Timeout (segundos)">
              <TextInput
                value={fields.timeout}
                onChange={(v) => set("timeout", v)}
                placeholder={DEFAULTS[connectorType].timeout}
              />
            </Field>
          )}

          {/* Docker toggle */}
          {hasDocker && (
            <Toggle
              label="Modo Docker (substitui localhost por host.docker.internal)"
              checked={fields.useDocker}
              onChange={(v) => set("useDocker", v)}
            />
          )}

          {/* Preview da string gerada */}
          <div
            className="rounded-xl border p-2.5 mt-1"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
          >
            <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
              String gerada:
            </p>
            <p
              className="text-[11px] break-all font-mono leading-relaxed"
              style={{ color: value ? "var(--text)" : "var(--text-muted)" }}
            >
              {value
                ? value.replace(/Password=[^;]+/, "Password=••••••••")
                : "Preencha os campos acima..."}
            </p>
          </div>
        </div>
      )}

      {/* ── Modo Manual ── */}
      {mode === "manual" && (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Server=localhost;Database=...;User ID=...;Password=...;"
            rows={4}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm font-mono outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40 resize-none"
            style={iStyle()}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Edite a connection string diretamente. O modo assistido será ignorado.
          </p>
        </div>
      )}
    </div>
  );
}
