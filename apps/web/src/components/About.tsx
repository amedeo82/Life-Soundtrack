/**
 * Schermata "Informazioni / About" — issue #202 (AGPL-3.0 §13).
 *
 * Offre in-product:
 * - il riferimento alla licenza AGPL-3.0 (file LICENSE);
 * - l'offerta del sorgente corrispondente prevista da AGPL §13 (repository +
 *   tag della release, accesso gratuito, mezzi standard);
 * - le attribuzioni di terze parti (file NOTICE, Essentia.js AGPL-3.0,
 *   DB-IP Lite CC BY 4.0 in attesa della Story 4.4).
 *
 * È renderabile in autonomia e testabile: la UI espone il testo
 * `about.sourceOfferText`, usato dal test di raggiungibilità dell'offerta.
 */

import { useT } from '../i18n';
import { version as appVersion } from '../../package.json';

export function About() {
  const t = useT();
  return (
    <main className="onboarding-shell" role="document" aria-label={t('about.title')}>
      <div className="onboarding-card" style={{ maxWidth: '560px', textAlign: 'left' }}>
        <div
          style={{
            fontSize: '2.5rem',
            marginBottom: 'var(--ls-spacing-md)',
            display: 'inline-block',
          }}
        >
          ℹ️
        </div>
        <h2>{t('about.title')}</h2>
        <p className="mono small">{t('about.version', { version: appVersion })}</p>

        <section style={{ marginTop: 'var(--ls-spacing-lg)' }}>
          <h3
            style={{
              color: 'var(--ls-text-primary)',
              fontSize: '1rem',
              marginBottom: 'var(--ls-spacing-xs)',
            }}
          >
            {t('about.license')}
          </h3>
          <p>{t('about.licenseText')}</p>
          <p>
            Testo completo:{' '}
            <a
              href="LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--ls-border-active)' }}
            >
              LICENSE
            </a>{' '}
            (GNU Affero General Public License v3.0).
          </p>
        </section>

        <section style={{ marginTop: 'var(--ls-spacing-lg)' }}>
          <h3
            style={{
              color: 'var(--ls-text-primary)',
              fontSize: '1rem',
              marginBottom: 'var(--ls-spacing-xs)',
            }}
          >
            {t('about.sourceOffer')}
          </h3>
          <p data-testid="about-source-offer">{t('about.sourceOfferText')}</p>
          <p>
            Repository:{' '}
            <a
              href="https://github.com/amedeo82/Life-Soundtrack"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--ls-border-active)' }}
            >
              https://github.com/amedeo82/Life-Soundtrack
            </a>{' '}
            — sorgente della release identificato dal tag git nella pagina Releases.
          </p>
        </section>

        <section style={{ marginTop: 'var(--ls-spacing-lg)' }}>
          <h3
            style={{
              color: 'var(--ls-text-primary)',
              fontSize: '1rem',
              marginBottom: 'var(--ls-spacing-xs)',
            }}
          >
            {t('about.notice')}
          </h3>
          <p>{t('about.noticeText')}</p>
          <p>
            File:{' '}
            <a
              href="NOTICE"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--ls-border-active)' }}
            >
              NOTICE
            </a>
            .
          </p>
        </section>

        <div className="onboarding-actions" style={{ marginTop: 'var(--ls-spacing-xl)' }}>
          <button type="button" className="btn btn-ghost" data-testid="about-close">
            {t('common.close')}
          </button>
        </div>
      </div>
    </main>
  );
}
