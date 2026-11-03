/**
 * Il campo di nota libera — Story 3.2, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §5 (D-25.4).
 *
 * Una riga di testo: il **nome** e le **parole chiave** che l'utente dà a un
 * ricordo o a un'era. Il testo è locale e resta in `Insight.userNote`: nessuna
 * migrazione dello schema, nessun dato esce dal dispositivo.
 *
 * Il componente non conosce l'i18n: le etichette arrivano già rese.
 */

import { useEffect, useState } from 'react';

export interface NoteFieldProps {
  /** L'id del campo (usato per il `data-testid` e per l'`id` dell'input). */
  readonly fieldId: string;
  /** L'etichetta mostrata (il fallback quando la nota è vuota). */
  readonly label: string;
  /** La nota corrente dell'utente. */
  readonly value: string | null;
  /** L'`aria-label` del campo, già resa. */
  readonly ariaLabel: string;
  /** Salva la nota (stringa vuota = nessuna nota). */
  readonly onSave: (note: string) => void;
}

export function NoteField({ fieldId, label, value, ariaLabel, onSave }: NoteFieldProps) {
  const [text, setText] = useState(value ?? '');

  useEffect(() => {
    setText(value ?? '');
  }, [value]);

  const save = () => {
    onSave(text.trim());
  };

  return (
    <div className="note-field" data-testid={fieldId}>
      <label className="note-field__label" htmlFor={`${fieldId}-input`}>
        {label}
      </label>
      <input
        id={`${fieldId}-input`}
        className="note-field__input"
        type="text"
        value={text}
        placeholder={label}
        aria-label={ariaLabel}
        data-testid={`${fieldId}-input`}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            save();
          }
        }}
      />
    </div>
  );
}
