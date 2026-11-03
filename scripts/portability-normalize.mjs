/**
 * Normalizzazione dei campi MUTABILI dei file generati (issue #284).
 *
 * Due campi cambiano a ogni esecuzione e non sono contenuto:
 *   - `> Data: ...` (l'intestazione del bundle)
 *   - `- Ultima aggregazione: ...` (i blocchi aggregati)
 *
 * Senza questa normalizzazione il confronto cross-OS (manifest sha256 dei file
 * generati su ubuntu vs windows) e' falsamente positivo quando i due job
 * cadono in minuti diversi: misurato il 2026-11-03 (`docs/BUNDLE.md` con hash
 * diversi su ubuntu e windows, senza alcuna differenza reale di contenuto).
 * E' la stessa normalizzazione che il check `-Check` del bundle usa per
 * confrontare.
 *
 * Vive in un modulo separato (senza effetti collaterali) perche' il test di
 * regressione `scripts/test-generators-portable.sh` (T4) possa importarla e
 * verificare che l'hash sia invariante rispetto ai campi mutabili e sensibile
 * al contenuto reale.
 */
export function normalizeMutable(content) {
  return content
    .replace(/^> Data: .+$/gm, '> Data: <timestamp>')
    .replace(/^- Ultima aggregazione: .+$/gm, '- Ultima aggregazione: <timestamp>');
}
