import type { EssentiaEngine } from '../essentia';

/**
 * Un modulo finto che imita l'interfaccia del modulo WASM di `essentia.js`.
 *
 * Il loader dinamico accetta **qualsiasi** URL: in test è un percorso
 * locale, in produzione è l'URL del WASM ospitato (`21§6.5`). Il contratto
 * è dichiarato in `essentia.ts` (`EssentiaModule.createEssentiaEngine`),
 * non nelle API di `essentia.js`.
 */

/** Il motore finto: restituisce valori grezzi, come farebbe il vero. */
const engine: EssentiaEngine = {
  analyze: async () => ({ valence: 5, arousal: 5, danceable: 0.5 }),
};

/** La factory che il modulo espone. */
export function createEssentiaEngine(options: {
  modelUrl: string;
  sampleRate?: number;
}): EssentiaEngine {
  void options;
  return engine;
}
