import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, CornerDownLeft, Search, X } from "lucide-react";
import "./command-menu.css";
export type CommandAction = {
  id: string;
  label: string;
  description: string;
  group: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
};
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function CommandMenu({
  actions,
  onClose,
  loading = false,
}: {
  actions: CommandAction[];
  onClose: () => void;
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const search = normalize(query.trim());
  const matches = actions
    .filter((a) =>
      search
        ? normalize(`${a.label} ${a.description} ${a.keywords || ""}`).includes(
            search,
          )
        : a.group === "Tvoj studio",
    )
    .slice(0, search ? 18 : 7);
  useEffect(() => {
    setActive(0);
  }, [query]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    input.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    document
      .getElementById(`command-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  const choose = (action: CommandAction) => {
    onClose();
    action.run();
  };
  return (
    <div
      className="command-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="command-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Brza pretraga"
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            if (document.activeElement === input.current)
              event.currentTarget
                .querySelector<HTMLButtonElement>(".command-search button")
                ?.focus();
            else input.current?.focus();
          }
        }}
      >
        <div className="command-search">
          <Search size={21} />
          <input
            ref={input}
            role="combobox"
            aria-label="Pretraži modele, ideje i alate"
            aria-controls="command-results"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-activedescendant={
              matches.length
                ? `command-${Math.min(active, matches.length - 1)}`
                : undefined
            }
            value={query}
            placeholder="Model, ideja ili sljedeći korak…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) =>
                  matches.length
                    ? (i +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        matches.length) %
                      matches.length
                    : 0,
                );
              }
              if (
                event.key === "Enter" &&
                matches[Math.min(active, matches.length - 1)]
              ) {
                event.preventDefault();
                choose(matches[Math.min(active, matches.length - 1)]);
              }
            }}
          />
          <button aria-label="Zatvori pretragu" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div
          className="command-results"
          id="command-results"
          role="listbox"
          aria-label="Rezultati pretrage"
        >
          {matches.map((action, index) => (
            <div key={action.id}>
              {(index === 0 || matches[index - 1].group !== action.group) && (
                <div className="command-group" role="presentation">
                  {action.group}
                </div>
              )}
              <button
                id={`command-${index}`}
                className={`command-option ${index === Math.min(active, matches.length - 1) ? "selected" : ""}`}
                role="option"
                aria-selected={index === Math.min(active, matches.length - 1)}
                tabIndex={-1}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(action)}
              >
                <span className="command-icon">{action.icon}</span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          ))}
          {!matches.length && (
            <div className="command-empty">
              <Search size={26} />
              <strong>
                {loading ? "Učitavam modele…" : "Nema rezultata za ovu ideju."}
              </strong>
              <p>Pokušaj naziv modela, „video” ili „inspiracija”.</p>
            </div>
          )}
        </div>
        <div className="command-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> za odabir
          </span>
          <span>
            <kbd>
              <CornerDownLeft size={11} />
            </kbd>{" "}
            otvori
          </span>
          <span>
            <kbd>esc</kbd> zatvori
          </span>
          <span className="command-count">
            {loading ? "Učitavanje kataloga…" : `${matches.length} rezultata`}
          </span>
        </div>
      </section>
    </div>
  );
}
