/**
 * La navigazione dell'app — Story 3.3, spec `docs/25-MEMORIES-SHARE-EXPLORE.md` §"Navigazione".
 *
 * La navigazione è a **stato**, senza librerie di routing (D-25.1): il
 * progetto non ha un router e non ne ha bisogno. Aggiungerne uno per tre
 * schermate sarebbe un costo senza beneficio, e il deep-link è un contratto
 * **interno**.
 *
 * Il modulo è separato da `AppShell.tsx` per non creare un import circolare:
 * le schermate (Esplora, Analisi) ricevono il tipo del focus, e la shell
 * riceve le schermate.
 */

/** Le schermate raggiungibili dalla shell. */
export type AppSection = 'home' | 'timeline' | 'memories' | 'explore' | 'analysis';

/**
 * Il contesto da passare a un'altra schermata (D-25.1).
 *
 * È il deep-link **interno**: l'utente clicca un punto e la Timeline mette
 * in evidenza l'era o il periodo. Non c'è un URL: c'è uno stato.
 */
export interface AppFocus {
  /** Che cosa è evidenziato. */
  readonly kind: 'era' | 'track' | 'period';
  /** L'id dell'oggetto (l'id dell'era, per esempio). */
  readonly id: string;
  /** Il timestamp UTC del periodo. */
  readonly at: number;
}
