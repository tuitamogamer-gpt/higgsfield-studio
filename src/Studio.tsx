import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clapperboard,
  Download,
  ImagePlus,
  LoaderCircle,
  Music2,
  Plus,
  ArrowRight,
  X,
  FileImage,
  RefreshCw,
  Settings2,
  Sparkles,
  Clock3,
  Copy,
  AlertTriangle,
  Video,
  WandSparkles,
  Bookmark,
  Save,
  Trash2,
  Pencil,
  Bell,
  BellRing,
} from "lucide-react";
import ModelPicker from "./ModelPicker";
import ReferenceUpload from "./ReferenceUpload";
import { isTerminalStatus, mediaKind, mediaUrls } from "./lib/media.ts";
import { formatUsd } from "./lib/pricing.ts";
import { prepareReferenceFile } from "./lib/reference.ts";
import { categoryLabel } from "./lib/catalog.ts";

type Json = Record<string, any>;
type Model = {
  api_id: string;
  name: string;
  category: string;
  function?: string;
  vendor: string;
  input_schema?: Json;
  display_pricing?: unknown;
};
type Props = {
  initialPrompt?: string;
  initialApiId?: string;
  initialInput?: Record<string, unknown>;
  connected: boolean;
  /** True while the studio is the visible page (enables image paste). */
  active?: boolean;
  /** Spendable balance in micro-USD, when known. */
  balanceMicro?: number | null;
  onConnect: () => void;
  onJobCreated: (job: any) => void;
  onRefreshBalance?: () => Promise<void> | void;
  /** Reports the job this studio is polling, so others can skip it. */
  onTrackingChange?: (jobId: string | null) => void;
};
const labels: Record<string, string> = {
  prompt: "Tvoja ideja",
  negative_prompt: "Što želiš izbjeći?",
  resolution: "Rezolucija",
  duration_s: "Trajanje (sekunde)",
  duration: "Trajanje",
  aspect_ratio: "Format",
  seed: "Seed",
  image: "Početna slika",
  first_frame_url: "Početna slika",
  last_frame_url: "Završna slika",
  image_url: "Početna slika",
  image_urls: "Referentne slike",
  video_url: "Video",
  audio_url: "Audio",
  generate_audio: "Generiraj zvuk",
  end_image_url: "Završna slika",
  start_image_url: "Početna slika",
  guidance_scale: "Snaga prompta",
  output_format: "Format datoteke",
};
const promptIdeas = [
  {
    label: "Filmski kadar",
    text: "Cinematic composition, subtle film grain, shallow depth of field.",
  },
  {
    label: "Zlatni sat",
    text: "Warm golden-hour light, soft shadows, delicate highlights.",
  },
  {
    label: "Usporeni pokret",
    text: "Slow, fluid motion with a smooth cinematic camera movement.",
  },
];
const audioPromptIdeas = [
  {
    label: "Ambijentalno",
    text: "Warm ambient textures with a spacious, atmospheric sound.",
  },
  {
    label: "Filmski zvuk",
    text: "A cinematic score with a gradual emotional build and rich orchestration.",
  },
  {
    label: "Bez vokala",
    text: "Instrumental only, without vocals or spoken words.",
  },
];
const examplePrompt =
  "A black sports car driving along a coastal road at sunset. The camera follows at a low angle, warm light gliding across the bodywork, waves breaking below. Cinematic, smooth and atmospheric.";
function referenceUrls(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).filter(
    (url): url is string => {
      try {
        const parsed = new URL(url);
        return (
          typeof url === "string" &&
          ["http:", "https:"].includes(parsed.protocol) &&
          !!parsed.hostname
        );
      } catch {
        return false;
      }
    },
  );
}
function ReferencePreview({
  url,
  type,
  onRemove,
  disabled,
}: {
  url: string;
  type: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div className="studio-reference">
      {type.startsWith("image") && !failed ? (
        <img
          src={url}
          alt="Referentna slika"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="studio-reference-icon">
          <FileImage size={22} />
        </span>
      )}
      <div>
        <strong>
          {type.startsWith("image")
            ? "Referentna slika"
            : type.startsWith("video")
              ? "Referentni video"
              : "Referentni audio"}
        </strong>
        <span>
          {failed
            ? "Pregled nije dostupan · provjeri poveznicu"
            : new URL(url).hostname}
        </span>
      </div>
      <button
        disabled={disabled}
        aria-label="Ukloni referencu"
        onClick={onRemove}
      >
        <X size={14} />
      </button>
    </div>
  );
}

type PendingGeneration = {
  fingerprint: string;
  id: string;
  apiId: string;
  input: Json;
  metadata: Json;
  maxCostMicroUsd?: number;
  createdAt: string;
};
type ActiveGeneration = {
  job: Json;
  metadata: Json;
  requestId: string;
  updatedAt: string;
};
function pendingRequest(): PendingGeneration | null {
  try {
    const raw = sessionStorage.getItem("hf-pending-request") || "";
    if (raw.length > 1200000) return null;
    const value = JSON.parse(raw);
    if (typeof value?.fingerprint !== "string" || typeof value?.id !== "string")
      return null;
    const original = JSON.parse(value.fingerprint);
    if (
      typeof original.apiId !== "string" ||
      !original.input ||
      typeof original.input !== "object" ||
      Array.isArray(original.input)
    )
      return null;
    const createdAt =
      typeof value.createdAt === "string"
        ? value.createdAt
        : new Date().toISOString();
    return {
      fingerprint: value.fingerprint,
      id: value.id,
      apiId: original.apiId,
      input: original.input,
      metadata:
        value.metadata && typeof value.metadata === "object"
          ? value.metadata
          : {
              apiId: original.apiId,
              input: original.input,
              prompt: original.input.prompt || "",
              createdAt,
            },
      ...(Number.isSafeInteger(value.maxCostMicroUsd) &&
      value.maxCostMicroUsd >= 0
        ? { maxCostMicroUsd: value.maxCostMicroUsd }
        : {}),
      createdAt,
    };
  } catch {
    return null;
  }
}
function generationRemoved(id: string) {
  try {
    const ids = JSON.parse(
      sessionStorage.getItem("hf-deleted-generations") || "[]",
    );
    return Array.isArray(ids) && ids.slice(-200).includes(id);
  } catch {
    return false;
  }
}
function activeGeneration(): ActiveGeneration | null {
  try {
    const raw = sessionStorage.getItem("hf-active-generation") || "";
    if (raw.length > 1200000) return null;
    const value = JSON.parse(raw);
    if (
      typeof value?.job?.id === "string" &&
      !generationRemoved(value.job.id) &&
      ["queued", "running"].includes(value.job.status) &&
      value.metadata &&
      typeof value.metadata.apiId === "string" &&
      value.metadata.input &&
      typeof value.metadata.input === "object"
    )
      return value;
  } catch {}
  return null;
}
function saveActive(job: Json, metadata: Json, requestId: string) {
  if (generationRemoved(job.id)) return;
  try {
    if (["queued", "running"].includes(job.status))
      sessionStorage.setItem(
        "hf-active-generation",
        JSON.stringify({
          job,
          metadata,
          requestId,
          updatedAt: new Date().toISOString(),
        }),
      );
    else {
      const previous = activeGeneration();
      if (previous?.job.id === job.id)
        sessionStorage.removeItem("hf-active-generation");
    }
  } catch {}
}
async function request(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(
        path === "/api/generate" ? 75000 : 30000,
      ),
      ...init,
    });
  } catch {
    throw new Error(
      "Veza s poslužiteljem je prekinuta. Ako si poslao generiranje, provjeri spremljeni zahtjev prije novog slanja.",
    );
  }
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("Poslužitelj nije dostupan. Pokušaj ponovno.");
  }
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/connect")
      window.dispatchEvent(new CustomEvent("pika-session-expired"));
    const error = Object.assign(
      new Error(data.message || "Zahtjev nije uspio. Pokušaj ponovno."),
      { code: data.code, job: data.job, status: response.status },
    );
    throw error;
  }
  return data;
}
const post = (path: string, data: Json) =>
  request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
function resolveSchema(value: Json, root: Json): Json {
  let current = value || {};
  if (current.$ref?.startsWith("#/"))
    current = {
      ...current.$ref
        .slice(2)
        .split("/")
        .reduce((obj: any, part: string) => obj?.[part], root),
      ...current,
    };
  const union = current.anyOf || current.oneOf;
  if (union) {
    const nonNull = union.filter((item: Json) => item.type !== "null");
    if (nonNull.length === 1)
      return {
        ...resolveSchema(nonNull[0], root),
        ...current,
        nullable: union.some((item: Json) => item.type === "null"),
      };
  }
  return current;
}
function schemaDefaults(schema: Json, prompt: string): Json {
  const value: Json = {};
  Object.entries(schema.properties || {}).forEach(([key, raw]) => {
    const field = resolveSchema(raw as Json, schema);
    if (field.default !== undefined && field.default !== null)
      value[key] = field.default;
  });
  if (schema.properties?.prompt && prompt) value.prompt = prompt;
  const resolution = resolveSchema(schema.properties?.resolution || {}, schema);
  if (resolution.enum?.includes("720p")) value.resolution = "720p";
  const aspect = resolveSchema(schema.properties?.aspect_ratio || {}, schema);
  if (aspect.enum?.includes("16:9")) value.aspect_ratio = "16:9";
  return value;
}

type Drafts = {
  activeApiId: string;
  prompt: string;
  models: Record<string, { input: Json; complex: Record<string, string> }>;
};
function readDrafts(): Drafts {
  try {
    const raw = sessionStorage.getItem("hf-studio-drafts") || "";
    if (raw.length > 600000) return { activeApiId: "", prompt: "", models: {} };
    const value = JSON.parse(raw);
    if (
      value &&
      typeof value.activeApiId === "string" &&
      typeof value.prompt === "string" &&
      value.models &&
      typeof value.models === "object" &&
      !Array.isArray(value.models)
    )
      return {
        ...value,
        models: Object.fromEntries(
          Object.entries(value.models)
            .filter(
              ([, entry]: [string, any]) =>
                entry &&
                entry.input &&
                typeof entry.input === "object" &&
                !Array.isArray(entry.input) &&
                entry.complex &&
                typeof entry.complex === "object",
            )
            .slice(-20),
        ),
      };
  } catch {}
  return { activeApiId: "", prompt: "", models: {} };
}
type Preset = {
  id: string;
  name: string;
  apiId: string;
  modelName: string;
  input: Json;
  updatedAt: string;
};
function savedPresets(): Preset[] {
  try {
    const value = JSON.parse(localStorage.getItem("hf-studio-presets") || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              typeof item.apiId === "string" &&
              item.input &&
              typeof item.input === "object" &&
              !Array.isArray(item.input),
          )
          .slice(0, 40)
      : [];
  } catch {
    return [];
  }
}
function complexValues(schema: Json, values: Json) {
  const result: Record<string, string> = {};
  Object.entries(schema.properties || {}).forEach(([key, field]) => {
    const resolved = resolveSchema(field as Json, schema);
    if (
      resolved.type === "object" ||
      resolved.type === "array" ||
      resolved.anyOf?.filter((part: Json) => part.type !== "null").length > 1
    )
      result[key] =
        values[key] === undefined ? "" : JSON.stringify(values[key], null, 2);
  });
  return result;
}
function supportedInput(schema: Json, values: Json) {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) =>
      Object.hasOwn(schema.properties || {}, key),
    ),
  );
}

export default function Studio({
  initialPrompt = "",
  initialApiId,
  initialInput,
  connected,
  active = true,
  balanceMicro = null,
  onConnect,
  onJobCreated,
  onRefreshBalance,
  onTrackingChange,
}: Props) {
  const [restoredGeneration] = useState(() =>
    !initialInput && !initialPrompt && !initialApiId
      ? activeGeneration()
      : null,
  );
  const [previousDrafts] = useState(readDrafts);
  const [draftSaved, setDraftSaved] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [apiId, setApiId] = useState(
    initialApiId || restoredGeneration?.metadata.apiId || "",
  );
  const [category, setCategory] = useState("video");
  const [detail, setDetail] = useState<Model | null>(null);
  const [input, setInput] = useState<Json>({});
  const [complex, setComplex] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [uploading, setUploading] = useState("");
  const [quote, setQuote] = useState<Json | null>(null);
  const [job, setJob] = useState<Json | null>(restoredGeneration?.job || null);
  const [advanced, setAdvanced] = useState(false);
  const [pollPaused, setPollPaused] = useState(false);
  const [pollVersion, setPollVersion] = useState(0);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [detailRetry, setDetailRetry] = useState(0);
  const promptDraft = useRef(
    typeof initialInput?.prompt === "string"
      ? initialInput.prompt
      : initialPrompt ||
          restoredGeneration?.metadata.prompt ||
          (!initialInput ? previousDrafts.prompt : ""),
  );
  const restoreInput = useRef<{ apiId?: string; input: Json } | null>(
    initialInput
      ? { apiId: initialApiId, input: initialInput }
      : restoredGeneration
        ? {
            apiId: restoredGeneration.metadata.apiId,
            input: restoredGeneration.metadata.input,
          }
        : null,
  );
  const [presets, setPresets] = useState<Preset[]>(savedPresets);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetNotice, setPresetNotice] = useState("");
  const [presetError, setPresetError] = useState("");
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  const modelDrafts = useRef<
    Record<string, { input: Json; complex: Record<string, string> }>
  >(previousDrafts.models);
  const [initialIdentity] = useState(pendingRequest);
  const identity = useRef({
    fingerprint: initialIdentity?.fingerprint || "",
    id: initialIdentity?.id || restoredGeneration?.requestId || "",
  });
  const [pending, setPending] = useState<PendingGeneration | null>(
    initialIdentity,
  );
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryRestored, setRecoveryRestored] = useState(false);
  const [recoveryStorageFailed, setRecoveryStorageFailed] = useState(false);
  const [recoveryDismiss, setRecoveryDismiss] = useState(false);
  const [requestCopied, setRequestCopied] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const callback = useRef(onJobCreated);
  const metadata = useRef<Json>(restoredGeneration?.metadata || {});
  callback.current = onJobCreated;
  if (detail && detail.api_id === apiId && !detailLoading)
    modelDrafts.current[apiId] = { input, complex };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    request("/api/catalog")
      .then((data) => {
        if (!alive) return;
        const live = (data.apis || []).filter(
          (model: Model) =>
            model.category !== "llm" && model.category !== "decision",
        );
        setModels(live);
        const desiredApiId = initialApiId || restoredGeneration?.metadata.apiId;
        if (
          desiredApiId &&
          !live.some((model: Model) => model.api_id === desiredApiId)
        ) {
          setApiId("");
          setDetail(null);
          setDetailLoading(false);
          setError(
            "Zatraženi model više nije dostupan. Odaberi drugi model prije nastavka; ništa nije poslano.",
          );
          return;
        }
        const selected =
          live.find((model: Model) => model.api_id === desiredApiId) ||
          (!initialPrompt && !initialInput
            ? live.find(
                (model: Model) => model.api_id === previousDrafts.activeApiId,
              )
            : undefined) ||
          live.find(
            (model: Model) => model.api_id === "pika/pika-2.5/text-to-video",
          ) ||
          live[0];
        if (selected) {
          setApiId(selected.api_id);
          setCategory(selected.category);
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [catalogRetry]);

  useEffect(() => {
    if (!initialApiId || !models.length) return;
    const selected = models.find((model) => model.api_id === initialApiId);
    if (selected) {
      setApiId(selected.api_id);
      setCategory(selected.category);
    }
  }, [initialApiId, models]);

  useEffect(() => {
    if (!apiId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    setQuote(null);
    setError("");
    setDetail(null);
    setComplex({});
    request("/api/catalog/detail?apiId=" + encodeURIComponent(apiId))
      .then((data) => {
        if (!alive) return;
        setDetail(data);
        const remembered = modelDrafts.current[apiId];
        const restored =
          restoreInput.current &&
          (!restoreInput.current.apiId || restoreInput.current.apiId === apiId)
            ? restoreInput.current.input
            : null;
        const defaults = {
          ...schemaDefaults(data.input_schema || {}, promptDraft.current),
          ...(restored
            ? supportedInput(data.input_schema || {}, restored)
            : remembered?.input),
        };
        if (data.input_schema?.properties?.prompt && !restored)
          defaults.prompt = promptDraft.current;
        if (restored) {
          promptDraft.current = defaults.prompt || "";
          restoreInput.current = null;
        }
        setInput(defaults);
        setComplex(
          restored
            ? complexValues(data.input_schema || {}, defaults)
            : remembered?.complex ||
                complexValues(data.input_schema || {}, defaults),
        );
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setDetailLoading(false));
    return () => {
      alive = false;
    };
  }, [apiId, detailRetry]);

  useEffect(() => {
    if (initialPrompt && detail?.input_schema?.properties?.prompt) {
      promptDraft.current = initialPrompt;
      setInput((old) => ({ ...old, prompt: initialPrompt }));
      setQuote(null);
    }
  }, [initialPrompt]);

  useEffect(() => {
    setDraftSaved(false);
    if (!detail || detail.api_id !== apiId || detailLoading || job) return;
    const timer = setTimeout(() => {
      try {
        const models = { ...modelDrafts.current };
        delete models[apiId];
        models[apiId] = { input, complex };
        let entries = Object.entries(models)
          .filter(([, value]) => JSON.stringify(value).length < 64000)
          .slice(-20);
        let value = JSON.stringify({
          activeApiId: apiId,
          prompt: promptDraft.current,
          models: Object.fromEntries(entries),
        });
        while (value.length > 500000 && entries.length > 1) {
          entries = entries.slice(1);
          value = JSON.stringify({
            activeApiId: apiId,
            prompt: promptDraft.current,
            models: Object.fromEntries(entries),
          });
        }
        if (value.length <= 500000) {
          sessionStorage.setItem("hf-studio-drafts", value);
          setDraftSaved(true);
        }
      } catch {
        /* Draft remains in memory if storage is unavailable. */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [apiId, detail, detailLoading, input, complex, job]);

  useEffect(() => {
    if (!job?.id || isTerminalStatus(job.status) || !connected) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    let failures = 0;
    setPollPaused(false);
    const poll = async () => {
      try {
        const update = await request("/api/jobs/" + encodeURIComponent(job.id));
        if (!alive) return;
        failures = 0;
        setJob(update);
        saveActive(update, metadata.current, identity.current.id);
        callback.current({ ...update, ...metadata.current });
        if (isTerminalStatus(update.status)) return;
      } catch (e: any) {
        if (!alive) return;
        failures++;
        if (failures >= 4) {
          setError(e.message);
          setPollPaused(true);
          return;
        }
      }
      if (Date.now() - started > 20 * 60 * 1000) {
        if (alive) setPollPaused(true);
        return;
      }
      if (alive) timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(
      poll,
      restoredGeneration?.job.id === job.id ? 300 : 2500,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [job?.id, connected, pollVersion]);

  const schema = detail?.input_schema || {};
  const fields = Object.entries(schema.properties || {}).sort(([a], [b]) =>
    a === "prompt" ? -1 : b === "prompt" ? 1 : 0,
  );
  const isRunning = !!job && !isTerminalStatus(job.status);
  const controlsLocked = !!busy || !!uploading || !!job || recoveryBusy;
  const trackingChange = useRef(onTrackingChange);
  trackingChange.current = onTrackingChange;
  useEffect(() => {
    trackingChange.current?.(
      job?.id && isRunning && connected && !pollPaused ? job.id : null,
    );
  }, [job?.id, isRunning, connected, pollPaused]);
  useEffect(() => () => trackingChange.current?.(null), []);
  const [notifyPermission, setNotifyPermission] = useState<string>(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);
  const refreshBalance = async () => {
    if (!onRefreshBalance || balanceRefreshing) return;
    setBalanceRefreshing(true);
    try {
      await onRefreshBalance();
    } finally {
      setBalanceRefreshing(false);
    }
  };
  const insufficientFunds =
    !!quote &&
    connected &&
    typeof balanceMicro === "number" &&
    Number.isSafeInteger(quote.micro_usd) &&
    quote.micro_usd > balanceMicro;
  const pageRef = useRef<HTMLDivElement>(null);
  const focusReturn = useRef<HTMLElement | null>(null);
  const quoteShownAt = useRef(0);
  useEffect(() => {
    quoteShownAt.current = quote ? Date.now() : 0;
  }, [quote]);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    if (!isRunning) return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [!!isRunning, job?.id]);
  const startedAt = Date.parse(
    metadata.current.createdAt || job?.created_at || "",
  );
  const elapsed = Number.isFinite(startedAt)
    ? Math.max(0, Math.floor((clock - startedAt) / 1000))
    : null;
  const elapsedLabel =
    elapsed === null
      ? ""
      : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const persistPending = (record: PendingGeneration | null) => {
    setPending(record);
    setRecoveryStorageFailed(false);
    try {
      if (record)
        sessionStorage.setItem("hf-pending-request", JSON.stringify(record));
      else sessionStorage.removeItem("hf-pending-request");
    } catch {
      if (record) setRecoveryStorageFailed(true);
    }
  };
  const acceptJob = (result: Json, record: PendingGeneration) => {
    metadata.current = record.metadata;
    identity.current = { fingerprint: record.fingerprint, id: record.id };
    persistPending(null);
    setRecoveryError("");
    setRecoveryNotice("");
    setRecoveryDismiss(false);
    setJob(result);
    saveActive(result, record.metadata, record.id);
    callback.current({ ...result, ...record.metadata });
    setPollPaused(false);
    // Accepted jobs may reserve funds; keep the visible balance current.
    void onRefreshBalance?.();
  };
  // Frees the studio for a new idea; the app keeps following this job.
  const detachJob = () => {
    if (!job) return;
    try {
      if (activeGeneration()?.job.id === job.id)
        sessionStorage.removeItem("hf-active-generation");
    } catch {}
    setJob(null);
    setQuote(null);
    setPollPaused(false);
    identity.current = { fingerprint: "", id: "" };
    metadata.current = {};
    setRecoveryNotice(
      "Kreacija se nastavlja u pozadini. Javit ćemo ti kad bude gotova, a rezultat će čekati u tvojim kreacijama.",
    );
  };
  const recover = async () => {
    if (!pending || recoveryBusy) return;
    if (!connected) {
      onConnect();
      return;
    }
    restorePending();
    setRecoveryError("");
    setRecoveryBusy(true);
    try {
      if (pending.maxCostMicroUsd === undefined) {
        const price = await post("/api/quote", {
          apiId: pending.apiId,
          input: pending.input,
        });
        persistPending({ ...pending, maxCostMicroUsd: price.micro_usd });
        return;
      }
      const result = await post("/api/generate", {
        apiId: pending.apiId,
        input: pending.input,
        requestId: pending.id,
        maxCostMicroUsd: pending.maxCostMicroUsd,
      });
      acceptJob(result, pending);
    } catch (e: any) {
      setRecoveryError(e.message);
      if (e.job?.id) acceptJob(e.job, pending);
      else if (e.code === "price_changed") {
        const { maxCostMicroUsd: _oldPrice, ...original } = pending;
        persistPending(original);
      }
      // A rejected recovery does not prove the original request was rejected.
      // Preserve its ID after authentication, balance, or catalog failures.
    } finally {
      setRecoveryBusy(false);
    }
  };
  const restorePending = () => {
    if (!pending || recoveryBusy || job) return;
    const model = models.find((model) => model.api_id === pending.apiId);
    if (!model) {
      setRecoveryError(
        "Izvorni model više nije u katalogu. Spremljeni zahtjev i dalje možeš provjeriti istim ID-jem.",
      );
      return;
    }
    setRecoveryError("");
    setQuote(null);
    setError("");
    setRecoveryRestored(true);
    promptDraft.current = pending.input.prompt || "";
    if (apiId === pending.apiId && detail && !detailLoading) {
      setInput({ ...pending.input });
      setComplex(complexValues(schema, pending.input));
    } else {
      restoreInput.current = { apiId: pending.apiId, input: pending.input };
      setCategory(model.category);
      setApiId(pending.apiId);
    }
  };
  const requiredMissing = (schema.required || []).filter((key: string) => {
    const value = Object.hasOwn(complex, key) ? complex[key] : input[key];
    return value == null || (typeof value === "string" && !value.trim());
  });
  const updateInput = (key: string, value: any) => {
    if (key === "prompt") promptDraft.current = value || "";
    setInput((old) => ({ ...old, [key]: value }));
    setQuote(null);
    setError("");
  };
  const payload = (validateRequired = true) => {
    const values = { ...input };
    for (const [key, value] of Object.entries(complex)) {
      if (!value.trim()) delete values[key];
      else {
        try {
          values[key] = JSON.parse(value);
        } catch {
          throw new Error(
            `Polje „${labels[key] || key}” mora sadržavati valjani JSON.`,
          );
        }
      }
    }
    Object.entries(values).forEach(([key, value]) => {
      if (typeof value === "string") values[key] = value.trim();
      if (values[key] === "" || value === undefined) delete values[key];
    });
    for (const key of validateRequired ? schema.required || [] : [])
      if (
        values[key] === undefined ||
        values[key] === null ||
        values[key] === ""
      )
        throw new Error(`Ispuni obavezno polje: ${labels[key] || key}.`);
    return values;
  };
  const persistPresets = (next: Preset[], notice: string) => {
    setPresets(next);
    setPresetError("");
    try {
      localStorage.setItem("hf-studio-presets", JSON.stringify(next));
      setPresetNotice(notice);
    } catch {
      setPresetNotice(
        "Postavke su dostupne do zatvaranja stranice. Preglednik nije dopustio trajnu pohranu.",
      );
    }
  };
  const savePreset = () => {
    setPresetError("");
    setPresetNotice("");
    const name = presetName.trim();
    if (!name) {
      setPresetError("Daj naziv svojim postavkama.");
      return;
    }
    if (
      presets.some(
        (preset) =>
          preset.id !== editingPreset &&
          preset.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      setPresetError(
        "Već postoji predložak s tim nazivom. Odaberi drugi naziv.",
      );
      return;
    }
    if (editingPreset) {
      persistPresets(
        presets.map((preset) =>
          preset.id === editingPreset
            ? { ...preset, name, updatedAt: new Date().toISOString() }
            : preset,
        ),
        "Naziv je ažuriran.",
      );
      setEditingPreset(null);
      setPresetName("");
      return;
    }
    if (!detail || detailLoading || controlsLocked) return;
    if (presets.length >= 40) {
      setPresetError(
        "Možeš spremiti do 40 predložaka. Ukloni neki koji više ne koristiš.",
      );
      return;
    }
    try {
      const values = payload(false);
      persistPresets(
        [
          {
            id: crypto.randomUUID(),
            name,
            apiId,
            modelName: detail.name,
            input: values,
            updatedAt: new Date().toISOString(),
          },
          ...presets,
        ],
        "Model, opis i postavke su spremljeni.",
      );
      setPresetName("");
    } catch (error) {
      setPresetError((error as Error).message);
    }
  };
  const applyPreset = (preset: Preset) => {
    if (controlsLocked) return;
    const model = models.find((model) => model.api_id === preset.apiId);
    if (!model) {
      setPresetError("Ovaj model više nije dostupan u aktualnom katalogu.");
      return;
    }
    setPresetError("");
    setPresetNotice(
      `Primijenjeno: ${preset.name}. Provjeri postavke i novu cijenu.`,
    );
    setQuote(null);
    setError("");
    setAdvanced(false);
    promptDraft.current =
      typeof preset.input.prompt === "string" ? preset.input.prompt : "";
    if (preset.apiId === apiId && detail && !detailLoading) {
      const values = {
        ...schemaDefaults(schema, ""),
        ...supportedInput(schema, preset.input),
      };
      setInput(values);
      setComplex(complexValues(schema, values));
    } else {
      restoreInput.current = { apiId: preset.apiId, input: preset.input };
      setCategory(model.category);
      setApiId(preset.apiId);
    }
  };
  const price = async () => {
    setError("");
    setBusy("quote");
    try {
      setQuote(await post("/api/quote", { apiId, input: payload() }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const generate = async () => {
    if (pending) {
      setRecoveryError(
        "Najprije provjeri prethodni zahtjev. Novi zahtjev nije poslan.",
      );
      return;
    }
    if (!connected) {
      onConnect();
      return;
    }
    if (!quote) return;
    setError("");
    setBusy("generate");
    let record: PendingGeneration | null = null;
    try {
      const values = payload();
      const fingerprint = JSON.stringify({ apiId, input: values });
      const createdAt = new Date().toISOString();
      record = {
        fingerprint,
        id: crypto.randomUUID(),
        apiId,
        input: values,
        maxCostMicroUsd: quote.micro_usd,
        createdAt,
        metadata: {
          prompt: values.prompt || "",
          input: values,
          model: detail?.name,
          apiId,
          category,
          createdAt,
        },
      };
      identity.current = { fingerprint, id: record.id };
      metadata.current = record.metadata;
      persistPending(record);
      const result = await post("/api/generate", {
        apiId,
        input: values,
        requestId: record.id,
        maxCostMicroUsd: record.maxCostMicroUsd,
      });
      acceptJob(result, record);
    } catch (e: any) {
      setError(e.message);
      if (e.code === "price_changed") setQuote(null);
      if (record && e.job?.id) acceptJob(e.job, record);
      else if (e.status >= 400 && e.status < 500 && e.status !== 408) {
        persistPending(null);
        identity.current = { fingerprint: "", id: "" };
        setQuote(null);
      }
    } finally {
      setBusy("");
    }
  };
  const upload = async (key: string, file?: File) => {
    if (!file) return;
    if (!connected) {
      onConnect();
      return;
    }
    const limitMb = file.type.startsWith("video/") ? 50 : 20;
    if (file.size > limitMb * 1024 * 1024) {
      setError(
        `Datoteka je prevelika. Najveća veličina za ovu vrstu je ${limitMb} MB.`,
      );
      return;
    }
    setUploading(key);
    setError("");
    try {
      const result = await post("/api/uploads/prepare", {
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      // A File body has an exact byte length; the browser sets its signed
      // Content-Length itself. Files go directly to storage, outside API limits.
      const headers = Object.fromEntries(
        Object.entries(result.headers as Record<string, string>).filter(
          ([name]) => name.toLowerCase() !== "content-length",
        ),
      );
      let stored: Response;
      try {
        stored = await fetch(result.uploadUrl, {
          method: "PUT",
          headers,
          body: file,
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: AbortSignal.timeout(180000),
        });
      } catch {
        throw new Error(
          "Prijenos datoteke nije uspio. Provjeri vezu i pokušaj ponovno ili zalijepi javni URL datoteke.",
        );
      }
      if (!stored.ok)
        throw new Error(
          "Pohrana nije prihvatila datoteku. Pokušaj ponovno odabrati datoteku ili zalijepi njezin javni URL.",
        );
      if (Object.hasOwn(complex, key)) {
        let previous: any[] = [];
        try {
          previous = complex[key] ? JSON.parse(complex[key]) : [];
        } catch {
          /* Start a valid array after upload. */
        }
        setComplex((old) => ({
          ...old,
          [key]: JSON.stringify(
            [...(Array.isArray(previous) ? previous : []), result.url],
            null,
            2,
          ),
        }));
        setQuote(null);
      } else updateInput(key, result.url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading("");
    }
  };
  const chooseCategory = (value: string) => {
    setCategory(value);
    const choice =
      models.find(
        (model) =>
          model.category === value && model.function?.startsWith("text-to-"),
      ) || models.find((model) => model.category === value);
    if (choice) setApiId(choice.api_id);
  };
  const mediaField = (key: string, definition: Json) => {
    const mediaKinds =
      definition.media_kinds || definition.items?.media_kinds || [];
    const media =
      mediaKinds.length > 0 ||
      (/image|video|audio|reference|frame/.test(key) &&
        (key.includes("url") || definition.format === "uri"));
    const accept =
      mediaKinds.includes("video") || /video/.test(key)
        ? "video/*"
        : mediaKinds.includes("audio") || /audio/.test(key)
          ? "audio/*"
          : "image/*";
    return { media, accept };
  };
  const pasteFiles = (files: File[]) => {
    if (!detail || detailLoading || controlsLocked) {
      setError(
        "Pričekaj da studio bude spreman, zatim ponovno zalijepi datoteku.",
      );
      return;
    }
    if (files.length !== 1) {
      setError(
        "Zalijepi jednu datoteku. Više referenci možeš dodati jednu po jednu.",
      );
      return;
    }
    const targets = Object.entries(schema.properties || {})
      .map(([key, raw]) => ({
        key,
        ...mediaField(key, resolveSchema(raw as Json, schema)),
        filled:
          !Object.hasOwn(complex, key) &&
          typeof input[key] === "string" &&
          !!input[key].trim(),
      }))
      .filter((target) => target.media);
    if (!targets.length) {
      setError(
        "Odabrani model ne prima referentne datoteke. Odaberi model koji koristi sliku, video ili audio.",
      );
      return;
    }
    // Fill an empty matching field first; otherwise replace the first match.
    let firstError = "";
    for (const target of [
      ...targets.filter((target) => !target.filled),
      ...targets.filter((target) => target.filled),
    ]) {
      const prepared = prepareReferenceFile(files[0], target.accept);
      if (prepared.file) {
        void upload(target.key, prepared.file);
        return;
      }
      firstError ||= prepared.error;
    }
    setError(firstError);
  };
  const pasteRef = useRef(pasteFiles);
  pasteRef.current = pasteFiles;
  useEffect(() => {
    if (!active) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files || []);
      if (!files.length || document.querySelector('[role="dialog"]')) return;
      const target = event.target instanceof Element ? event.target : null;
      // Keep normal text pasting inside fields untouched.
      if (
        target?.closest("input, textarea, [contenteditable='true']") &&
        event.clipboardData?.types.includes("text/plain")
      )
        return;
      event.preventDefault();
      pasteRef.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [active]);
  const field = ([key, raw]: [string, unknown]) => {
    const definition = resolveSchema(raw as Json, schema);
    const required = schema.required?.includes(key);
    const isComplex = Object.hasOwn(complex, key);
    const { media, accept: acceptedMedia } = mediaField(key, definition);
    const id = `studio-field-${key}`;
    let references: string[] = [];
    if (media) {
      try {
        references = referenceUrls(
          isComplex ? JSON.parse(complex[key] || "[]") : input[key],
        );
      } catch {}
    }

    return (
      <div
        className={`studio-field ${key === "prompt" || isComplex || media || key === "negative_prompt" ? "studio-field-wide" : ""}`}
        key={key}
      >
        <label htmlFor={id}>
          {labels[key] || definition.title || key.replaceAll("_", " ")}
          {required && <span className="studio-required"> *</span>}
        </label>
        {definition.enum ? (
          <div className="studio-select-wrap">
            <select
              id={id}
              disabled={controlsLocked}
              aria-required={required || undefined}
              value={input[key] ?? ""}
              onChange={(event) =>
                updateInput(
                  key,
                  definition.enum.find(
                    (v: any) => String(v) === event.target.value,
                  ) ?? undefined,
                )
              }
            >
              <option value="" disabled={required}>
                {required ? "Odaberi vrijednost…" : "Automatski"}
              </option>
              {definition.enum.map((option: any) => (
                <option key={String(option)} value={String(option)}>
                  {String(option)}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        ) : definition.type === "boolean" ? (
          <label className="studio-switch-row">
            <input
              id={id}
              disabled={controlsLocked}
              aria-required={required || undefined}
              type="checkbox"
              checked={!!input[key]}
              onChange={(event) => updateInput(key, event.target.checked)}
            />
            <span>{input[key] ? "Uključeno" : "Isključeno"}</span>
          </label>
        ) : isComplex ? (
          <textarea
            id={id}
            disabled={controlsLocked}
            aria-required={required || undefined}
            className="studio-json"
            rows={4}
            value={complex[key]}
            placeholder={definition.type === "array" ? "[ ]" : "{ }"}
            onChange={(event) => {
              setComplex((old) => ({ ...old, [key]: event.target.value }));
              setQuote(null);
            }}
          />
        ) : key === "prompt" ||
          key.includes("prompt") ||
          (definition.type === "string" &&
            (definition.maxLength || 0) > 300) ? (
          <div className="studio-prompt-wrap">
            <textarea
              id={id}
              disabled={controlsLocked}
              aria-required={required || undefined}
              rows={key === "prompt" ? 5 : 3}
              value={input[key] ?? ""}
              placeholder={
                key === "prompt"
                  ? "Opiši kadar, pokret, svjetlo i atmosferu. Tvoja ideja počinje ovdje…"
                  : "Mutno, loša kvaliteta, neželjeni detalji…"
              }
              maxLength={definition.maxLength}
              onChange={(event) => updateInput(key, event.target.value)}
            />
            {key === "prompt" && (
              <span className="studio-prompt-count">
                {(input[key] || "").length}
                {definition.maxLength ? ` / ${definition.maxLength}` : ""}
              </span>
            )}
          </div>
        ) : (
          <input
            id={id}
            disabled={controlsLocked}
            aria-required={required || undefined}
            type={
              definition.type === "number" || definition.type === "integer"
                ? "number"
                : "text"
            }
            min={definition.minimum}
            max={definition.maximum}
            step={definition.type === "integer" ? 1 : "any"}
            value={input[key] ?? ""}
            placeholder={
              media
                ? "https://…"
                : definition.default == null
                  ? "Automatski"
                  : String(definition.default)
            }
            onChange={(event) =>
              updateInput(
                key,
                event.target.value === ""
                  ? undefined
                  : definition.type === "number" ||
                      definition.type === "integer"
                    ? Number(event.target.value)
                    : event.target.value,
              )
            }
          />
        )}
        {key === "prompt" && (
          <div className="studio-prompt-tools">
            <div className="studio-prompt-tools-title">
              <span>DONESI JOŠ MALO ATMOSFERE</span>
              {!input.prompt?.trim() && (
                <button
                  disabled={controlsLocked}
                  onClick={() =>
                    updateInput(
                      "prompt",
                      category === "audio"
                        ? "A warm, cinematic instrumental track with gentle piano, atmospheric strings and a slow emotional build. Calm, hopeful, without vocals."
                        : category === "image"
                          ? "An editorial photograph of a black sports car parked beside a winding coastal road at sunset, warm light reflecting on the bodywork, cinematic composition."
                          : examplePrompt,
                    )
                  }
                >
                  Isprobaj primjer <ArrowUpRight size={12} />
                </button>
              )}
            </div>
            <div className="studio-prompt-chips">
              {(category === "audio" ? audioPromptIdeas : promptIdeas)
                .filter(
                  (idea) =>
                    category !== "image" || idea.label !== "Usporeni pokret",
                )
                .map((idea) => (
                  <button
                    className="studio-prompt-chip"
                    key={idea.label}
                    disabled={
                      controlsLocked || input.prompt?.includes(idea.text)
                    }
                    onClick={() =>
                      updateInput(
                        "prompt",
                        [input.prompt?.trim(), idea.text]
                          .filter(Boolean)
                          .join(" "),
                      )
                    }
                  >
                    {input.prompt?.includes(idea.text) ? (
                      <Check size={12} />
                    ) : (
                      <Plus size={12} />
                    )}{" "}
                    {idea.label}
                  </button>
                ))}
            </div>
          </div>
        )}
        {media && references.length > 0 && (
          <div className="studio-references">
            {references.slice(0, 4).map((url) => (
              <ReferencePreview
                key={url}
                url={url}
                type={acceptedMedia}
                disabled={controlsLocked}
                onRemove={() => {
                  if (isComplex) {
                    setComplex((old) => ({
                      ...old,
                      [key]: JSON.stringify(
                        references.filter((ref) => ref !== url),
                      ),
                    }));
                    setQuote(null);
                  } else updateInput(key, "");
                }}
              />
            ))}
          </div>
        )}
        {media && (
          <ReferenceUpload
            accept={acceptedMedia}
            disabled={controlsLocked}
            uploading={uploading === key}
            pasteHint={active && acceptedMedia === "image/*"}
            onFile={(file) => void upload(key, file)}
          />
        )}
        {isComplex && (
          <span className="studio-field-help">
            JSON {definition.type === "array" ? "lista" : "objekt"} ·{" "}
            {definition.description || "Prati strukturu odabranog modela."}
          </span>
        )}
      </div>
    );
  };
  const actionDisabled =
    !!busy ||
    !!uploading ||
    loading ||
    detailLoading ||
    !detail ||
    requiredMissing.length > 0 ||
    !!pending ||
    recoveryBusy ||
    !!job ||
    insufficientFunds;
  const runPrimaryAction = () => {
    // Fields are disabled while busy; remember where to return focus.
    const focused = document.activeElement;
    focusReturn.current =
      focused instanceof HTMLElement && focused !== document.body
        ? focused
        : null;
    void (quote ? generate() : price());
  };
  const shortcutKey = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const shortcut = useRef<(event: KeyboardEvent) => void>(() => {});
  shortcut.current = (event) => {
    if (
      event.key !== "Enter" ||
      !(event.metaKey || event.ctrlKey) ||
      event.isComposing ||
      event.defaultPrevented ||
      document.querySelector('[role="dialog"]')
    )
      return;
    const target = event.target instanceof Node ? event.target : null;
    if (target !== document.body && !pageRef.current?.contains(target)) return;
    event.preventDefault();
    if (actionDisabled) return;
    // A paid submit needs a deliberate second press after the price appears.
    if (quote && Date.now() - quoteShownAt.current < 700) return;
    runPrimaryAction();
  };
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => shortcut.current(event);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
  useEffect(() => {
    if (busy) return;
    const element = focusReturn.current;
    focusReturn.current = null;
    if (
      element?.isConnected &&
      document.activeElement === document.body &&
      !element.matches(":disabled")
    )
      element.focus({ preventScroll: true });
  }, [busy]);
  const mainFields = fields.filter(
    ([key]) => !["seed", "negative_prompt", "guidance_scale"].includes(key),
  );
  const extraFields = fields.filter(([key]) =>
    ["seed", "negative_prompt", "guidance_scale"].includes(key),
  );
  const media = mediaUrls(job?.output);
  const ratioParts = String(input.aspect_ratio || "16:9")
    .split(":")
    .map(Number);
  const canvasRatio =
    ratioParts.length === 2 &&
    ratioParts.every((value) => Number.isFinite(value) && value > 0)
      ? ratioParts[0] / ratioParts[1]
      : 16 / 9;
  const categories = [...new Set(models.map((model) => model.category))];
  const mediaLabel =
    category === "image" ? "sliku" : category === "video" ? "video" : "sadržaj";

  return (
    <div className="studio-page" ref={pageRef}>
      <div className="studio-title">
        <div>
          <div className="studio-eyebrow">
            <span /> TVOJ KREATIVNI PROSTOR
          </div>
          <h1>
            Od ideje do <span>prvog kadra.</span>
          </h1>
          <p>Odaberi model, opiši svoju viziju i prepusti ostalo mašti.</p>
        </div>
        <span className="studio-powered studio-draft-status" role="status">
          {draftSaved ? (
            <>
              <Check size={13} /> Nacrt spremljen u ovoj kartici
            </>
          ) : (
            <>
              Pokreće Pika API <ArrowUpRight size={13} />
            </>
          )}
        </span>
      </div>
      {pending && !busy && (
        <section
          className="studio-recovery"
          role="region"
          aria-label="Oporavak prethodnog zahtjeva"
        >
          <div className="studio-recovery-heading">
            <span>
              <AlertTriangle size={19} />
            </span>
            <div>
              <h2>Prethodni zahtjev treba provjeru.</h2>
              <p>
                Veza je prekinuta prije potvrde. Generiranje je možda već
                započelo.
              </p>
            </div>
          </div>
          <div className="studio-recovery-summary">
            <strong>{pending.metadata.model || pending.apiId}</strong>
            <p>
              {pending.input.prompt ||
                "Spremljene ulazne postavke prethodnog zahtjeva."}
            </p>
            <div className="studio-recovery-id">
              <code>{pending.id}</code>
              <button
                className="studio-copy-request"
                disabled={recoveryBusy}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pending.id);
                    setRequestCopied(true);
                    setTimeout(() => setRequestCopied(false), 2000);
                  } catch {
                    setRecoveryError(
                      "Kopiranje nije dostupno. Označi prikazani ID i kopiraj ga ručno.",
                    );
                  }
                }}
              >
                {requestCopied ? <Check size={12} /> : <Copy size={12} />}{" "}
                {requestCopied ? "ID kopiran" : "Kopiraj ID"}
              </button>
            </div>
          </div>
          <p className="studio-recovery-explanation">
            Oporavak šalje izvorne postavke s istim ID-jem. Ako prvi zahtjev
            nije zaprimljen, pokrenut će generiranje
            {pending.maxCostMicroUsd !== undefined
              ? ` po potvrđenoj cijeni do ${formatUsd(pending.maxCostMicroUsd)}`
              : ""}
            . Novi zahtjevi ostaju pauzirani do provjere.
          </p>
          {recoveryError && (
            <p className="studio-recovery-error" role="alert">
              {recoveryError}
            </p>
          )}
          {recoveryStorageFailed && (
            <p className="studio-recovery-error" role="alert">
              Preglednik nije dopustio spremanje oporavka. Ostavi ovu karticu
              otvorenu do provjere.
            </p>
          )}
          <div className="studio-recovery-actions">
            <button
              className="studio-secondary"
              disabled={recoveryBusy || !!job || loading || detailLoading}
              onClick={restorePending}
            >
              Vrati prethodni zahtjev
            </button>
            <button
              className="studio-recovery-primary"
              disabled={recoveryBusy || !!job}
              onClick={() => void recover()}
            >
              {recoveryBusy ? (
                <LoaderCircle className="studio-spin" size={15} />
              ) : (
                <RefreshCw size={15} />
              )}{" "}
              {!connected
                ? "Poveži ključ za oporavak"
                : pending.maxCostMicroUsd === undefined
                  ? "Provjeri cijenu prethodnog zahtjeva"
                  : "Provjeri prethodni zahtjev"}
            </button>
            {recoveryRestored && (
              <span role="status">
                <Check size={13} /> Izvorne postavke su vraćene
              </span>
            )}
          </div>
          <div className="studio-dismiss-recovery">
            {!recoveryDismiss ? (
              <button
                disabled={recoveryBusy}
                onClick={() => setRecoveryDismiss(true)}
              >
                Ukloni podsjetnik i nastavi
              </button>
            ) : (
              <>
                <p>
                  Prethodni zahtjev možda je prihvaćen. Uklanjanje ne prekida
                  generiranje niti vraća sredstva.{" "}
                  <a
                    href="https://dev.pika.art"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Provjeri Pika račun <ArrowUpRight size={11} />
                  </a>
                </p>
                <div>
                  <button
                    disabled={recoveryBusy}
                    onClick={() => {
                      persistPending(null);
                      identity.current = { fingerprint: "", id: "" };
                      setRecoveryDismiss(false);
                      setRecoveryError("");
                      setQuote(null);
                      setError("");
                      setRecoveryNotice(
                        "Podsjetnik je uklonjen iz ove kartice. Prethodni zahtjev nije otkazan.",
                      );
                    }}
                  >
                    Potvrdi uklanjanje podsjetnika
                  </button>
                  <button
                    disabled={recoveryBusy}
                    onClick={() => setRecoveryDismiss(false)}
                  >
                    Zadrži podsjetnik
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}
      {recoveryNotice && (
        <div className="studio-recovery-note" role="status">
          <span>{recoveryNotice}</span>
          <button
            aria-label="Zatvori napomenu"
            onClick={() => setRecoveryNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="studio-workflow" aria-label="Koraci stvaranja">
        <span className={!quote && !job ? "current" : "done"}>
          <i>{quote || job ? <Check size={12} /> : "01"}</i> Pripremi svoju
          ideju
        </span>
        <ArrowRight size={13} />
        <span className={quote && !job ? "current" : job ? "done" : ""}>
          <i>{job ? <Check size={12} /> : "02"}</i> Provjeri cijenu
        </span>
        <ArrowRight size={13} />
        <span className={job ? "current" : ""}>
          <i>03</i> Stvori nešto novo
        </span>
      </div>
      <div className="studio-layout">
        <section className="studio-controls" aria-label="Postavke generiranja">
          <div className="studio-tabs">
            {[
              ["video", Video, "Video"],
              ["image", ImagePlus, "Slika"],
              ["audio", Music2, "Audio"],
            ]
              .filter(
                ([key]) => !models.length || categories.includes(key as string),
              )
              .map(([key, Icon, title]) => {
                const TabIcon = Icon as typeof Video;
                return (
                  <button
                    key={key as string}
                    className={category === key ? "active" : ""}
                    disabled={controlsLocked || loading || detailLoading}
                    onClick={() => chooseCategory(key as string)}
                  >
                    <TabIcon size={16} />
                    {title as string}
                  </button>
                );
              })}
            {categories.some(
              (value) => !["image", "video", "audio"].includes(value),
            ) && (
              <select
                aria-label="Ostale vrste sadržaja"
                disabled={controlsLocked || loading || detailLoading}
                value={
                  ["video", "image", "audio"].includes(category) ? "" : category
                }
                onChange={(event) => chooseCategory(event.target.value)}
              >
                <option value="" disabled>
                  Više
                </option>
                {categories
                  .filter(
                    (value) => !["image", "video", "audio"].includes(value),
                  )
                  .map((value) => (
                    <option key={value} value={value}>
                      {categoryLabel(value)}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <div className="studio-form">
            <div className="studio-field">
              <label htmlFor="studio-model">
                Model{" "}
                <span className="studio-live">
                  <span /> LIVE KATALOG
                </span>
              </label>
              <ModelPicker
                models={models.filter((model) => model.category === category)}
                value={apiId}
                loading={loading}
                disabled={loading || controlsLocked || detailLoading}
                onChange={setApiId}
              />
            </div>
            <div className="studio-presets">
              <button
                className="studio-presets-toggle"
                aria-expanded={presetsOpen}
                onClick={() => {
                  setPresetsOpen(!presetsOpen);
                  setPresetNotice("");
                  setPresetError("");
                }}
              >
                <Bookmark size={14} />
                <span>Moje postavke</span>
                {presets.length > 0 && <small>{presets.length}</small>}
                <ChevronDown
                  size={14}
                  className={presetsOpen ? "rotated" : ""}
                />
              </button>
              {presetsOpen && (
                <div className="studio-presets-panel">
                  <div className="studio-presets-intro">
                    <strong>Sačuvaj svoj kreativni recept.</strong>
                    <p>Jednim klikom vrati model, opis i njegove postavke.</p>
                  </div>
                  <form
                    className="studio-preset-save"
                    onSubmit={(event) => {
                      event.preventDefault();
                      savePreset();
                    }}
                  >
                    <label htmlFor="studio-preset-name">
                      {editingPreset
                        ? "Novi naziv predloška"
                        : "Naziv novih postavki"}
                    </label>
                    <div>
                      <input
                        id="studio-preset-name"
                        value={presetName}
                        onChange={(event) => setPresetName(event.target.value)}
                        placeholder="Npr. Filmski portret · 9:16"
                        maxLength={50}
                        disabled={controlsLocked}
                      />
                      <button
                        type="submit"
                        aria-label={
                          editingPreset
                            ? "Spremi novi naziv"
                            : "Spremi trenutne postavke"
                        }
                        disabled={
                          controlsLocked ||
                          loading ||
                          detailLoading ||
                          !detail ||
                          !presetName.trim()
                        }
                      >
                        <Save size={15} />
                      </button>
                    </div>
                    {editingPreset && (
                      <button
                        className="studio-preset-cancel"
                        type="button"
                        onClick={() => {
                          setEditingPreset(null);
                          setPresetName("");
                        }}
                      >
                        Odustani od preimenovanja
                      </button>
                    )}
                  </form>
                  {presetError && (
                    <p className="studio-preset-error" role="alert">
                      {presetError}
                    </p>
                  )}
                  {presetNotice && (
                    <p className="studio-preset-notice" role="status">
                      <Check size={12} />
                      {presetNotice}
                    </p>
                  )}
                  {presets.length > 0 ? (
                    <div className="studio-preset-list">
                      {presets.map((preset) => (
                        <div className="studio-preset-item" key={preset.id}>
                          <button
                            className="studio-preset-apply"
                            disabled={
                              controlsLocked || loading || detailLoading
                            }
                            onClick={() => applyPreset(preset)}
                            aria-label={`Primijeni postavke ${preset.name}`}
                          >
                            <Bookmark size={13} />
                            <span>
                              <strong>{preset.name}</strong>
                              <small>{preset.modelName || preset.apiId}</small>
                            </span>
                            <ArrowUpRight size={14} />
                          </button>
                          <div className="studio-preset-actions">
                            <button
                              disabled={controlsLocked}
                              aria-label={`Preimenuj ${preset.name}`}
                              onClick={() => {
                                setEditingPreset(preset.id);
                                setPresetName(preset.name);
                                setPresetNotice("");
                                document
                                  .getElementById("studio-preset-name")
                                  ?.focus();
                              }}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              disabled={controlsLocked}
                              aria-label={`Ukloni postavke ${preset.name}`}
                              onClick={() =>
                                setDeletePresetId(
                                  deletePresetId === preset.id
                                    ? null
                                    : preset.id,
                                )
                              }
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          {deletePresetId === preset.id && (
                            <div className="studio-preset-confirm">
                              <span>Ukloniti ove postavke?</span>
                              <button
                                onClick={() => {
                                  persistPresets(
                                    presets.filter(
                                      (item) => item.id !== preset.id,
                                    ),
                                    "Postavke su uklonjene.",
                                  );
                                  setDeletePresetId(null);
                                  if (editingPreset === preset.id) {
                                    setEditingPreset(null);
                                    setPresetName("");
                                  }
                                }}
                              >
                                Ukloni
                              </button>
                              <button onClick={() => setDeletePresetId(null)}>
                                Odustani
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="studio-presets-empty">
                      Tvoje omiljene kombinacije pojavit će se ovdje.
                    </div>
                  )}
                  <p className="studio-preset-footnote">
                    Spremljeno u ovom pregledniku. Poveznice na referentne
                    datoteke mogu isteći.
                  </p>
                </div>
              )}
            </div>
            {detailLoading ? (
              <div className="studio-loading">
                <LoaderCircle className="studio-spin" size={22} /> Učitavanje
                postavki modela…
              </div>
            ) : (
              <>
                <div className="studio-fields">{mainFields.map(field)}</div>
                {extraFields.length > 0 && (
                  <>
                    <button
                      className="studio-advanced"
                      aria-expanded={advanced}
                      onClick={() => setAdvanced(!advanced)}
                    >
                      <Settings2 size={15} /> Napredne postavke
                      <ChevronDown
                        className={advanced ? "rotated" : ""}
                        size={14}
                      />
                    </button>
                    {advanced && (
                      <div className="studio-fields studio-extras">
                        {extraFields.map(field)}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {error && (
              <div className="studio-error" role="alert">
                {error}
                {!!models.length && !detail && !detailLoading && (
                  <button onClick={() => setDetailRetry((value) => value + 1)}>
                    Ponovno učitaj model
                  </button>
                )}
                {!models.length && !loading && (
                  <button onClick={() => setCatalogRetry((value) => value + 1)}>
                    Pokušaj ponovno
                  </button>
                )}
              </div>
            )}
            {detail && !detailLoading && requiredMissing.length > 0 && !job && (
              <div className="studio-readiness">
                <span className="studio-readiness-dot" />
                <span>
                  Još samo:{" "}
                  {requiredMissing
                    .map(
                      (key: string) => labels[key] || key.replaceAll("_", " "),
                    )
                    .join(", ")
                    .toLowerCase()}
                  .
                </span>
              </div>
            )}
            {quote && (
              <div
                className={`studio-quote ${insufficientFunds ? "is-short" : ""}`}
                role="status"
              >
                <div>
                  {insufficientFunds ? (
                    <AlertTriangle size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  <span>Procijenjena cijena</span>
                </div>
                <strong>{formatUsd(quote.micro_usd)}</strong>
              </div>
            )}
            {quote && connected && typeof balanceMicro === "number" && (
              <div
                className={`studio-balance ${insufficientFunds ? "is-short" : ""}`}
                role={insufficientFunds ? "alert" : undefined}
              >
                {insufficientFunds ? (
                  <span>
                    Stanje računa ({formatUsd(balanceMicro)}) nije dovoljno za
                    ovo generiranje.
                  </span>
                ) : (
                  <span>
                    Stanje računa <b>{formatUsd(balanceMicro)}</b>
                    <i>·</i> nakon generiranja ≈{" "}
                    {formatUsd(balanceMicro - quote.micro_usd)}
                  </span>
                )}
                <div>
                  {insufficientFunds && (
                    <a href="https://dev.pika.art" target="_blank" rel="noreferrer">
                      Nadoplati sredstva <ArrowUpRight size={12} />
                    </a>
                  )}
                  {onRefreshBalance && (
                    <button
                      type="button"
                      disabled={balanceRefreshing}
                      onClick={() => void refreshBalance()}
                    >
                      {balanceRefreshing ? (
                        <LoaderCircle className="studio-spin" size={12} />
                      ) : (
                        <RefreshCw size={12} />
                      )}{" "}
                      Osvježi stanje
                    </button>
                  )}
                </div>
              </div>
            )}
            <button
              className="studio-generate"
              disabled={actionDisabled}
              onClick={runPrimaryAction}
            >
              {busy ? (
                <LoaderCircle className="studio-spin" size={18} />
              ) : (
                <Sparkles size={18} />
              )}
              {busy === "quote"
                ? "Provjeravam cijenu…"
                : busy === "generate"
                  ? "Šaljem zahtjev…"
                  : pending
                    ? "Prvo provjeri prethodni zahtjev"
                    : isRunning
                      ? "Generiranje je u tijeku"
                      : job
                        ? "Započni novu kreaciju u pregledu"
                        : insufficientFunds
                          ? "Nedovoljno sredstava na računu"
                          : quote
                            ? connected
                              ? `Generiraj ${mediaLabel}`
                              : "Poveži ključ i generiraj"
                            : "Provjeri cijenu"}
              <ArrowUpRight size={17} />
            </button>
            <p className="studio-cost-note">
              {quote
                ? "Jedna generacija · naplata s tvog Pika računa"
                : "Provjera cijene je besplatna. Ti odlučuješ kada počinje generiranje."}
              {!actionDisabled && (
                <span className="studio-shortcut">
                  <kbd>{shortcutKey}</kbd>+<kbd>Enter</kbd>
                </span>
              )}
            </p>
          </div>
        </section>
        <section className="studio-preview" aria-label="Pregled rezultata">
          <div className="studio-preview-header">
            <span>
              <Clapperboard size={16} />
              Pregled
            </span>
            <span className="studio-preview-tag" role="status">
              {job
                ? isTerminalStatus(job.status)
                  ? job.status === "completed"
                    ? "GOTOVO"
                    : "NEUSPJELO"
                  : "U IZRADI"
                : "TVOJ SLJEDEĆI KADAR"}
            </span>
          </div>
          {!job ? (
            <div className="studio-empty-preview">
              <div
                className="studio-viewfinder"
                style={{
                  aspectRatio: canvasRatio,
                  width: Math.min(340, 230 * canvasRatio),
                }}
              >
                <span className="studio-viewfinder-label">TVOJE PLATNO</span>
                <div className="studio-preview-mark">
                  <WandSparkles size={38} strokeWidth={1.2} />
                </div>
                <span className="studio-viewfinder-format">
                  {input.aspect_ratio || "AI STUDIO"}
                </span>
                <i />
                <i />
                <i />
                <i />
              </div>
              <h2>
                {input.prompt?.trim()
                  ? "Scena je postavljena."
                  : "Svaka velika priča počinje idejom."}
              </h2>
              <p>
                {input.prompt?.trim()
                  ? "Provjeri cijenu i pokreni generiranje. Tvoj rezultat pojavit će se ovdje."
                  : "Dodaj opis ili referentnu sliku. Za ostalo, tu je tvoj kreativni studio."}
              </p>
              {input.prompt?.trim() && (
                <blockquote className="studio-scene-brief">
                  “{input.prompt.trim()}”
                </blockquote>
              )}
              <div className="studio-preview-pills">
                {detail && (
                  <span>
                    <Clapperboard size={11} />
                    {detail.name}
                  </span>
                )}
                {input.resolution && <span>{input.resolution}</span>}
                {(input.duration_s || input.duration) && (
                  <span>{input.duration_s || input.duration} s</span>
                )}
              </div>
            </div>
          ) : isRunning ? (
            <div className="studio-empty-preview">
              <div className="studio-render-orbit">
                <LoaderCircle
                  className="studio-spin"
                  size={38}
                  strokeWidth={1.2}
                />
              </div>
              <h2>
                {!connected
                  ? "Ponovno poveži svoj studio."
                  : pollPaused
                    ? "Provjera je pauzirana."
                    : job.status === "queued"
                      ? "Tvoja ideja čeka svoj red."
                      : "Tvoja ideja dobiva život."}
              </h2>
              <p>
                {!connected
                  ? "Tvoj je zahtjev spremljen. Poveži API ključ za nastavak praćenja, bez novog slanja."
                  : pollPaused
                    ? "Generiranje može još biti u tijeku. Nastavi provjeru bez ponovnog slanja."
                    : "Generiranje može potrajati nekoliko minuta. Rezultat će se automatski pojaviti ovdje."}
              </p>
              {!connected && (
                <button className="studio-secondary" onClick={onConnect}>
                  Poveži API ključ <ArrowUpRight size={15} />
                </button>
              )}
              {connected && pollPaused && (
                <button
                  className="studio-secondary"
                  onClick={() => setPollVersion((value) => value + 1)}
                >
                  <RefreshCw size={15} />
                  Nastavi provjeru
                </button>
              )}
              {connected && (
                <button className="studio-secondary" onClick={detachJob}>
                  <Plus size={15} />
                  Pripremi novu ideju dok čekaš
                </button>
              )}
              {connected && notifyPermission === "default" && (
                <button
                  className="studio-notify"
                  onClick={async () => {
                    try {
                      setNotifyPermission(await Notification.requestPermission());
                    } catch {
                      setNotifyPermission("denied");
                    }
                  }}
                >
                  <Bell size={14} /> Obavijesti me kad završi
                </button>
              )}
              {connected && notifyPermission === "granted" && (
                <span className="studio-notify-on">
                  <BellRing size={12} /> Javit ćemo ti i kad si u drugoj
                  kartici
                </span>
              )}
              {restoredGeneration?.job.id === job.id && (
                <span className="studio-restored-job">
                  <RefreshCw size={12} /> Praćenje nastavljeno nakon povratka
                </span>
              )}
              {elapsedLabel && (
                <div className="studio-elapsed">
                  <Clock3 size={14} />
                  <span>Proteklo {elapsedLabel}</span>
                  <small>Vrijeme od slanja · nije procjena završetka</small>
                </div>
              )}
              <code>{job.id}</code>
            </div>
          ) : job.status === "failed" ||
            job.status === "cancelled" ||
            job.status === "canceled" ? (
            <div className="studio-empty-preview">
              <Clapperboard size={40} />
              <h2>Generiranje nije uspjelo.</h2>
              <p>
                {typeof job.error === "string"
                  ? job.error
                  : job.error?.message ||
                    "Pružatelj nije mogao dovršiti ovaj zahtjev. Prilagodi prompt i pokušaj ponovno."}
              </p>
              <button
                className="studio-secondary"
                onClick={() => {
                  setJob(null);
                  setQuote(null);
                  identity.current = { fingerprint: "", id: "" };
                }}
              >
                <RefreshCw size={15} />
                Novi pokušaj
              </button>
            </div>
          ) : (
            <div className="studio-results">
              {media.length ? (
                media.map((item, index) => (
                  <div className="studio-result" key={item.url}>
                    {mediaKind(item) === "image" ? (
                      <img
                        src={item.url}
                        alt={`Generirani rezultat ${index + 1}`}
                      />
                    ) : mediaKind(item) === "audio" ? (
                      <audio controls src={item.url} />
                    ) : mediaKind(item) === "video" ? (
                      <video controls playsInline src={item.url} />
                    ) : (
                      <div className="studio-file-result">
                        <Download size={30} />
                        <span>{item.type || "Datoteka za preuzimanje"}</span>
                      </div>
                    )}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      download
                    >
                      <Download size={16} />
                      Preuzmi rezultat {media.length > 1 ? index + 1 : ""}
                    </a>
                  </div>
                ))
              ) : (
                <div className="studio-text-result">
                  <h3>Generiranje je završeno</h3>
                  <pre>{JSON.stringify(job.output, null, 2)}</pre>
                </div>
              )}
              <button
                className="studio-secondary"
                onClick={() => {
                  setJob(null);
                  setQuote(null);
                  identity.current = { fingerprint: "", id: "" };
                }}
              >
                <Sparkles size={15} />
                Stvori nešto novo
              </button>
            </div>
          )}
          <div className="studio-preview-footer">
            <span className="studio-status-dot" />
            {connected ? "Pika API povezan" : "Poveži ključ za generiranje"}
            <span>STVORENO TVOJOM MAŠTOM</span>
          </div>
        </section>
      </div>
    </div>
  );
}
