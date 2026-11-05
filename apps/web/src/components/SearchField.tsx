/**
 * Campo di ricerca — Story 3.3, spec `docs/25-MEMORIES-SHARE-EXPLORE.md` §6.
 *
 * Il campo è un `<input type="search">` con `role="searchbox"` ed
 * `aria-label` esplicito: è l'unico modo che ha l'utente di interrovare il
 * proprio diario, e deve essere raggiungibile e leggibile con la tastiera.
 *
 * Il componente **non conosce l'i18n**: le etichette arrivano già rese dalla
 * schermata (la regola dei componenti di questa app, `07§2.10`).
 */

import type { ChangeEvent } from 'react';

export interface SearchFieldProps {
  /** Il testo cercato. */
  readonly value: string;
  /** Callback a ogni cambio del testo. */
  readonly onChange: (value: string) => void;
  /** L'`aria-label` del campo, già resa. */
  readonly label: string;
  /** Il testo segnaposto, già reso. */
  readonly placeholder?: string | undefined;
  /** L'id del campo (per i test e per i label). */
  readonly fieldId?: string | undefined;
}

export function SearchField({ value, onChange, label, placeholder, fieldId }: SearchFieldProps) {
  return (
    <div className="search-field">
      <input
        id={fieldId ?? 'explore-search'}
        type="search"
        role="searchbox"
        className="search-field__input"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}
