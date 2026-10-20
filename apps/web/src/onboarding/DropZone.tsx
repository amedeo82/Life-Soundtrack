/**
 * Area di trascinamento file con fallback "sfoglia".
 * A11y (07-UI-SPEC §2.6): role="region", aria-label, aria-describedby,
 * Enter/Space per aprire il file picker.
 */
import { useCallback, useRef, useState } from 'react';

export interface DropZoneProps {
  acceptedFormats?: string[]; // es. ['.zip', '.json']
  onDrop: (files: FileList) => void;
  onBrowse?: () => void;
  label?: string; // testo già tradotto (es. "Trascina qui il file")
  browseLabel?: string; // testo già tradotto (es. "Oppure sfoglia")
  hint?: string; // testo già tradotto per aria-describedby
  active?: boolean; // drag-over esterno
  disabled?: boolean;
}

export function DropZone({
  acceptedFormats,
  onDrop,
  onBrowse,
  label = 'Trascina qui il file',
  browseLabel = 'Oppure sfoglia',
  hint = 'Trascina un file qui oppure clicca per sfogliare',
  active = false,
  disabled = false,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = acceptedFormats ? acceptedFormats.join(',') : '.zip,.json';

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (disabled || !e.dataTransfer?.files.length) {
        return;
      }
      onDrop(e.dataTransfer.files);
    },
    [disabled, onDrop],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        onDrop(e.target.files);
      }
    },
    [onDrop],
  );

  const hintId = 'drop-zone-hint';

  return (
    <div
      role="region"
      aria-label={label}
      aria-describedby={hintId}
      data-testid="drop-zone"
      data-active={dragging || active ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      className="drop-zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
    >
      {dragging || active && <div className="drop-zone-overlay visible" />}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={handleInputChange}
      />
      <div className="drop-zone-content">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="drop-zone-label">{label}</p>
        {onBrowse && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
          >
            <span data-testid="browse-btn">{browseLabel}</span>
          </button>
        )}
      </div>
      <p id={hintId} className="drop-zone-hint">
        {hint}
      </p>
    </div>
  );
}
