import { useId, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  AlertCircle,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Music2,
  Upload,
  Video,
} from "lucide-react";
import { prepareReferenceFile, referenceRules } from "./lib/reference.ts";

type Props = {
  accept: string;
  disabled: boolean;
  uploading: boolean;
  /** Shows that an image can also be pasted while the studio is open. */
  pasteHint?: boolean;
  onFile: (file: File) => void;
};

export default function ReferenceUpload({
  accept,
  disabled,
  uploading,
  pasteHint = false,
  onFile,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const id = useId();
  const { available, kind, formats, limitLabel, fileLabel } =
    referenceRules(accept);
  const Icon =
    kind === "image"
      ? ImagePlus
      : kind === "video"
        ? Video
        : kind === "audio"
          ? Music2
          : FileImage;
  const locked = disabled || uploading;
  const pasteKey = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

  function choose(files: FileList | File[] | null) {
    if (locked || !files) return;
    if (files.length !== 1) {
      setError(
        "Odaberi jednu datoteku. Više referenci možeš učitati jednu po jednu.",
      );
      return;
    }
    const prepared = prepareReferenceFile(files[0], accept);
    if (!prepared.file) {
      setError(prepared.error);
      return;
    }
    setError("");
    setFilename(prepared.file.name);
    onFile(prepared.file);
  }
  function hasFiles(event: DragEvent) {
    return event.dataTransfer.types.includes("Files");
  }

  return (
    <div className="ref-upload">
      <input
        ref={input}
        type="file"
        accept={available.length ? available.join(",") : accept}
        disabled={locked}
        tabIndex={-1}
        className="ref-upload-input"
        aria-label={`Odaberi referentnu ${kind === "image" ? "sliku" : "datoteku"}`}
        onChange={(event) => {
          choose(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        className={`ref-upload-zone${dragging && !locked ? " is-dragging" : ""}${uploading ? " is-uploading" : ""}${error ? " has-error" : ""}`}
        aria-label={
          uploading ? "Prijenos datoteke je u tijeku" : `Učitaj ${fileLabel}`
        }
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        aria-busy={uploading}
        disabled={locked}
        onClick={() => input.current?.click()}
        onDragEnter={(event) => {
          if (hasFiles(event)) {
            event.preventDefault();
            dragDepth.current++;
            if (!locked) setDragging(true);
          }
        }}
        onDragOver={(event) => {
          if (hasFiles(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = locked ? "none" : "copy";
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          choose(event.dataTransfer.files);
        }}
      >
        <span className="ref-upload-icon">
          {uploading ? (
            <LoaderCircle size={22} className="ref-upload-spinner" />
          ) : (
            <Icon size={23} strokeWidth={1.6} />
          )}
        </span>
        <span className="ref-upload-content">
          <strong>
            {uploading
              ? "Učitavam tvoju referencu…"
              : dragging && !locked
                ? "Ispusti datoteku ovdje"
                : `Povuci ${fileLabel} ovdje`}
          </strong>
          <span>
            {uploading ? (
              filename || "Prijenos u tijeku"
            ) : disabled ? (
              "Pričekaj završetak trenutnog zahtjeva."
            ) : (
              <>
                ili <em>odaberi datoteku</em> sa svog uređaja
              </>
            )}
          </span>
        </span>
        {!uploading && !disabled && (
          <Upload size={16} className="ref-upload-arrow" />
        )}
      </button>
      <div id={`${id}-hint`} className="ref-upload-hint">
        <span>{formats || "Podržani medijski formati"}</span>
        {pasteHint && !locked && (
          <span className="ref-upload-paste">
            ili zalijepi sliku <kbd>{pasteKey}</kbd>+<kbd>V</kbd>
          </span>
        )}
        <span>{limitLabel}</span>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="ref-upload-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
