import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Copy,
  CheckCheck,
  Eye,
  EyeOff,
  Focus,
  MoveUpRight,
  ScanLine,
  Orbit,
  RotateCw,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Compass,
  Film,
  Grid2X2,
  Image,
  KeyRound,
  Layers3,
  LoaderCircle,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Video,
  WandSparkles,
  X,
  Zap,
  WifiOff,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import Studio from "./Studio";
import Library from "./Library";
import CommandMenu from "./CommandMenu";
import type { CommandAction } from "./CommandMenu";

type View = "explore" | "studio" | "creations" | "saved" | "models";
type Idea = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  category: string;
  prompt: string;
  tag?: string;
};
const ideas: Idea[] = [
  {
    id: "neon",
    title: "Neon nights",
    subtitle: "Grad koji nikad ne spava",
    image: "urban-night.jpg",
    category: "Filmski",
    tag: "POPULARNO",
    prompt:
      "A cinematic tracking shot through an empty futuristic Tokyo street at night, neon pink and cyan signs reflected on wet asphalt, atmospheric fog, anamorphic lens, slow smooth camera movement, photorealistic.",
  },
  {
    id: "portrait",
    title: "U glavnoj ulozi",
    subtitle: "Svaki pogled priča priču",
    image: "fashion-portrait.jpg",
    category: "Portreti",
    prompt:
      "An editorial close-up portrait of a woman in moody blue and violet studio lighting. She slowly turns toward the camera, natural skin texture, subtle hair movement, shallow depth of field, cinematic fashion film.",
  },
  {
    id: "drive",
    title: "Osjeti brzinu",
    subtitle: "Pokret. Snaga. Sloboda.",
    image: "cinematic-car.jpg",
    category: "Filmski",
    tag: "U TRENDU",
    prompt:
      "A cinematic low-angle tracking shot of a black sports car speeding along a winding road, dramatic reflections across the bodywork, motion blur in the background, premium automotive commercial, smooth camera movement.",
  },
  {
    id: "alpine",
    title: "Izvan svakodnevice",
    subtitle: "Svjetovi koji ostavljaju bez daha",
    image: "mountain-world.jpg",
    category: "Priroda",
    prompt:
      "An epic cinematic aerial shot gliding through a lush alpine valley toward towering mountains, soft morning mist drifting between peaks, golden sun rays, extraordinary scale, slow drone movement, photorealistic.",
  },
  {
    id: "product",
    title: "Mali detalji. Veliki dojam.",
    subtitle: "Proizvod u savršenom svjetlu",
    image: "perfume-product.jpg",
    category: "Proizvodi",
    prompt:
      "A luxury perfume bottle on a minimal pale blue background, cinematic slow orbit, delicate water droplets, soft studio reflections, premium product commercial, elegant and refined.",
  },
  {
    id: "ocean",
    title: "Uhvati trenutak",
    subtitle: "Energija oceana u jednom kadru",
    image: "ocean-adventure.jpg",
    category: "Priroda",
    prompt:
      "A surfer riding inside a translucent turquoise wave, slow motion water droplets suspended in sunlight, immersive action camera, exhilarating movement, high-end sports documentary.",
  },
  {
    id: "cosmic",
    title: "Bez granica",
    subtitle: "Tvoja mašta je tek početak",
    image: "cosmic-night.jpg",
    category: "Filmski",
    prompt:
      "A slow cinematic journey through a colorful cosmic nebula, glowing purple and pink clouds of interstellar dust, distant stars twinkling, immense scale and depth, beautiful science fiction scene.",
  },
  {
    id: "forest",
    title: "Udahni tišinu",
    subtitle: "Usporeno, baš kako treba",
    image: "forest-light.jpg",
    category: "Priroda",
    prompt:
      "A cinematic slow dolly shot into a misty emerald forest, shafts of morning sunlight through ancient trees, delicate floating particles, peaceful atmosphere, photorealistic nature film.",
  },
];
const motions = [
  {
    id: "dolly",
    name: "Dolly in",
    description: "Približi se priči",
    image: "portrait-editorial.jpg",
    icon: MoveUpRight,
    scene:
      "An editorial portrait of a woman in a dark studio, soft directional lighting, natural skin texture.",
    directive:
      "The camera slowly dollies forward toward the subject, smoothly revealing details with shallow depth of field.",
  },
  {
    id: "orbit",
    name: "Orbit 360°",
    description: "Otkrij svaki kut",
    image: "cinematic-car.jpg",
    icon: Orbit,
    scene:
      "A black sports car parked on a dramatic coastal road at golden hour.",
    directive:
      "The camera smoothly orbits around the subject in a full circle at constant speed, keeping it centered throughout.",
  },
  {
    id: "aerial",
    name: "Aerial reveal",
    description: "Promijeni perspektivu",
    image: "mountain-world.jpg",
    icon: ScanLine,
    scene:
      "A dramatic alpine valley with a winding river and towering snow-capped mountains in morning mist.",
    directive:
      "The camera rises slowly above the foreground and glides forward to reveal the vast landscape, cinematic drone shot.",
  },
  {
    id: "roll",
    name: "Dream roll",
    description: "Iznenadi pogled",
    image: "cosmic-night.jpg",
    icon: RotateCw,
    scene:
      "A luminous purple and blue cosmic nebula filled with distant stars and clouds of interstellar dust.",
    directive:
      "The camera slowly rolls on its optical axis while moving forward, a smooth dreamlike rotation through the scene.",
  },
];
const heroSlides = [
  {
    image: "hero-sahara.jpg",
    eyebrow: "TVOJ SLJEDEĆI VELIKI KADAR",
    line: "Tvoja mašta.",
    accent: "Bez granica.",
    description:
      "Pretvori svoju maštu u video koji se pamti.\nJedna ideja. Jedan ključ. Bezbroj mogućnosti.",
    prompt:
      "A cinematic aerial journey across endless golden sand dunes at sunset, sweeping drone movement, fine sand floating in warm light, epic film composition.",
  },
  {
    image: "urban-night.jpg",
    eyebrow: "OD IDEJE DO ATMOSFERE",
    line: "Tvoj svijet.",
    accent: "Tvoja pravila.",
    description:
      "Neonski gradovi i nove perspektive.\nStvori kadar koji još nitko nije vidio.",
    prompt: ideas[0].prompt,
  },
  {
    image: "ocean-adventure.jpg",
    eyebrow: "POKRENI SVOJU KREATIVNOST",
    line: "Uhvati emociju.",
    accent: "Pokreni priču.",
    description:
      "Od sitnog detalja do velike avanture.\nDaj svakoj ideji novu dimenziju.",
    prompt: ideas[5].prompt,
  },
];
const validViews: View[] = [
  "explore",
  "studio",
  "creations",
  "saved",
  "models",
];
function currentView(): View {
  const hash = window.location.hash.slice(1) as View;
  return validViews.includes(hash) ? hash : "explore";
}
function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
async function api(path: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      signal: options?.signal ?? AbortSignal.timeout(35000),
    });
  } catch (error) {
    throw new Error(
      !navigator.onLine
        ? "Nema internetske veze. Pokušaj ponovno kad se veza vrati."
        : (error as Error).name === "TimeoutError"
          ? "Poslužitelj nije odgovorio na vrijeme. Pokušaj ponovno."
          : "Veza s poslužiteljem nije dostupna. Pokušaj ponovno.",
    );
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      "Poslužitelj nije vratio ispravan odgovor. Pokušaj ponovno.",
    );
  }
  if (!data || typeof data !== "object")
    throw new Error(
      "Poslužitelj nije vratio ispravan odgovor. Pokušaj ponovno.",
    );
  if (res.status === 401 && path !== "/api/connect")
    window.dispatchEvent(new CustomEvent("pika-session-expired"));
  if (!res.ok) {
    const message =
      res.status === 401 && path === "/api/connect"
        ? "Pika nije prihvatio ovaj API ključ. Provjeri ključ i pokušaj ponovno."
        : res.status === 429
          ? "Previše zahtjeva u kratkom vremenu. Pričekaj minutu i pokušaj ponovno."
          : data.message ||
            data.error?.message ||
            "Zahtjev nije uspio. Pokušaj ponovno.";
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data;
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      <span>
        higgsfield<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function Modal({
  children,
  onClose,
  label,
  wide = false,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const focusables = () =>
      ref.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href], textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
      );
    focusables()?.[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const all = focusables();
        if (!all?.length) return;
        const first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <button
          className="icon-button modal-close"
          aria-label="Zatvori"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
export default function App() {
  const [view, setView] = useState<View>(currentView);
  const [connected, setConnected] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [key, setKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Sve");
  const [saved, setSaved] = useState<string[]>(() => {
    const value = stored<unknown>("hf-saved", []);
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string")
      : [];
  });
  const [jobs, setJobs] = useState<any[]>(() => {
    const value = stored<unknown>("hf-jobs", []);
    return Array.isArray(value)
      ? value.filter(
          (v) => v && typeof v === "object" && typeof v.id === "string",
        )
      : [];
  });
  const [selected, setSelected] = useState<Idea | null>(null);
  const [slide, setSlide] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState<string>();
  const [initialInput, setInitialInput] = useState<Record<string, unknown>>();
  const [commandOpen, setCommandOpen] = useState(false);
  const [studioKey, setStudioKey] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 640px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const changed = () => {
      setCompact(query.matches);
      if (!query.matches) setMobileMenu(false);
    };
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState<"success" | "error" | "info">(
    "success",
  );
  const notify = useCallback(
    (message: string, tone: "success" | "error" | "info" = "success") => {
      setToastTone(tone);
      setToast(message);
    },
    [],
  );
  const [online, setOnline] = useState(() => navigator.onLine);
  const [sessionStatus, setSessionStatus] = useState<
    "checking" | "ready" | "unavailable"
  >("checking");
  const [sessionError, setSessionError] = useState("");
  const sessionAttempt = useRef(0);
  const lastSessionCheck = useRef(0);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [homePrompt, setHomePrompt] = useState(() => {
    try {
      return sessionStorage.getItem("hf-home-prompt") || "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("hf-home-prompt", homePrompt);
    } catch {}
  }, [homePrompt]);
  const [studioOpened, setStudioOpened] = useState(
    () => currentView() === "studio",
  );
  const [modelCategory, setModelCategory] = useState("all");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const modalFocusRef = useRef<HTMLButtonElement>(null);
  const [deletedGenerationIds] = useState<string[]>(() => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem("hf-deleted-generations") || "[]",
      );
      return Array.isArray(value)
        ? value.filter((id): id is string => typeof id === "string").slice(-200)
        : [];
    } catch {
      return [];
    }
  });
  const deletedJobIds = useRef(new Set<string>(deletedGenerationIds));
  const checkSession = useCallback(async () => {
    const attempt = ++sessionAttempt.current;
    lastSessionCheck.current = Date.now();
    setSessionStatus("checking");
    setSessionError("");
    try {
      const data = await api("/api/session");
      if (attempt !== sessionAttempt.current) return;
      if (typeof data.connected !== "boolean")
        throw new Error("Status veze nije moguće provjeriti. Pokušaj ponovno.");
      setConnected(data.connected);
      setBalance(
        typeof data.balance?.balance_micro_usd === "number"
          ? data.balance.balance_micro_usd / 1000000
          : null,
      );
      setSessionStatus("ready");
    } catch (error) {
      if (attempt !== sessionAttempt.current) return;
      if ((error as { status?: number }).status === 401) {
        setConnected(false);
        setBalance(null);
        setSessionStatus("ready");
        return;
      }
      setSessionStatus("unavailable");
      setSessionError((error as Error).message);
    }
  }, []);
  useEffect(() => {
    void checkSession();
    return () => {
      sessionAttempt.current++;
    };
  }, [checkSession]);
  useEffect(() => {
    if (connectOpen && connected) void checkSession();
  }, [connectOpen, checkSession]);
  useEffect(() => {
    const disconnected = () => setOnline(false);
    const restored = () => {
      setOnline(true);
      void checkSession();
    };
    const visible = () => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        Date.now() - lastSessionCheck.current > 60000
      )
        void checkSession();
    };
    window.addEventListener("offline", disconnected);
    window.addEventListener("online", restored);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("offline", disconnected);
      window.removeEventListener("online", restored);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [checkSession]);
  useEffect(() => {
    const update = () => {
      const next = currentView();
      setView(next);
      setMobileMenu(false);
      if (next === "studio") setStudioOpened(true);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    if (!mobileMenu) return;
    const previous = document.activeElement as HTMLElement;
    modalFocusRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenu(false);
    };
    window.addEventListener("keydown", close);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", close);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [mobileMenu]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        setMobileMenu(false);
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    const expired = () => {
      setConnected(false);
      setBalance(null);
      notify("Sesija je istekla. Ponovno poveži svoj API ključ.", "info");
    };
    window.addEventListener("pika-session-expired", expired);
    return () => window.removeEventListener("pika-session-expired", expired);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("hf-saved", JSON.stringify(saved));
    } catch {}
  }, [saved]);
  useEffect(() => {
    try {
      localStorage.setItem("hf-jobs", JSON.stringify(jobs.slice(0, 100)));
    } catch {
      notify(
        "Preglednik ne može spremiti povijest. Preuzmi rezultate koje želiš sačuvati.",
        "info",
      );
    }
  }, [jobs]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(""),
      toastTone === "success" ? 4000 : 8000,
    );
    return () => clearTimeout(timer);
  }, [toast, toastTone]);
  useEffect(() => {
    if ((view !== "models" && !commandOpen) || catalog.length) return;
    setCatalogLoading(true);
    setCatalogError("");
    api("/api/catalog")
      .then((d) => setCatalog(d.apis || []))
      .catch((e) => setCatalogError(e.message))
      .finally(() => setCatalogLoading(false));
  }, [view, catalog.length, catalogRetry, commandOpen]);
  function openConnection() {
    setMobileMenu(false);
    setConnectError("");
    setShowKey(false);
    setConnectOpen(true);
  }
  function openHelp() {
    setMobileMenu(false);
    setHelpOpen(true);
  }
  function navigate(next: View) {
    setView(next);
    if (window.location.hash !== `#${next}`) window.location.hash = next;
    if (next === "studio") setStudioOpened(true);
    setMobileMenu(false);
    setSearch("");
    if (next === "saved") setCategory("Sve");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openStudio(text = "", id?: string, input?: Record<string, unknown>) {
    setInitialInput(input ?? (text ? { prompt: text } : {}));
    setPrompt(text);
    setModelId(id);
    setStudioKey((n) => n + 1);
    setSelected(null);
    setStudioOpened(true);
    navigate("studio");
  }
  function toggleSave(id: string) {
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setConnecting(true);
    setConnectError("");
    try {
      const connection = await api("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key.trim() }),
      });
      ++sessionAttempt.current;
      setSessionStatus("ready");
      setSessionError("");
      setConnected(true);
      setBalance(connection.balance?.balance_micro_usd / 1000000);
      setShowKey(false);
      setKey("");
      setConnectOpen(false);
      notify("Pika API Club uspješno povezan. Spreman si za stvaranje.");
    } catch (e) {
      setConnectError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }
  async function disconnect() {
    try {
      await api("/api/session", { method: "DELETE" });
      ++sessionAttempt.current;
      setSessionStatus("ready");
      setSessionError("");
      setConnected(false);
      setBalance(null);
      setConnectOpen(false);
      notify("API ključ je uklonjen iz sesije.");
    } catch (e) {
      setConnectError((e as Error).message);
    }
  }
  function jobCreated(job: any) {
    if (deletedJobIds.current.has(job.id)) return;
    setJobs((prev) => {
      const existing = prev.find((j) => j.id === job.id);
      return existing
        ? prev.map((j) => (j.id === job.id ? { ...j, ...job } : j))
        : [job, ...prev].slice(0, 100);
    });
  }
  const filtered = ideas.filter(
    (i) =>
      (view !== "saved" || saved.includes(i.id)) &&
      (category === "Sve" || i.category === category) &&
      `${i.title} ${i.subtitle} ${i.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const hero = heroSlides[slide];
  const shownModels = catalog.filter(
    (m) =>
      (modelCategory === "all" || m.category === modelCategory) &&
      `${m.name} ${m.vendor} ${m.api_id} ${m.description || ""}`
        .toLowerCase()
        .includes(modelSearch.toLowerCase()),
  );
  function useMotion(motion: (typeof motions)[number]) {
    openStudio(
      `${homePrompt.trim() || motion.scene} ${motion.directive}`,
      "pika/pika-2.5/text-to-video",
    );
  }
  const commands: CommandAction[] = [
    {
      id: "resume",
      label: "Otvori video studio",
      description: "Nastavi svoj nacrt i provjeri cijenu",
      group: "Tvoj studio",
      icon: <Video />,
      run: () => navigate("studio"),
    },
    {
      id: "new",
      label: "Nova kreacija",
      description: "Prazan kadar za novu ideju",
      group: "Tvoj studio",
      icon: <Plus />,
      run: () => openStudio(),
    },
    {
      id: "library",
      label: "Moje kreacije",
      description: "Rezultati, preuzimanja i spremljene postavke",
      group: "Tvoj studio",
      icon: <Grid2X2 />,
      run: () => navigate("creations"),
    },
    {
      id: "models",
      label: "Svi modeli",
      description: "Pretraži katalog videa, slika i zvuka",
      group: "Tvoj studio",
      icon: <Layers3 />,
      run: () => navigate("models"),
    },
    {
      id: "saved",
      label: "Spremljena inspiracija",
      description: "Tvoja kolekcija ideja",
      group: "Tvoj studio",
      icon: <Bookmark />,
      run: () => navigate("saved"),
    },
    {
      id: "key",
      label: connected ? "Pika API postavke" : "Poveži Pika API ključ",
      description: "Upravljaj vezom i stanjem računa",
      group: "Tvoj studio",
      icon: <KeyRound />,
      run: openConnection,
    },
    ...motions.map((motion) => ({
      id: `motion-${motion.id}`,
      label: motion.name,
      description: motion.description,
      group: "Pokreti kamere",
      keywords: "kamera pokret video camera",
      icon: <motion.icon />,
      run: () => useMotion(motion),
    })),
    ...ideas.map((idea) => ({
      id: `idea-${idea.id}`,
      label: idea.title,
      description: idea.subtitle,
      group: "Inspiracija",
      keywords: idea.category,
      icon: <Film />,
      run: () => {
        setSelected(idea);
      },
    })),
    ...catalog.map((model) => ({
      id: `model-${model.api_id}`,
      label: model.name || model.api_id,
      description: `${model.vendor || ""} · ${model.function || model.category}`,
      group: "Modeli",
      keywords: model.api_id,
      icon: <Layers3 />,
      run: () => openStudio("", model.api_id),
    })),
  ];
  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("Kopiranje nije dostupno. Označi i kopiraj opis ručno.", "info");
    }
  }

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Preskoči na sadržaj
      </a>
      {mobileMenu && (
        <div className="sidebar-scrim" onClick={() => setMobileMenu(false)} />
      )}
      <aside
        className={`sidebar ${mobileMenu ? "is-open" : ""}`}
        aria-label="Glavni izbornik"
        inert={compact && !mobileMenu}
      >
        <button
          ref={modalFocusRef}
          className="mobile-close icon-button"
          aria-label="Zatvori izbornik"
          onClick={() => setMobileMenu(false)}
        >
          <X size={20} />
        </button>
        <button
          className="brand-button"
          onClick={() => navigate("explore")}
          aria-label="Početna"
        >
          <Brand />
        </button>
        <div className="workspace-label">TVOJ KREATIVNI PROSTOR</div>
        <button className="new-project" onClick={() => openStudio()}>
          <Plus size={18} /> Nova kreacija{" "}
          <ArrowUpRight size={15} className="new-project-arrow" />
        </button>
        <div className="nav-section">
          <button
            className={`nav-item ${view === "explore" ? "active" : ""}`}
            onClick={() => navigate("explore")}
          >
            <Compass />
            Istraži
            <ArrowUpRight className="nav-arrow" />
          </button>
          <button
            className={`nav-item ${view === "creations" ? "active" : ""}`}
            onClick={() => navigate("creations")}
          >
            <Grid2X2 />
            Moje kreacije
            {jobs.length > 0 && (
              <span className="nav-count">{jobs.length}</span>
            )}
          </button>
          <button
            className={`nav-item ${view === "saved" ? "active" : ""}`}
            onClick={() => navigate("saved")}
          >
            <Bookmark />
            Spremljeno
            {saved.length > 0 && (
              <span className="nav-count">{saved.length}</span>
            )}
          </button>
        </div>
        <div className="nav-heading">ALATI ZA STVARANJE</div>
        <div className="nav-section">
          <button
            className={`nav-item ${view === "studio" ? "active" : ""}`}
            onClick={() => navigate("studio")}
          >
            <Video />
            Video studio<span className="tiny-new">NOVO</span>
          </button>
          <button
            className="nav-item"
            onClick={() =>
              openStudio(
                "Animate this image with subtle cinematic movement. Preserve the subject and style.",
                "pika/pika-2.5/image-to-video",
              )
            }
          >
            <Image />
            Slika u video
          </button>
          <button
            className="nav-item"
            onClick={() => {
              navigate("explore");
              setCategory("Filmski");
              setTimeout(
                () =>
                  document
                    .getElementById("inspiration")
                    ?.scrollIntoView({ behavior: "smooth" }),
                50,
              );
            }}
          >
            <WandSparkles />
            Kreativni predlošci
          </button>
          <button
            className={`nav-item ${view === "models" ? "active" : ""}`}
            onClick={() => navigate("models")}
          >
            <Layers3 />
            Svi modeli
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className="connection-icon">
              <Zap size={18} />
            </span>
            <strong>
              {connected
                ? "Tvoj studio je povezan"
                : "Tvoja ideja. Tvoj ključ."}
            </strong>
            <p>
              {connected
                ? "Pika API Club je spreman za tvoju sljedeću ideju."
                : "Poveži Pika API Club i otključaj svoj kreativni studio."}
            </p>
            <button onClick={openConnection}>
              {connected ? "Upravljaj vezom" : "Poveži API ključ"}
              <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="nav-item help-button" onClick={openHelp}>
            <CircleHelp />
            Pomoć i vodič
            <ArrowUpRight size={15} />
          </button>
          <div className="profile">
            <span className="avatar">K</span>
            <div>
              <strong>Osobni prostor</strong>
              <span>
                <i className={connected ? "online" : ""} />
                {connected ? "API povezan" : "Lokalni račun"}
              </span>
            </div>
            <button
              className="icon-button"
              onClick={openConnection}
              aria-label="Postavke API veze"
            >
              <Settings2 size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap" inert={mobileMenu}>
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Otvori izbornik"
            aria-expanded={mobileMenu}
            onClick={() => setMobileMenu(true)}
          >
            <Menu />
          </button>
          <div className="top-nav">
            <button
              className={
                view === "explore" || view === "saved" || view === "models"
                  ? "selected"
                  : ""
              }
              onClick={() => navigate("explore")}
            >
              Istraži
            </button>
            <button
              className={view === "studio" ? "selected" : ""}
              onClick={() => navigate("studio")}
            >
              Studio <span className="top-dot" />
            </button>
            <button
              className={view === "creations" ? "selected" : ""}
              onClick={() => navigate("creations")}
            >
              Moje kreacije
            </button>
          </div>
          <div className="top-actions">
            <button
              className="command-trigger"
              onClick={() => {
                setMobileMenu(false);
                setCommandOpen(true);
              }}
              aria-label="Otvori brzu pretragu"
            >
              <Search size={15} />
              <span>Brza pretraga</span>
              <kbd>
                {/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K"}
              </kbd>
            </button>
            <button
              className={`api-button ${connected ? "connected" : ""} ${sessionStatus === "unavailable" ? "connection-warning" : ""}`}
              onClick={() =>
                sessionStatus === "unavailable"
                  ? void checkSession()
                  : openConnection()
              }
              disabled={sessionStatus === "checking"}
            >
              {sessionStatus === "checking" ? (
                <LoaderCircle className="spin" size={15} />
              ) : sessionStatus === "unavailable" ? (
                <AlertCircle size={15} />
              ) : connected ? (
                <Check size={15} />
              ) : (
                <KeyRound size={15} />
              )}
              <span>
                {sessionStatus === "checking"
                  ? "Provjera veze"
                  : sessionStatus === "unavailable"
                    ? "Provjeri vezu"
                    : connected
                      ? "API povezan"
                      : "Poveži API"}
              </span>
            </button>
            <button
              className="avatar avatar-top"
              onClick={openConnection}
              aria-label="Korisničke postavke"
            >
              K
            </button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={
            view === "studio" ? "main-content studio-main" : "main-content"
          }
        >
          {(!online || sessionStatus === "unavailable") && (
            <div className="connection-banner" role="status">
              <span className="connection-banner-icon">
                {!online ? <WifiOff size={19} /> : <AlertCircle size={19} />}
              </span>
              <div>
                <strong>
                  {!online
                    ? "Trenutačno si izvan mreže."
                    : "Vezu trenutačno ne možemo provjeriti."}
                </strong>
                <p>
                  {!online
                    ? "Možeš uređivati opis i pregledati spremljene postavke. Slanje zahtjeva treba internetsku vezu."
                    : sessionError}
                </p>
              </div>
              <button
                disabled={!online || sessionStatus === "checking"}
                onClick={() => void checkSession()}
              >
                <RefreshCw size={14} /> Pokušaj ponovno
              </button>
            </div>
          )}
          {view === "explore" && (
            <>
              <div className="page-intro">
                <div>
                  <div className="eyebrow">OD IDEJE DO PRVOG KADRA</div>
                  <h1>
                    Što ćemo danas stvoriti<span>?</span>
                  </h1>
                </div>
                <button className="intro-guide" onClick={openHelp}>
                  <CircleHelp size={15} /> Kako radi studio{" "}
                  <ArrowUpRight size={14} />
                </button>
              </div>
              {jobs.length > 0 && (
                <div className="activity-strip">
                  <span className="activity-symbol">
                    {jobs.some((job) =>
                      ["queued", "running"].includes(job.status),
                    ) ? (
                      <LoaderCircle className="spin" size={19} />
                    ) : (
                      <Clapperboard size={19} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {jobs.some((job) =>
                        ["queued", "running"].includes(job.status),
                      )
                        ? "Tvoje ideje su u izradi."
                        : "Tvoja kreativnost već ima priču."}
                    </strong>
                    <span>
                      {jobs.filter((job) =>
                        ["queued", "running"].includes(job.status),
                      ).length > 0
                        ? `${jobs.filter((job) => ["queued", "running"].includes(job.status)).length} aktivnih zahtjeva · provjeri napredak u biblioteci`
                        : `${jobs.length} spremljenih kreacija · rezultati i njihove postavke na jednom mjestu`}
                    </span>
                  </div>
                  <button onClick={() => navigate("creations")}>
                    Moje kreacije <ArrowUpRight size={15} />
                  </button>
                </div>
              )}
              <div className="discover-feature">
                <section
                  className="hero"
                  style={{ backgroundImage: `url(/images/${hero.image})` }}
                >
                  <div className="hero-shade" />
                  <div className="hero-scene-label">
                    <Focus size={16} />
                    <span>KREATIVNI SMJER / 0{slide + 1}</span>
                    <span className="scene-format">16:9</span>
                  </div>
                  <div className="hero-viewfinder" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="hero-content">
                    <span className="hero-eyebrow">
                      <span /> {hero.eyebrow}
                    </span>
                    <h2>
                      {hero.line}
                      <br />
                      <em>{hero.accent}</em>
                    </h2>
                    <p>{hero.description}</p>
                    <button
                      className="primary-button"
                      onClick={() => openStudio(hero.prompt)}
                    >
                      Isprobaj ovu viziju <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <div className="hero-caption">
                    <span>INSPIRACIJA U FOKUSU</span>
                    <b>
                      {slide === 0
                        ? "DESERT DREAMS"
                        : slide === 1
                          ? "AFTER HOURS"
                          : "INTO THE BLUE"}
                    </b>
                    <span>
                      Inspiracija za tvoj sljedeći projekt{" "}
                      <ArrowUpRight size={12} />
                    </span>
                  </div>
                  <div className="hero-bottom">
                    <div className="slide-indicators">
                      {heroSlides.map((_, i) => (
                        <button
                          key={i}
                          className={slide === i ? "current" : ""}
                          aria-label={`Inspiracija ${i + 1}`}
                          aria-pressed={slide === i}
                          onClick={() => setSlide(i)}
                        />
                      ))}
                    </div>
                    <div className="slide-controls">
                      <span>
                        0{slide + 1}
                        <i> / 03</i>
                      </span>
                      <button
                        aria-label="Prethodna inspiracija"
                        onClick={() => setSlide((slide + 2) % 3)}
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <button
                        aria-label="Sljedeća inspiracija"
                        onClick={() => setSlide((slide + 1) % 3)}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                </section>
                <aside className="motion-panel" aria-label="Pokreti kamere">
                  <div className="motion-header">
                    <span>
                      <Focus size={14} /> REŽIRAJ SVOJ KADAR
                    </span>
                    <h2>
                      Svaki pokret
                      <br />
                      priča priču<span>.</span>
                    </h2>
                    <p>Odaberi smjer za svoju ideju.</p>
                  </div>
                  <div className="motion-list">
                    {motions.map((motion) => (
                      <button
                        key={motion.id}
                        className="motion-item"
                        onClick={() => useMotion(motion)}
                        aria-label={`Isprobaj pokret ${motion.name}`}
                      >
                        <span className="motion-thumb">
                          <img src={`/images/${motion.image}`} alt="" />
                          <span>
                            <motion.icon size={20} />
                          </span>
                        </span>
                        <span>
                          <strong>{motion.name}</strong>
                          <small>{motion.description}</small>
                        </span>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                  <span className="motion-note">
                    Pokret se dodaje kao uputa u opis.
                  </span>
                </aside>
              </div>
              <form
                className="idea-launcher"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (homePrompt.trim()) openStudio(homePrompt.trim());
                }}
              >
                <div className="launcher-main">
                  <span className="launcher-symbol">
                    <Sparkles size={23} />
                  </span>
                  <label className="sr-only" htmlFor="home-prompt">
                    Opiši svoju ideju
                  </label>
                  <input
                    id="home-prompt"
                    value={homePrompt}
                    onChange={(event) => setHomePrompt(event.target.value)}
                    placeholder="Što zamišljaš? Opiši svoj sljedeći kadar…"
                    maxLength={4000}
                  />
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={!homePrompt.trim()}
                  >
                    Otvori studio <ArrowRight size={17} />
                  </button>
                </div>
                <div className="launcher-suggestions">
                  <span>Započni s idejom</span>
                  {[ideas[0], ideas[1], ideas[4]].map((idea) => (
                    <button
                      type="button"
                      key={idea.id}
                      onClick={() => {
                        setHomePrompt(idea.prompt);
                        document.getElementById("home-prompt")?.focus();
                      }}
                    >
                      <Plus size={11} />
                      {idea.category === "Filmski"
                        ? "Neonski grad"
                        : idea.category === "Portreti"
                          ? "Filmski portret"
                          : "Reklama za proizvod"}
                    </button>
                  ))}
                  <span className="launcher-note">
                    Tvoja vizija. Tvoj potpis.
                  </span>
                </div>
              </form>
              <div className="quick-tools">
                <button onClick={() => openStudio()}>
                  <span className="tool-icon violet">
                    <Clapperboard />
                  </span>
                  <div>
                    <h3>Tekst u video</h3>
                    <p>Napiši ideju. Pokreni priču.</p>
                  </div>
                  <ArrowUpRight className="tool-arrow" size={19} />
                </button>
                <button
                  onClick={() =>
                    openStudio(
                      "Animate this image with natural, cinematic motion.",
                      "pika/pika-2.5/image-to-video",
                    )
                  }
                >
                  <span className="tool-icon peach">
                    <Image />
                  </span>
                  <div>
                    <h3>Slika u video</h3>
                    <p>Daj svojim slikama novi život.</p>
                  </div>
                  <ArrowUpRight className="tool-arrow" size={19} />
                </button>
                <button
                  onClick={() => {
                    setCategory("Filmski");
                    document
                      .getElementById("inspiration")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <span className="tool-icon lime">
                    <WandSparkles />
                  </span>
                  <div>
                    <h3>
                      Kreativni predlošci <span>NOVO</span>
                    </h3>
                    <p>Malo inspiracije. Veliki rezultati.</p>
                  </div>
                  <ArrowUpRight className="tool-arrow" size={19} />
                </button>
              </div>
            </>
          )}
          {(view === "explore" || view === "saved") && (
            <section id="inspiration" className="inspiration">
              <div className="section-title">
                <div>
                  <h2>
                    {view === "saved"
                      ? "Tvoja kolekcija inspiracije"
                      : "Pronađi svoju inspiraciju"}
                    <span className="title-spark">✳</span>
                  </h2>
                  <p>
                    {view === "saved"
                      ? "Ideje koje želiš pretvoriti u nešto svoje."
                      : "Otkrij novi stil. Isprobaj ideju. Napravi nešto svoje."}
                  </p>
                </div>
                <button className="text-button" onClick={() => openStudio()}>
                  Otvori studio <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="gallery-toolbar">
                <div className="filter-tabs">
                  {["Sve", "Filmski", "Portreti", "Proizvodi", "Priroda"].map(
                    (c) => (
                      <button
                        key={c}
                        className={category === c ? "active" : ""}
                        aria-pressed={category === c}
                        onClick={() => setCategory(c)}
                      >
                        {c === "Sve" && <Grid2X2 size={13} />} {c}
                      </button>
                    ),
                  )}
                </div>
                <div className="gallery-search">
                  <Search size={15} />
                  <input
                    aria-label="Pretraži inspiraciju"
                    placeholder="Pretraži inspiraciju..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Očisti pretragu"
                      onClick={() => setSearch("")}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="idea-grid">
                {filtered.map((idea) => (
                  <article className="idea-card" key={idea.id}>
                    <button
                      className="idea-image"
                      onClick={() => setSelected(idea)}
                      aria-label={`Pogledaj predložak ${idea.title}`}
                    >
                      <img
                        src={`/images/${idea.image}`}
                        alt={idea.title}
                        loading="lazy"
                      />
                      <div className="image-gradient" />
                      {idea.tag && (
                        <span className="image-tag">
                          {idea.tag === "POPULARNO" ? (
                            <Zap size={10} />
                          ) : (
                            <Sparkles size={10} />
                          )}{" "}
                          {idea.tag}
                        </span>
                      )}
                      <span className="card-type">
                        <Film size={12} /> {idea.category.toUpperCase()}
                      </span>
                      <span className="card-open">
                        <ArrowUpRight size={20} />
                      </span>
                      <span className="card-hover-action">
                        Istraži ideju <ArrowUpRight size={17} />
                      </span>
                    </button>
                    <button
                      className={`save-button ${saved.includes(idea.id) ? "is-saved" : ""}`}
                      aria-label={`${saved.includes(idea.id) ? "Ukloni" : "Spremi"} ${idea.title}`}
                      aria-pressed={saved.includes(idea.id)}
                      onClick={() => toggleSave(idea.id)}
                    >
                      <Bookmark
                        size={15}
                        fill={saved.includes(idea.id) ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      className="idea-info"
                      onClick={() => setSelected(idea)}
                    >
                      <h3>{idea.title}</h3>
                      <p>{idea.subtitle}</p>
                    </button>
                  </article>
                ))}
              </div>
              {filtered.length === 0 && (
                <div className="empty-state">
                  <Bookmark size={32} />
                  <h3>
                    {view === "saved"
                      ? "Ovdje počinje tvoja kolekcija"
                      : "Nema pronađenih ideja"}
                  </h3>
                  <p>
                    {view === "saved"
                      ? "Spremi inspiraciju klikom na oznaku na kartici."
                      : "Pokušaj s drugim pojmom ili kategorijom."}
                  </p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      navigate("explore");
                      setCategory("Sve");
                    }}
                  >
                    Istraži sve ideje <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <div className="gallery-note">
                <span>
                  <Sparkles size={13} /> Fotografije služe kao inspiracija.
                  Svaku ideju možeš prilagoditi u studiju.
                </span>
                <button onClick={() => navigate("models")}>
                  Istraži sve modele <ArrowRight size={14} />
                </button>
              </div>
            </section>
          )}
          {studioOpened && (
            <div hidden={view !== "studio"}>
              <Studio
                key={studioKey}
                initialPrompt={prompt}
                initialApiId={modelId}
                initialInput={initialInput}
                connected={connected}
                onConnect={openConnection}
                onJobCreated={jobCreated}
              />
            </div>
          )}
          {view === "models" && (
            <section className="catalog-page">
              <div className="page-intro">
                <div>
                  <div className="eyebrow">PRAVI ALAT ZA SVAKU IDEJU</div>
                  <h1>
                    Svi modeli. Jedan studio<span>.</span>
                  </h1>
                  <p className="muted">
                    Pronađi model za svoj sljedeći video, sliku ili zvuk.
                  </p>
                </div>
                <span className="catalog-live">
                  <i /> KATALOG UŽIVO
                </span>
              </div>
              <div className="catalog-toolbar">
                <div className="filter-tabs">
                  {[
                    ["all", "Sve"],
                    ["video", "Video"],
                    ["image", "Slike"],
                    ["audio", "Audio"],
                    ...[...new Set(catalog.map((m) => m.category))]
                      .filter((c) => !["video", "image", "audio"].includes(c))
                      .map((c) => [c, c]),
                  ].map(([id, name]) => (
                    <button
                      key={id}
                      aria-pressed={modelCategory === id}
                      className={modelCategory === id ? "active" : ""}
                      onClick={() => setModelCategory(id)}
                    >
                      {name}
                      <span>
                        {id === "all"
                          ? catalog.length
                          : catalog.filter((m) => m.category === id).length}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="model-search gallery-search">
                  <Search size={17} />
                  <input
                    placeholder="Pronađi model ili alat…"
                    aria-label="Pretraži modele"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                  />
                  {modelSearch && (
                    <button
                      aria-label="Očisti pretragu modela"
                      onClick={() => setModelSearch("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
              {catalogLoading && (
                <div
                  className="catalog-skeleton"
                  aria-label="Učitavanje modela"
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i}>
                      <span />
                      <i />
                      <i />
                    </div>
                  ))}
                </div>
              )}
              {catalogError && (
                <div className="error-box" role="alert">
                  {catalogError}
                  <button onClick={() => setCatalogRetry((n) => n + 1)}>
                    Pokušaj ponovno
                  </button>
                </div>
              )}
              {!catalogLoading && (
                <div className="catalog-count">
                  {shownModels.length} dostupnih alata{" "}
                  <span>Postavke i cijene prikazuju se u studiju.</span>
                </div>
              )}
              <div className="models-grid">
                {shownModels.map((m) => (
                  <button
                    className="model-card"
                    key={m.api_id}
                    onClick={() => openStudio("", m.api_id)}
                  >
                    <div className="model-card-top">
                      <span
                        className={`model-vendor vendor-${m.vendor?.toLowerCase().replace(/[^a-z]/g, "")}`}
                      >
                        {(m.vendor || m.name || "AI").slice(0, 2)}
                      </span>
                      <span className="model-category">
                        {m.category === "video"
                          ? "VIDEO"
                          : m.category === "image"
                            ? "SLIKA"
                            : m.category === "audio"
                              ? "AUDIO"
                              : m.category}
                      </span>
                      <ArrowUpRight size={17} />
                    </div>
                    <span className="model-body">
                      <h3>{m.name || m.api_id}</h3>
                      <p>
                        {m.description ||
                          "Odaberi postavke, dodaj svoju ideju i stvori novi rezultat."}
                      </p>
                    </span>
                    <span className="model-card-bottom">
                      <span>{m.vendor || m.api_id.split("/")[0]}</span>
                      <span>
                        {(
                          {
                            "text-to-video": "Tekst → video",
                            "image-to-video": "Slika → video",
                            "text-to-image": "Tekst → slika",
                            "image-to-image": "Slika → slika",
                            "text-to-audio": "Tekst → audio",
                          } as Record<string, string>
                        )[m.function] ||
                          m.function ||
                          "Otvori studio"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {!catalogLoading && !catalogError && shownModels.length === 0 && (
                <div className="empty-state">
                  <Search />
                  <h3>Nema pronađenih modela</h3>
                  <p>Pokušaj s drugim nazivom ili odaberi drugu kategoriju.</p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setModelSearch("");
                      setModelCategory("all");
                    }}
                  >
                    Prikaži sve modele
                  </button>
                </div>
              )}
            </section>
          )}
          {view === "creations" && (
            <Library
              jobs={jobs}
              connected={connected}
              onConnect={openConnection}
              onCreate={() => openStudio()}
              onUpdate={jobCreated}
              onReuse={(text, id, input) => openStudio(text, id, input)}
              onDelete={(id) => {
                deletedJobIds.current.add(id);
                try {
                  sessionStorage.setItem(
                    "hf-deleted-generations",
                    JSON.stringify([...deletedJobIds.current].slice(-200)),
                  );
                  const active = JSON.parse(
                    sessionStorage.getItem("hf-active-generation") || "null",
                  );
                  if (active?.job?.id === id)
                    sessionStorage.removeItem("hf-active-generation");
                } catch {}
                setJobs((prev) => prev.filter((job) => job.id !== id));
                notify("Kreacija je uklonjena iz lokalne povijesti.");
              }}
            />
          )}
          <footer className="footer">
            <span>
              <span className="footer-mark">✳</span> Mašta nema granice. Kreni
              stvarati.
            </span>
            <span>Neovisni kreativni studio · Pika API Club</span>
          </footer>
        </main>
      </div>
      {connectOpen && (
        <Modal
          label="Poveži Pika API Club"
          onClose={() => {
            setConnectOpen(false);
            setKey("");
            setConnectError("");
          }}
        >
          <span className="modal-symbol">
            <KeyRound size={25} />
          </span>
          <div className="eyebrow">TVOJ KLJUČ DO NOVIH IDEJA</div>
          <h2>
            {connected
              ? "Tvoj studio je povezan."
              : "Poveži svoj kreativni studio."}
          </h2>
          <p className="modal-description">
            {connected
              ? "Tvoj Pika API Club ključ aktivan je za ovu sesiju."
              : "Unesi svoj Pika API Club ključ i pristupi dostupnim modelima izravno iz studija."}
          </p>
          {sessionStatus === "unavailable" && (
            <div className="connection-modal-note" role="status">
              <AlertCircle size={15} />
              <span>
                Provjera računa nije dostupna. Prikazano stanje možda nije
                aktualno.
              </span>
              <button onClick={() => void checkSession()}>Ponovi</button>
            </div>
          )}
          {connected ? (
            <>
              <div className="connected-notice">
                <ShieldCheck size={22} />
                <div>
                  <strong>Pika API Club je povezan</strong>
                  <span>Ključ je zaštićen šifriranom sesijom.</span>
                </div>
                <Check size={18} />
              </div>
              {balance !== null && Number.isFinite(balance) && (
                <div className="account-balance">
                  <span>Stanje Pika računa</span>
                  <strong>${balance.toFixed(2)}</strong>
                </div>
              )}
              <button
                className="primary-button full-width"
                onClick={() => {
                  setConnectOpen(false);
                  navigate("studio");
                }}
              >
                Otvori studio <ArrowUpRight size={17} />
              </button>
              <button className="disconnect-button" onClick={disconnect}>
                Odspoji API ključ
              </button>
              {connectError && (
                <div role="alert" className="error-box">
                  {connectError}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={connect}>
              <label className="field-label" htmlFor="api-key">
                API ključ
              </label>
              <div className="key-field">
                <input
                  id="api-key"
                  className="key-input"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  placeholder="Zalijepi svoj API ključ"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  required
                />
                <button
                  type="button"
                  aria-label={
                    showKey ? "Sakrij API ključ" : "Prikaži API ključ"
                  }
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <div className="key-security">
                <ShieldCheck size={14} />
                <span>
                  Ključ je šifriran u zaštićenoj sesiji i ne zapisuje se u logove.
                </span>
              </div>
              {connectError && (
                <div role="alert" className="error-box">
                  {connectError}
                </div>
              )}
              <button
                className="primary-button full-width"
                type="submit"
                disabled={connecting || !key.trim()}
              >
                {connecting ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <KeyRound size={16} />
                )}{" "}
                {connecting
                  ? "Provjeravam ključ..."
                  : "Poveži i počni stvarati"}
                <ArrowRight size={17} />
              </button>
              <p className="get-key">
                Još nemaš ključ?{" "}
                <a href="https://dev.pika.art" target="_blank" rel="noreferrer">
                  Otvori Pika API Club <ArrowUpRight size={12} />
                </a>
              </p>
              <div className="modal-fineprint">
                Generiranje troši sredstva na tvom Pika računu. Cijenu možeš
                provjeriti prije slanja zahtjeva.
              </div>
            </form>
          )}
        </Modal>
      )}
      {selected && (
        <Modal wide label={selected.title} onClose={() => setSelected(null)}>
          <div className="idea-detail">
            <img src={`/images/${selected.image}`} alt={selected.title} />
            <div>
              <div className="eyebrow">{selected.category} · VIDEO IDEJA</div>
              <h2>{selected.title}</h2>
              <p className="muted">{selected.subtitle}</p>
              <label className="field-label">POČETNA IDEJA</label>
              <p className="prompt-preview">{selected.prompt}</p>
              <button
                className="copy-prompt"
                onClick={() => copyPrompt(selected.prompt)}
              >
                {copied ? <CheckCheck size={14} /> : <Copy size={14} />}{" "}
                {copied ? "Kopirano" : "Kopiraj opis"}
              </button>
              <p className="detail-note">
                Fotografija je vizualna inspiracija. Ovaj predložak prenosi
                tekstualni opis u studio, gdje ga možeš prilagoditi.
              </p>
              <button
                className="primary-button full-width"
                onClick={() => openStudio(selected.prompt)}
              >
                Isprobaj ovu ideju <ArrowUpRight size={17} />
              </button>
              <button
                className="secondary-button full-width"
                onClick={() => toggleSave(selected.id)}
              >
                <Bookmark size={16} />
                {saved.includes(selected.id)
                  ? "Ukloni iz spremljenog"
                  : "Spremi za kasnije"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {helpOpen && (
        <Modal label="Kako radi studio" onClose={() => setHelpOpen(false)}>
          <span className="modal-symbol">
            <Sparkles size={25} />
          </span>
          <h2>
            Od ideje do videa.
            <br />U tri koraka.
          </h2>
          <div className="help-steps">
            {[
              [
                "01",
                "Poveži svoj ključ",
                "API ključ preuzmi u svom Pika API Club računu. Studio ga koristi samo u tvojoj sesiji.",
              ],
              [
                "02",
                "Daj mašti smjer",
                "Odaberi model, napiši opis ili učitaj sliku. Isprobaj i ideje iz naše galerije.",
              ],
              [
                "03",
                "Provjeri cijenu i stvaraj",
                "Provjeri procijenjenu cijenu, pokreni generiranje i pričekaj rezultat. Preuzmi dovršeni video iz studija.",
              ],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            className="primary-button full-width"
            onClick={() => {
              setHelpOpen(false);
              openStudio();
            }}
          >
            Krenimo <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {commandOpen && (
        <CommandMenu
          actions={commands}
          loading={catalogLoading}
          onClose={() => setCommandOpen(false)}
        />
      )}
      {toast && (
        <div
          className={`toast toast-${toastTone}`}
          role={toastTone === "error" ? "alert" : "status"}
        >
          {toastTone === "success" ? (
            <Check size={17} />
          ) : (
            <AlertCircle size={17} />
          )}
          {toast}
          <button
            className="icon-button"
            aria-label="Zatvori obavijest"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
