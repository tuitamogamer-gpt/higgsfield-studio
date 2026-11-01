import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Layers3, Search, Star, X } from "lucide-react";
import "./model-picker.css";

type Model = {
  api_id: string;
  name: string;
  category: string;
  vendor: string;
  function?: string;
};
type Props = {
  models: Model[];
  value: string;
  onChange: (apiId: string) => void;
  disabled?: boolean;
  loading?: boolean;
};
const FAVORITES_KEY = "hf-favorite-models";
const functionLabels: Record<string, string> = {
  "text-to-video": "Tekst → video",
  "image-to-video": "Slika → video",
  "video-to-video": "Video → video",
  "text-to-image": "Tekst → slika",
  "image-to-image": "Slika → slika",
  "text-to-audio": "Tekst → audio",
  "text-to-speech": "Tekst → govor",
  "speech-to-text": "Govor → tekst",
};
function readFavorites(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(saved)
      ? [
          ...new Set(
            saved.filter((id): id is string => typeof id === "string"),
          ),
        ].slice(0, 300)
      : [];
  } catch {
    return [];
  }
}
const vendorName = (model: Model) =>
  model.vendor || model.api_id.split("/")[0] || "AI";

export default function ModelPicker({
  models,
  value,
  onChange,
  disabled = false,
  loading = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState(readFavorites);
  const [storageNotice, setStorageNotice] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const selected = models.find((model) => model.api_id === value);
  const favoriteCount = models.filter((model) =>
    favorites.includes(model.api_id),
  ).length;
  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return models
      .filter(
        (model) =>
          (!onlyFavorites || favorites.includes(model.api_id)) &&
          `${model.name} ${vendorName(model)} ${model.api_id} ${functionLabels[model.function || ""] || ""}`
            .toLocaleLowerCase()
            .includes(term),
      )
      .sort(
        (a, b) =>
          Number(favorites.includes(b.api_id)) -
            Number(favorites.includes(a.api_id)) ||
          a.name.localeCompare(b.name),
      );
  }, [models, search, favorites, onlyFavorites]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (!event.key || event.key === FAVORITES_KEY)
        setFavorites(readFavorites());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (disabled || loading) setOpen(false);
  }, [disabled, loading]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    searchInput.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
        ) || [],
      );
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus();
    };
  }, [open]);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setStorageNotice("");
    } catch {
      setStorageNotice(
        "Favoriti su dostupni za ovu posjetu. Preglednik trenutačno ne dopušta spremanje.",
      );
    }
  }
  function choose(id: string) {
    onChange(id);
    setOpen(false);
  }
  function moveChoice(direction: number) {
    const choices = Array.from(
      dialog.current?.querySelectorAll<HTMLButtonElement>(
        "[data-model-choice]",
      ) || [],
    );
    if (!choices.length) return;
    const index = choices.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      index < 0
        ? direction > 0
          ? 0
          : choices.length - 1
        : (index + direction + choices.length) % choices.length;
    choices[next].focus();
    choices[next].scrollIntoView({ block: "nearest" });
  }

  return (
    <>
      <button
        id="studio-model"
        ref={trigger}
        type="button"
        className="mp-trigger"
        disabled={disabled || loading || !models.length}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setSearch("");
          setOnlyFavorites(false);
          setOpen(true);
        }}
      >
        <span className="mp-trigger-symbol">
          <Layers3 size={18} />
        </span>
        <span className="mp-trigger-copy">
          <strong>
            {loading ? "Učitavanje modela…" : selected?.name || "Odaberi model"}
          </strong>
          <span>
            {selected
              ? `${vendorName(selected)} · ${functionLabels[selected.function || ""] || selected.function || "AI model"}`
              : "Pronađi pravi model za svoju ideju"}
          </span>
        </span>
        <ChevronDown size={15} />
      </button>
      {open &&
        createPortal(
          <div
            className="mp-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <div
              className="mp-dialog"
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <div className="mp-header">
                <div>
                  <span className="mp-eyebrow">PRAVI MODEL ZA TVOJU IDEJU</span>
                  <h2 id={titleId}>Odaberi svoj alat.</h2>
                </div>
                <button
                  className="mp-close"
                  type="button"
                  aria-label="Zatvori izbor modela"
                  onClick={() => setOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mp-search">
                <Search size={18} />
                <input
                  ref={searchInput}
                  type="search"
                  aria-label="Pretraži dostupne modele"
                  placeholder="Naziv modela, pružatelj ili vrsta zadatka…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      moveChoice(event.key === "ArrowDown" ? 1 : -1);
                    }
                    if (event.key === "Enter" && matches.length === 1) {
                      event.preventDefault();
                      choose(matches[0].api_id);
                    }
                  }}
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Očisti pretragu modela"
                    onClick={() => {
                      setSearch("");
                      searchInput.current?.focus();
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <div className="mp-tabs">
                <button
                  type="button"
                  aria-pressed={!onlyFavorites}
                  className={!onlyFavorites ? "active" : ""}
                  onClick={() => setOnlyFavorites(false)}
                >
                  Svi modeli <span>{models.length}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={onlyFavorites}
                  className={onlyFavorites ? "active" : ""}
                  onClick={() => setOnlyFavorites(true)}
                >
                  <Star size={13} /> Favoriti <span>{favoriteCount}</span>
                </button>
                <span className="mp-count" role="status" aria-live="polite">
                  {matches.length} rezultata
                </span>
              </div>
              <div
                className="mp-results"
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    moveChoice(event.key === "ArrowDown" ? 1 : -1);
                  }
                }}
              >
                {matches.length ? (
                  <ul>
                    {matches.map((model) => (
                      <li
                        key={model.api_id}
                        className={model.api_id === value ? "selected" : ""}
                      >
                        <button
                          type="button"
                          className="mp-option"
                          data-model-choice
                          aria-pressed={model.api_id === value}
                          onClick={() => choose(model.api_id)}
                        >
                          <span className="mp-vendor" aria-hidden="true">
                            {vendorName(model).slice(0, 2)}
                          </span>
                          <span className="mp-option-copy">
                            <strong>{model.name || model.api_id}</strong>
                            <span>
                              {vendorName(model)}
                              <i />
                              {functionLabels[model.function || ""] ||
                                model.function ||
                                model.category}
                            </span>
                          </span>
                          {model.api_id === value && (
                            <Check className="mp-selected-check" size={16} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={`mp-favorite ${favorites.includes(model.api_id) ? "saved" : ""}`}
                          aria-label={`${favorites.includes(model.api_id) ? "Ukloni iz favorita" : "Dodaj u favorite"}: ${model.name}`}
                          aria-pressed={favorites.includes(model.api_id)}
                          onClick={() => toggleFavorite(model.api_id)}
                        >
                          <Star
                            size={16}
                            fill={
                              favorites.includes(model.api_id)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mp-empty">
                    {onlyFavorites && !favoriteCount ? (
                      <Star size={28} />
                    ) : (
                      <Search size={28} />
                    )}
                    <h3>
                      {onlyFavorites && !favoriteCount
                        ? "Tvoji omiljeni modeli, pri ruci."
                        : "Nema pronađenih modela."}
                    </h3>
                    <p>
                      {onlyFavorites && !favoriteCount
                        ? "Označi model zvjezdicom i pronađi ga ovdje sljedeći put."
                        : "Pokušaj s drugim nazivom ili ukloni filtar favorita."}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setOnlyFavorites(false);
                        searchInput.current?.focus();
                      }}
                    >
                      Prikaži sve modele
                    </button>
                  </div>
                )}
              </div>
              <div className="mp-footer">
                <span>
                  {storageNotice ||
                    "Modeli za odabranu vrstu sadržaja · cijenu provjeravaš prije generiranja."}
                </span>
                <span className="mp-key-hint">
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> odabir <kbd>esc</kbd> zatvori
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
