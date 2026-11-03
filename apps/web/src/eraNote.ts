/**
 * La nota libera dell'utente su un'era — Story 3.2, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §5 e D-25.4.
 *
 * Il testo vive in `Insight.userNote` (il campo esiste già: nessuna
 * migrazione dello schema). Il formato è **una riga di testo**: la prima
 * parte, separata da virgola, è il **nome** dell'era; le successive sono
 * le **parole chiave**. Il core non interpreta nulla: la divisione è
 * dell'app, perché il testo è dato personale dell'utente.
 *
 *   "nome, viaggio a Berlino, esame di laurea"
 *        └────┘  └──────────────────┘ └──────────────┘
 *          nome        parole chiave 1     parole chiave 2
 */

/** Una nota interpretata. */
export interface EraNote {
  /** Il nome dato dall'utente (`null` se la nota non ha un nome). */
  readonly name: string | null;
  /** Le parole chiave, senza vuoti. */
  readonly tags: readonly string[];
}

/** Divide la nota dell'utente in nome e parole chiave. */
export function parseEraNote(note: string | null): EraNote {
  if (note === null) return { name: null, tags: [] };
  const parts = note
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return { name: null, tags: [] };
  const [name, ...tags] = parts;
  return { name: name ?? null, tags };
}

/** Compone la nota dell'utente da nome e parole chiave. */
export function formatEraNote(name: string, tags: readonly string[] = []): string {
  return [name.trim(), ...tags.map((tag) => tag.trim())]
    .filter((part) => part.length > 0)
    .join(', ');
}

/**
 * Il nome da mostrare per un'era: quello dell'utente se c'è, altrimenti
 * l'etichetta generata dal motore (`insight.era.label`).
 */
export function eraDisplayName(userNote: string | null, fallback: string): string {
  const { name } = parseEraNote(userNote);
  return name ?? fallback;
}
