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
import "./reference-upload.css";

type Props = {
  accept: string;
  disabled: boolean;
  uploading: boolean;
  onFile: (file: File) => void;
};

const supportedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
]);
const extensionTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
};
const aliases: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "audio/x-m4a": "audio/mp4",
  "audio/x-aac": "audio/aac",
  "audio/vnd.wave": "audio/wav",
};
const formatNames: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "video/mp4": "MP4",
  "video/webm": "WEBM",
  "video/quicktime": "MOV",
  "audio/mpeg": "MP3",
  "audio/mp3": "MP3",
  "audio/wav": "WAV",
  "audio/x-wav": "WAV",
  "audio/mp4": "M4A",
  "audio/aac": "AAC",
  "audio/ogg": "OGG",
  "audio/webm": "WEBM",
};
function acceptTokens(accept: string) {
  return accept
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}
function accepted(type: string, filename: string, tokens: string[]) {
  if (!tokens.length || tokens.includes("*/*")) return true;
  return tokens.some((token) =>
    token.startsWith(".")
      ? filename.toLowerCase().endsWith(token)
      : token.endsWith("/*")
        ? type.startsWith(token.slice(0, -1))
        : type === (aliases[token] || token),
  );
}

export default function ReferenceUpload({
  accept,
  disabled,
  uploading,
  onFile,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const id = useId();
  const tokens = acceptTokens(accept);
  const available = [...supportedTypes].filter((type) =>
    accepted(
      type,
      `file.${Object.keys(extensionTypes).find((ext) => extensionTypes[ext] === type) || ""}`,
      tokens,
    ),
  );
  const families = [...new Set(available.map((type) => type.split("/")[0]))];
  const kind = families.length === 1 ? families[0] : "file";
  const Icon =
    kind === "image"
      ? ImagePlus
      : kind === "video"
        ? Video
        : kind === "audio"
          ? Music2
          : FileImage;
  const formats = [...new Set(available.map((type) => formatNames[type]))].join(
    ", ",
  );
  const limit =
    kind === "video"
      ? "Do 50 MB"
      : kind === "image" || kind === "audio"
        ? "Do 20 MB"
        : "Slike/audio do 20 MB · video do 50 MB";
  const fileLabel =
    kind === "image"
      ? "sliku"
      : kind === "video"
        ? "video"
        : kind === "audio"
          ? "audio"
          : "datoteku";
  const locked = disabled || uploading;

  function choose(files: FileList | File[] | null) {
    if (locked || !files) return;
    if (files.length !== 1) {
      setError(
        "Odaberi jednu datoteku. Više referenci možeš učitati jednu po jednu.",
      );
      return;
    }
    const original = files[0];
    const extension = original.name.split(".").pop()?.toLowerCase() || "";
    const reported = original.type.toLowerCase();
    const type =
      aliases[reported] ||
      (!reported || reported === "application/octet-stream"
        ? extensionTypes[extension] || ""
        : reported);
    if (!supportedTypes.has(type)) {
      setError(
        "Ovaj format nije podržan. Odaberi datoteku u jednom od navedenih formata.",
      );
      return;
    }
    if (!accepted(type, original.name, tokens)) {
      setError(`Za ovo polje odaberi ${fileLabel} u podržanom formatu.`);
      return;
    }
    if (!original.size) {
      setError("Datoteka je prazna. Odaberi drugu datoteku.");
      return;
    }
    const limitMb = type.startsWith("video/") ? 50 : 20;
    if (original.size > limitMb * 1024 * 1024) {
      setError(
        `Datoteka je prevelika. Najveća dopuštena veličina je ${limitMb} MB.`,
      );
      return;
    }
    setError("");
    setFilename(original.name);
    const file =
      type === original.type
        ? original
        : new File([original], original.name, {
            type,
            lastModified: original.lastModified,
          });
    onFile(file);
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
        <span>{limit}</span>
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
