/**
 * Il campo di rinomina di un'era — Story 3.2, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §5 (T25.7).
 *
 * Una riga di testo: il **nome** dell'era e le sue **parole chiave**, separati
 * da virgola (`nome, viaggio a Berlino, esame di laurea`). Il testo è locale
 * e resta in `Insight.userNote`.
 *
 * Il componente non conosce l'i18n: le etichette arrivano già rese.
 */

import { NoteField } from './NoteField';

export interface EraNoteFieldProps {
  /** L'era da rinominare. */
  readonly eraId: string;
  /** L'etichetta generata dal motore (il fallback). */
  readonly label: string;
  /** La nota corrente dell'utente. */
  readonly userNote: string | null;
  /** L'`aria-label` del campo, già resa. */
  readonly ariaLabel: string;
  /** Salva la nota. */
  readonly onSave: (eraId: string, note: string) => void;
}

export function EraNoteField({ eraId, label, userNote, ariaLabel, onSave }: EraNoteFieldProps) {
  return (
    <NoteField
      fieldId={`era-note-${eraId}`}
      label={label}
      value={userNote}
      ariaLabel={ariaLabel}
      onSave={(note) => {
        onSave(eraId, note);
      }}
    />
  );
}
