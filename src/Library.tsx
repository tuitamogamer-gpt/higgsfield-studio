import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Maximize2,
  Minimize2,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Grid2X2,
  List,
  SlidersHorizontal,
  Clapperboard,
  Clock3,
  Copy,
  File,
  Film,
  Image,
  KeyRound,
  LoaderCircle,
  Music2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { mediaKind, mediaUrls } from "./Studio";
import "./library.css";

type Job = Record<string, any>;
type Props = {
  jobs: Job[];
  connected: boolean;
  onConnect: () => void;
  onCreate: () => void;
  onUpdate: (job: Job) => void;
  onDelete: (id: string) => void;
  onReuse?: (
    prompt: string,
    apiId?: string,
    input?: Record<string, unknown>,
  ) => void;
};
type Filter = "all" | "completed" | "pending" | "failed";
type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest";
function preference<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
): T {
  try {
    const stored = localStorage.getItem(key) as T;
    return values.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}
const generationInput = (job: Job): Record<string, unknown> | undefined =>
  job.input && typeof job.input === "object" && !Array.isArray(job.input)
    ? job.input
    : undefined;
const timestamp = (job: Job) => {
  const time = new Date(job.createdAt || job.created_at || "").getTime();
  return Number.isFinite(time) ? time : null;
};
const settingLabels: Record<string, string> = {
  aspect_ratio: "Format",
  resolution: "Rezolucija",
  duration_s: "Trajanje",
  duration: "Trajanje",
  seed: "Seed",
  negative_prompt: "Izbjegnuto u kadru",
  guidance_scale: "Snaga opisa",
  generate_audio: "Generirani zvuk",
  image_url: "Referentna slika",
  first_frame_url: "Početna slika",
  last_frame_url: "Završna slika",
  start_image_url: "Početna slika",
  end_image_url: "Završna slika",
  image_urls: "Referentne slike",
  video_url: "Referentni video",
  audio_url: "Referentni audio",
  output_format: "Format datoteke",
  num_images: "Broj slika",
  num_outputs: "Broj rezultata",
  fps: "Sličice u sekundi",
};
function settingValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Uključeno" : "Isključeno";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) {
      try {
        return new URL(value).hostname;
      } catch {
        return "Referentna poveznica";
      }
    }
    if (/^data:/i.test(value)) return "Učitana datoteka";
    return value.length > 160 ? value.slice(0, 157) + "…" : value;
  }
  if (Array.isArray(value))
    return `${value.length} ${value.length === 1 ? "stavka" : "stavki"}`;
  if (value && typeof value === "object")
    return `${Object.keys(value).length} postavki`;
  return "Automatski";
}
function inputSummary(job: Job): string[] {
  const input = generationInput(job);
  if (!input) return [];
  const duration = input.duration_s ?? input.duration;
  return [
    input.aspect_ratio,
    input.resolution,
    duration == null ? undefined : `${duration} s`,
  ].filter(
    (value): value is string =>
      typeof value === "string" && !!value && value.length < 30,
  );
}
function inputSettings(job: Job) {
  return Object.entries(generationInput(job) || {}).filter(
    ([name, value]) =>
      name !== "prompt" &&
      !/api.?key|token|secret|password|authorization/i.test(name) &&
      value !== null &&
      value !== undefined &&
      value !== "",
  );
}
const running = (job: Job) =>
  ["queued", "running", "pending", "processing"].includes(job.status);
const failed = (job: Job) =>
  ["failed", "canceled", "cancelled"].includes(job.status);
const status = (job: Job) =>
  job.status === "completed"
    ? "Dovršeno"
    : job.status === "queued"
      ? "U redu čekanja"
      : running(job)
        ? "U izradi"
        : failed(job)
          ? "Neuspjelo"
          : "Poslano";
const description = (job: Job) => job.prompt || job.input?.prompt || "";
const modelName = (job: Job) =>
  job.model ||
  job.apiId?.split("/")[1] ||
  job.api_id?.split("/")[1] ||
  "AI kreacija";
const dateLabel = (job: Job) => {
  const date = new Date(job.createdAt || job.created_at || "");
  return Number.isNaN(date.getTime())
    ? "Spremljeno u ovom pregledniku"
    : new Intl.DateTimeFormat("hr", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
};
const errorMessage = (job: Job) =>
  typeof job.error === "string"
    ? job.error
    : job.error?.message || "Model nije mogao dovršiti ovu kreaciju.";
function Sheet({
  label,
  children,
  onClose,
  expanded = false,
}: {
  label: string;
  children: ReactNode;
  onClose: () => void;
  expanded?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [
      ...(element.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]',
      ) || []),
    ];
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="lib-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={element}
        className={`lib-sheet ${expanded ? "lib-sheet-expanded" : ""}`}
        role="dialog"
        aria-label={label}
        aria-modal="true"
      >
        <button
          className="lib-close"
          aria-label="Zatvori detalje"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}

type ResultMedia = { url: string; type: string };
function ResultPreview({
  item,
  title,
  compact = false,
  revision = 0,
  busy = false,
  connected = false,
  onRefresh,
  onUnavailable,
}: {
  item: ResultMedia;
  title: string;
  compact?: boolean;
  revision?: number;
  busy?: boolean;
  connected?: boolean;
  onRefresh?: () => void;
  onUnavailable?: () => void;
}) {
  const [unavailable, setUnavailable] = useState(false);
  const kind = mediaKind(item);
  useEffect(() => setUnavailable(false), [item.url, revision]);
  const failed = () => {
    setUnavailable(true);
    onUnavailable?.();
  };
  if (unavailable)
    return (
      <div
        className={`lib-media-unavailable ${compact ? "is-compact" : ""}`}
        role="status"
      >
        <AlertTriangle size={compact ? 23 : 29} strokeWidth={1.5} />
        <strong>Pregled nije dostupan</strong>
        <p>
          {compact
            ? "Otvori detalje za provjeru poveznice."
            : "Datoteka se nije učitala. Poveznica može biti istekla ili trenutačno nedostupna."}
        </p>
        {!compact && onRefresh && (
          <button className="lib-secondary" disabled={busy} onClick={onRefresh}>
            {busy ? (
              <LoaderCircle size={15} className="lib-spin" />
            ) : connected ? (
              <RefreshCw size={15} />
            ) : (
              <KeyRound size={15} />
            )}{" "}
            {busy
              ? "Provjeravam rezultat…"
              : connected
                ? "Osvježi poveznice"
                : "Poveži ključ"}
          </button>
        )}
        {!compact && (
          <small>
            Osvježavanje provjerava postojeći rezultat i ne pokreće novo
            generiranje.
          </small>
        )}
      </div>
    );
  if (kind === "image")
    return (
      <img
        key={`${item.url}:${revision}`}
        src={item.url}
        alt={title}
        loading={compact ? "lazy" : "eager"}
        referrerPolicy="no-referrer"
        onError={failed}
      />
    );
  if (kind === "video")
    return (
      <video
        key={`${item.url}:${revision}`}
        src={item.url}
        controls={!compact}
        muted={compact}
        playsInline
        preload="metadata"
        onError={failed}
      />
    );
  if (kind === "audio")
    return (
      <div className="lib-audio-player">
        <Music2 size={34} />
        <audio
          key={`${item.url}:${revision}`}
          src={item.url}
          controls
          preload="metadata"
          onError={failed}
        />
      </div>
    );
  return (
    <div className="lib-file">
      <File size={27} />
      <span>{item.type || "Datoteka za preuzimanje"}</span>
    </div>
  );
}
function refreshError(error: unknown) {
  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  )
    return "Provjera traje predugo. Pokušaj ponovno; tvoja kreacija ostaje spremljena.";
  if (error instanceof TypeError)
    return "Nema veze s poslužiteljem. Provjeri internetsku vezu i pokušaj ponovno.";
  return error instanceof Error
    ? error.message
    : "Rezultat trenutačno nije dostupan. Pokušaj ponovno.";
}

export default function Library({
  jobs,
  connected,
  onConnect,
  onCreate,
  onUpdate,
  onDelete,
  onReuse,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    preference("hf-library-view", ["grid", "list"], "grid"),
  );
  const [sortMode, setSortMode] = useState<SortMode>(() =>
    preference("hf-library-sort", ["newest", "oldest"], "newest"),
  );
  useEffect(() => {
    try {
      localStorage.setItem("hf-library-view", viewMode);
    } catch {}
  }, [viewMode]);
  useEffect(() => {
    try {
      localStorage.setItem("hf-library-sort", sortMode);
    } catch {}
  }, [sortMode]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mediaRevision, setMediaRevision] = useState<Record<string, number>>(
    {},
  );
  const [mediaIssues, setMediaIssues] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setCopiedId(false);
    setExpanded(false);
    setError("");
  }, [selectedId]);
  const [retry, setRetry] = useState(0);
  const [paused, setPaused] = useState(false);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const callback = useRef(onUpdate);
  callback.current = onUpdate;
  const pending = jobs.filter(running);
  const selected = jobs.find((job) => job.id === selectedId);
  const toDelete = jobs.find((job) => job.id === deleteId);
  const completed = jobs.filter((job) => job.status === "completed").length;

  async function refresh(job: Job, signal?: AbortSignal) {
    const response = await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, {
      signal: signal || AbortSignal.timeout(20000),
    });
    let result: Job;
    try {
      result = await response.json();
    } catch {
      throw new Error(
        "Poslužitelj nije vratio valjan odgovor. Pokušaj ponovno.",
      );
    }
    if (!response.ok) {
      if (response.status === 401)
        window.dispatchEvent(new CustomEvent("pika-session-expired"));
      const messages: Record<number, string> = {
        401: "Sesija je istekla. Ponovno poveži svoj Pika ključ za provjeru ovog rezultata.",
        403: "Ovaj ključ nema pristup odabranoj kreaciji. Poveži ključ s kojim je izrađena.",
        404: "Ovaj zahtjev više nije dostupan na Pika računu. Spremljeni lokalni zapis je zadržan.",
        429: "Previše provjera odjednom. Pričekaj trenutak i pokušaj ponovno.",
      };
      throw new Error(
        messages[response.status] ||
          (response.status >= 500
            ? "Pika trenutačno nije dostupna. Pokušaj osvježiti rezultat malo kasnije."
            : result.message ||
              "Status trenutačno nije dostupan. Pokušaj ponovno."),
      );
    }
    const current = jobsRef.current.find((item) => item.id === job.id);
    if (current) callback.current({ ...current, ...result });
  }

  useEffect(() => {
    if (!connected || !pending.length) return;
    let alive = true,
      timer: ReturnType<typeof setTimeout>,
      failures = 0,
      nextIndex = 0;
    const controller = new AbortController();
    const started = Date.now();
    setPaused(false);
    const poll = async () => {
      const active = jobsRef.current.filter(running);
      if (!active.length || !alive) return;
      const batch = Array.from(
        { length: Math.min(12, active.length) },
        (_, index) => active[(nextIndex + index) % active.length],
      );
      nextIndex = (nextIndex + batch.length) % active.length;
      const settled = await Promise.allSettled(
        batch.map((job) =>
          refresh(
            job,
            AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
          ),
        ),
      );
      if (!alive) return;
      if (settled.every((result) => result.status === "rejected")) failures++;
      else failures = 0;
      if (failures >= 3 || Date.now() - started > 20 * 60 * 1000) {
        setPaused(true);
        return;
      }
      timer = setTimeout(poll, 6000);
    };
    timer = setTimeout(poll, 1200);
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [connected, pending.length > 0, retry]);

  const refreshOne = async (job: Job) => {
    if (!connected) {
      setSelectedId(null);
      onConnect();
      return;
    }
    setError("");
    setBusyIds((current) => [...current, job.id]);
    try {
      await refresh(job);
      setMediaRevision((previous) => ({
        ...previous,
        [job.id]: (previous[job.id] || 0) + 1,
      }));
      setMediaIssues((previous) => ({ ...previous, [job.id]: false }));
    } catch (error) {
      setError(refreshError(error));
    } finally {
      setBusyIds((current) => current.filter((id) => id !== job.id));
    }
  };
  const copyJobId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      setError(
        "Kopiranje nije dostupno. Označi ID zahtjeva i kopiraj ga ručno.",
      );
    }
  };
  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopiranje nije dostupno. Označi opis i kopiraj ga ručno.");
    }
  };
  const matches = jobs
    .filter(
      (job) =>
        (filter === "all" ||
          (filter === "completed" && job.status === "completed") ||
          (filter === "pending" && running(job)) ||
          (filter === "failed" && failed(job))) &&
        `${description(job)} ${modelName(job)} ${job.id}`
          .toLocaleLowerCase("hr")
          .includes(search.toLocaleLowerCase("hr")),
    )
    .sort((left, right) => {
      const first = timestamp(left),
        second = timestamp(right);
      if (first === null && second === null) return 0;
      if (first === null) return 1;
      if (second === null) return -1;
      return sortMode === "newest" ? second - first : first - second;
    });
  const filters: [Filter, string, number][] = [
    ["all", "Sve kreacije", jobs.length],
    ["completed", "Dovršeno", completed],
    ["pending", "U izradi", pending.length],
    ["failed", "Neuspjelo", jobs.filter(failed).length],
  ];

  return (
    <section className="lib-page">
      <div className="lib-heading">
        <div>
          <span className="lib-eyebrow">TVOJA OSOBNA KOLEKCIJA</span>
          <h1>
            Od ideje do <em>tvoje kreacije.</em>
          </h1>
          <p>Svi tvoji kadrovi, zvukovi i dobre ideje. Na jednom mjestu.</p>
        </div>
        <button className="lib-primary" onClick={onCreate}>
          <Plus size={17} /> Nova kreacija
        </button>
      </div>
      {jobs.length > 0 && (
        <div className="lib-overview">
          <span>
            <span className="lib-overview-icon">
              <Clapperboard size={17} />
            </span>
            <strong>{jobs.length}</strong>{" "}
            {new Intl.PluralRules("hr").select(jobs.length) === "few"
              ? "kreacije"
              : "kreacija"}{" "}
            u tvojoj kolekciji
          </span>
          <span>
            <i className="lib-status-dot" />
            Dovršeno: {completed}
            {pending.length > 0 && (
              <>
                {" "}
                <b>·</b> U izradi: {pending.length}
              </>
            )}
          </span>
        </div>
      )}
      {error && (
        <div role="alert" className="lib-alert">
          {error}
          <button aria-label="Zatvori poruku" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {jobs.length === 0 ? (
        <div className="lib-empty">
          <div className="lib-empty-art" aria-hidden="true">
            <div className="lib-film-frame lib-film-frame-back">
              <Film size={28} />
            </div>
            <div className="lib-film-frame">
              <Sparkles size={33} strokeWidth={1.3} />
              <span>01 / TVOJ PRVI KADAR</span>
            </div>
            <span className="lib-art-spark">✳</span>
          </div>
          <span className="lib-eyebrow">SVAKA PRIČA IMA SVOJ POČETAK</span>
          <h2>Ovdje će živjeti tvoje ideje.</h2>
          <p>
            Pretvori nekoliko riječi u nešto što se pamti.
            <br />
            Tvoja prva kreacija udaljena je samo jedan kadar.
          </p>
          <button className="lib-primary" onClick={onCreate}>
            Stvori svoj prvi video <ArrowUpRight size={17} />
          </button>
          <div className="lib-empty-steps">
            <span>
              <b>01</b> Opiši ideju
            </span>
            <i />
            <span>
              <b>02</b> Odaberi model
            </span>
            <i />
            <span>
              <b>03</b> Pokreni priču
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="lib-toolbar">
            <div className="lib-filters" aria-label="Filtriraj kreacije">
              {filters.map(([value, label, count]) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  className={filter === value ? "active" : ""}
                  onClick={() => setFilter(value)}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>
            <label className="lib-search">
              <Search size={16} />
              <input
                aria-label="Pretraži svoje kreacije"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pretraži svoje kreacije…"
              />
              {search && (
                <button
                  aria-label="Očisti pretragu kreacija"
                  onClick={() => setSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
          <div className="lib-display-toolbar">
            <span className="lib-results-count" role="status">
              {matches.length} od {jobs.length} kreacija
            </span>
            <div className="lib-display-actions">
              <label className="lib-sort">
                <span className="sr-only">Redoslijed kreacija</span>
                <select
                  aria-label="Redoslijed kreacija"
                  value={sortMode}
                  onChange={(event) =>
                    setSortMode(event.target.value as SortMode)
                  }
                >
                  <option value="newest">Najnovije prvo</option>
                  <option value="oldest">Najstarije prvo</option>
                </select>
                <ChevronDown size={13} />
              </label>
              <div className="lib-view-toggle" aria-label="Način prikaza">
                <button
                  aria-label="Prikaži kartice"
                  aria-pressed={viewMode === "grid"}
                  className={viewMode === "grid" ? "active" : ""}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid2X2 size={16} />
                </button>
                <button
                  aria-label="Prikaži popis"
                  aria-pressed={viewMode === "list"}
                  className={viewMode === "list" ? "active" : ""}
                  onClick={() => setViewMode("list")}
                >
                  <List size={17} />
                </button>
              </div>
            </div>
          </div>
          {pending.length > 0 && (
            <div className="lib-processing-note">
              {connected && !paused ? (
                <>
                  <LoaderCircle size={14} className="lib-spin" />
                  <span>
                    Pratimo tvoje kreacije. Dovršeni rezultati pojavit će se
                    automatski.
                  </span>
                </>
              ) : (
                <>
                  <Clock3 size={15} />
                  <span>
                    {connected
                      ? "Automatska provjera je pauzirana. Generiranje može i dalje biti u tijeku."
                      : "Poveži svoj ključ da osvježiš kreacije koje su u izradi."}
                  </span>
                  <button
                    onClick={() =>
                      connected ? setRetry((value) => value + 1) : onConnect()
                    }
                  >
                    {connected ? "Nastavi provjeru" : "Poveži ključ"}{" "}
                    <ArrowRight size={13} />
                  </button>
                </>
              )}
            </div>
          )}
          <div className={`lib-grid ${viewMode === "list" ? "lib-list" : ""}`}>
            {matches.map((job) => {
              const media = mediaUrls(job.output),
                first = media[0],
                kind = first ? mediaKind(first) : job.category;
              const Icon =
                kind === "audio"
                  ? Music2
                  : kind === "image"
                    ? Image
                    : kind === "file"
                      ? File
                      : Film;
              return (
                <article
                  className={`lib-card ${running(job) ? "lib-card-pending" : ""}`}
                  key={job.id}
                >
                  <button
                    className={`lib-cover ${first ? "has-media" : ""}`}
                    onClick={() => {
                      setSelectedId(job.id);
                      setCopied(false);
                    }}
                    aria-label={`Otvori kreaciju: ${description(job) || modelName(job)}`}
                  >
                    {first && (kind === "image" || kind === "video") ? (
                      <ResultPreview
                        item={first}
                        title={description(job) || "Generirani rezultat"}
                        compact
                        revision={mediaRevision[job.id] || 0}
                        onUnavailable={() =>
                          setMediaIssues((previous) =>
                            previous[job.id]
                              ? previous
                              : { ...previous, [job.id]: true },
                          )
                        }
                      />
                    ) : (
                      <div className="lib-cover-placeholder">
                        {running(job) ? (
                          <LoaderCircle
                            className="lib-spin"
                            size={34}
                            strokeWidth={1.3}
                          />
                        ) : (
                          <Icon size={38} strokeWidth={1.1} />
                        )}
                        <span>
                          {running(job)
                            ? "Tvoja ideja dobiva život"
                            : failed(job)
                              ? "Pokušaj s novom perspektivom"
                              : kind === "audio"
                                ? "Zvuk tvoje ideje"
                                : "Tvoj rezultat"}
                        </span>
                      </div>
                    )}
                    <span
                      className={`lib-status ${job.status === "completed" ? "is-complete" : failed(job) ? "is-failed" : "is-pending"}`}
                    >
                      {job.status === "completed" ? (
                        <Check size={11} />
                      ) : (
                        <span />
                      )}
                      {status(job)}
                    </span>
                    <span className="lib-cover-open">
                      <ArrowUpRight size={18} />
                    </span>
                    {media.length > 1 && (
                      <span className="lib-output-count">
                        {media.length} rezultata
                      </span>
                    )}
                  </button>
                  <div className="lib-card-body">
                    <span className="lib-card-model">
                      <Icon size={12} /> {modelName(job)}
                    </span>
                    <button
                      className="lib-card-title"
                      onClick={() => setSelectedId(job.id)}
                    >
                      {description(job) || "Nova perspektiva, tvoj potpis."}
                    </button>
                    {inputSummary(job).length > 0 && (
                      <div
                        className="lib-setting-chips"
                        aria-label="Postavke kreacije"
                      >
                        {inputSummary(job).map((value, index) => (
                          <span key={index}>{value}</span>
                        ))}
                      </div>
                    )}
                    {mediaIssues[job.id] && (
                      <button
                        className="lib-card-recover"
                        disabled={busyIds.includes(job.id)}
                        onClick={() => refreshOne(job)}
                      >
                        {busyIds.includes(job.id) ? (
                          <LoaderCircle className="lib-spin" size={13} />
                        ) : (
                          <RefreshCw size={13} />
                        )}{" "}
                        {busyIds.includes(job.id)
                          ? "Provjeravam…"
                          : connected
                            ? "Osvježi poveznice"
                            : "Poveži ključ za provjeru"}
                      </button>
                    )}
                    <div className="lib-card-bottom">
                      <span>{dateLabel(job)}</span>
                      <div>
                        {first && (
                          <a
                            href={first.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Preuzmi rezultat"
                            title="Preuzmi rezultat"
                          >
                            <ArrowDownToLine size={15} />
                          </a>
                        )}
                        <button
                          onClick={() => setDeleteId(job.id)}
                          aria-label="Ukloni kreaciju iz povijesti"
                          title="Ukloni iz povijesti"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {matches.length === 0 && (
            <div className="lib-no-results">
              <Search size={30} strokeWidth={1.3} />
              <h2>Nema kreacija za ovaj odabir.</h2>
              <p>Pokušaj s drugim pojmom ili pogledaj cijelu kolekciju.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Prikaži sve kreacije <ArrowRight size={15} />
              </button>
            </div>
          )}
          <div className="lib-storage-note">
            <ShieldIcon /> Povijest je spremljena u ovom pregledniku. Preuzmi
            rezultate koje želiš trajno sačuvati.
          </div>
        </>
      )}
      {selected && (
        <Sheet
          label="Detalji kreacije"
          expanded={expanded}
          onClose={() => setSelectedId(null)}
        >
          <div className="lib-detail-heading">
            <span className="lib-eyebrow">TVOJA KREACIJA</span>
            <h2>{modelName(selected)}</h2>
            <div>
              <span
                className={`lib-detail-status ${failed(selected) ? "is-failed" : ""}`}
              >
                {running(selected) ? (
                  <LoaderCircle size={13} className="lib-spin" />
                ) : selected.status === "completed" ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <Clock3 size={13} />
                )}
                {status(selected)}
              </span>
              <span>{dateLabel(selected)}</span>
            </div>
          </div>
          {mediaUrls(selected.output).some((item) =>
            ["image", "video"].includes(mediaKind(item)),
          ) && (
            <div className="lib-preview-toolbar">
              <span>
                {mediaUrls(selected.output).length}{" "}
                {new Intl.PluralRules("hr").select(
                  mediaUrls(selected.output).length,
                ) === "few"
                  ? "datoteke"
                  : "datoteka"}{" "}
                u rezultatu
              </span>
              <button
                aria-label={
                  expanded
                    ? "Vrati standardni pregled"
                    : "Povećaj pregled rezultata"
                }
                aria-pressed={expanded}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{" "}
                {expanded ? "Standardni prikaz" : "Veći pregled"}
              </button>
            </div>
          )}
          <div className="lib-detail-results">
            {mediaUrls(selected.output).map((item, index) => (
              <div className="lib-detail-result" key={item.url}>
                <ResultPreview
                  item={item}
                  title={`Generirani rezultat ${index + 1}`}
                  revision={mediaRevision[selected.id] || 0}
                  connected={connected}
                  busy={busyIds.includes(selected.id)}
                  onRefresh={() => refreshOne(selected)}
                  onUnavailable={() =>
                    setMediaIssues((previous) =>
                      previous[selected.id]
                        ? previous
                        : { ...previous, [selected.id]: true },
                    )
                  }
                />
                <a href={item.url} target="_blank" rel="noreferrer">
                  <ArrowDownToLine size={15} /> Preuzmi rezultat{" "}
                  {mediaUrls(selected.output).length > 1 ? index + 1 : ""}{" "}
                  <ArrowUpRight size={13} />
                </a>
              </div>
            ))}
          </div>
          {running(selected) && (
            <div className="lib-detail-pending">
              <LoaderCircle className="lib-spin" size={25} />
              <h3>Još malo i ideja postaje stvarnost.</h3>
              <p>
                {connected
                  ? "Status se automatski osvježava. Slobodno nastavi istraživati studio."
                  : "Ponovno poveži ključ za provjeru statusa ovog zahtjeva."}
              </p>
            </div>
          )}
          {failed(selected) && (
            <div className="lib-failed-message">
              <h3>Ovaj pokušaj nije uspio.</h3>
              <p>{errorMessage(selected)}</p>
            </div>
          )}
          {selected.status === "completed" &&
            !mediaUrls(selected.output).length && (
              <pre className="lib-text-result">
                {JSON.stringify(
                  selected.output || "Rezultat nema datoteku za preuzimanje.",
                  null,
                  2,
                )}
              </pre>
            )}
          {description(selected) && (
            <div className="lib-prompt">
              <div>
                <span>TVOJA IDEJA</span>
                <button onClick={() => copyPrompt(description(selected))}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Kopirano" : "Kopiraj opis"}
                </button>
              </div>
              <p>{description(selected)}</p>
            </div>
          )}
          {inputSettings(selected).length > 0 && (
            <section
              className="lib-input-settings"
              aria-label="Postavke generiranja"
            >
              <h3>
                <SlidersHorizontal size={14} /> Postavke generiranja
              </h3>
              <dl>
                {inputSettings(selected).map(([name, value]) => (
                  <div key={name}>
                    <dt>{settingLabels[name] || name.replaceAll("_", " ")}</dt>
                    <dd>
                      {(name === "duration_s" || name === "duration") &&
                      typeof value === "number"
                        ? `${value} s`
                        : settingValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p>
                Postavke se mogu otvoriti u studiju i prilagoditi prije novog
                generiranja.
              </p>
            </section>
          )}
          <div className="lib-job-meta">
            <span>
              Zahtjev <code>{selected.id}</code>
              <button
                className="lib-copy-id"
                aria-label="Kopiraj ID zahtjeva"
                onClick={() => copyJobId(selected.id)}
              >
                {copiedId ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedId ? "Kopirano" : "Kopiraj ID"}</span>
              </button>
            </span>
            {selected.billing?.state === "settled" &&
              Number.isFinite(selected.billing.charge_micro_usd) && (
                <span>
                  Naplaćeno{" "}
                  <strong>
                    ${(selected.billing.charge_micro_usd / 1000000).toFixed(3)}
                  </strong>
                </span>
              )}
          </div>
          <div className="lib-detail-actions">
            {onReuse &&
              (description(selected) || generationInput(selected)) && (
                <button
                  className="lib-primary"
                  onClick={() => {
                    onReuse(
                      description(selected),
                      selected.apiId || selected.api_id,
                      generationInput(selected)
                        ? structuredClone(generationInput(selected))
                        : undefined,
                    );
                    setSelectedId(null);
                  }}
                >
                  <Sparkles size={15} />{" "}
                  {generationInput(selected)
                    ? "Ponovno koristi postavke"
                    : "Koristi ovu ideju"}
                </button>
              )}
            <button
              className="lib-secondary"
              disabled={busyIds.includes(selected.id)}
              onClick={() => refreshOne(selected)}
            >
              {busyIds.includes(selected.id) ? (
                <LoaderCircle size={15} className="lib-spin" />
              ) : connected ? (
                <RefreshCw size={15} />
              ) : (
                <KeyRound size={15} />
              )}
              {connected ? "Osvježi status" : "Poveži ključ"}
            </button>
          </div>
          {error && (
            <p role="alert" className="lib-detail-error">
              {error}
            </p>
          )}
        </Sheet>
      )}
      {toDelete && (
        <Sheet label="Ukloni iz povijesti" onClose={() => setDeleteId(null)}>
          <div className="lib-delete-confirm">
            <span>
              <Trash2 size={24} />
            </span>
            <h2>Ukloniti iz tvoje kolekcije?</h2>
            <p>
              Ovo uklanja samo zapis iz ovog preglednika.{" "}
              {running(toDelete)
                ? "Generiranje se nastavlja na Pika računu i njegova naplata ostaje nepromijenjena."
                : "Rezultat na Pika računu ostaje nepromijenjen. Prvo preuzmi datoteku ako je želiš sačuvati."}
            </p>
            <div>
              <button
                className="lib-secondary"
                onClick={() => setDeleteId(null)}
              >
                Zadrži kreaciju
              </button>
              <button
                className="lib-delete-button"
                onClick={() => {
                  onDelete(toDelete.id);
                  setDeleteId(null);
                  if (selectedId === toDelete.id) setSelectedId(null);
                }}
              >
                Ukloni iz povijesti
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </section>
  );
}
function ShieldIcon() {
  return <Clapperboard size={13} />;
}
