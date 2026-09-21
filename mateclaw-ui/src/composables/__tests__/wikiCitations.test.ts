import { describe, expect, it } from 'vitest'
import { useMarkdownRenderer } from '../useMarkdownRenderer'

/**
 * The canonical wiki source table the backend appends is `[n] <page title>`,
 * which is INDISTINGUISHABLE from the model's own list of WEB sources. The old
 * shape-based heuristic therefore wrapped a web-research answer's sources in
 * wiki citations with `href="#"`, and the user saw the chat's own URL on hover
 * (`http://localhost:18080/chat?...`) with a click that hunted for a wiki page
 * that does not exist.
 *
 * The decision now comes from the caller (the turn's tool calls), the anchors
 * never carry a placeholder href, and a citation tooltip replaces the bogus link.
 */

const WEB_ANSWER = [
  'La población mundial en 2026 es de unos 8.315 millones.',
  '',
  'Fuentes:',
  '[1] Worldometer — World Population Clock (LIVE, 2026)',
  '[2] World Population Prospects: The 2024 Revision — UN Population Division',
].join('\n')

function render(source: string, opts?: Parameters<ReturnType<typeof useMarkdownRenderer>['renderMarkdown']>[1]) {
  return useMarkdownRenderer().renderMarkdown(source, opts)
}

describe('wiki citation preprocessing', () => {
  it('leaves a web source list untouched when the turn did not use the wiki', () => {
    const html = render(WEB_ANSWER, { wikiCitations: false })

    // The symptom the user reported: sources looking like links to the chat URL.
    expect(html).not.toContain('wiki-citation')
    expect(html).not.toContain('href="#"')
    expect(html).toContain('Worldometer')
  })

  it('keeps a real source URL clickable instead of swallowing it in a citation', () => {
    const answer = [
      'Datos oficiales.',
      '',
      'Fuentes:',
      '[1] Worldometer — https://www.worldometers.info/world-population/',
    ].join('\n')

    const html = render(answer, { wikiCitations: false })

    expect(html).toContain('href="https://www.worldometers.info/world-population/"')
    expect(html).not.toContain('wiki-citation')
  })

  it('wraps the markers when the turn DID read the wiki, without any placeholder href', () => {
    const answer = [
      'Según el wiki [1] y [2] el despliegue se hace así.',
      '',
      'Fuentes:',
      '[1] Manual de despliegue',
      '[2] Runbook de Telegram',
    ].join('\n')

    const html = render(answer, { wikiCitations: true })

    expect(html).toContain('class="wiki-citation"')
    expect(html).toContain('data-citation-title="Manual de despliegue"')
    // The marker carries the page name as a tooltip…
    expect(html).toContain('title="Manual de despliegue"')
    // …and never a href: the wiki lookup resolves the page, not the browser.
    expect(html).not.toContain('href="#"')
  })

  it('keeps the legacy behaviour when the caller has no better signal', () => {
    const html = render(WEB_ANSWER)

    expect(html).toContain('wiki-citation')
    // Even in the legacy path the dead placeholder href is gone.
    expect(html).not.toContain('href="#"')
  })

  it('does not share cache entries between the two decisions', () => {
    const renderer = useMarkdownRenderer()
    const withCitations = renderer.renderMarkdown(WEB_ANSWER, { wikiCitations: true })
    const withoutCitations = renderer.renderMarkdown(WEB_ANSWER, { wikiCitations: false })

    expect(withCitations).toContain('wiki-citation')
    expect(withoutCitations).not.toContain('wiki-citation')

    // And rendering them again in the opposite order must not flip the results.
    expect(renderer.renderMarkdown(WEB_ANSWER, { wikiCitations: false })).toBe(withoutCitations)
    expect(renderer.renderMarkdown(WEB_ANSWER, { wikiCitations: true })).toBe(withCitations)
  })
})
