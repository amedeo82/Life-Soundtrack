/**
 * Componente `<T>` per stringhe localizzate (T0.6.4, 08-COPY-I18N §7).
 * Uso: `<T i18nKey="home.greeting" values={{ name: 'Amedeo' }} />`
 * Plurale: `<T i18nKey="import.status.done" count={3} />`
 */

import type { TOptions } from 'i18next';
import type { ReactElement } from 'react';
import { useT } from './useT';

export interface TProps {
  /** Chiave completa nel formato `namespace.scope.key` (08§1). */
  i18nKey: string;
  /** Variabili di template `{{var}}` (08§4). */
  values?: TOptions;
  /** Valore per la selezione del plurale `_one`/`_other` (08§3). */
  count?: number;
}

/** Renderizza la stringa tradotta per la chiave richiesta, mai la chiave grezza. */
export function T({ i18nKey, values, count }: TProps): ReactElement {
  const t = useT();
  const options: TOptions = { ...values };
  if (count !== undefined) {
    options.count = count;
  }
  return <>{t(i18nKey, options)}</>;
}
