import { describe, expect, it } from 'vitest'
import { useMarkdownRenderer } from '../useMarkdownRenderer'

/**
 * Generated pictures must be visible IN the chat, whichever way the model writes
 * them. Reported from a real session: the assistant answered with
 * `![poblacion-....png](http://localhost:18080/api/v1/files/generated/<id>)`
 * and the chat showed nothing, because markdown IMAGE tokens do not go through
 * `link()` — they were rendered as a bare `<img>` with the echoed host, so the
 * authenticated endpoint answered 401 and any browser other than the server's
 * resolved `localhost` against itself.
 *
 * The two properties that make an inline generated image work:
 *   1. `data-generated-image` — that is what the app-wide authenticated loader
 *      scans for;
 *   2. a same-origin relative path in `data-generated-src` — never the host the
 *      model echoed.
 */

const FILE_URL = 'http://localhost:18080/api/v1/files/generated/b9a8b239-916e-47bc-ae72-20f6a740f318'

function render(source: string): string {
  return useMarkdownRenderer().renderMarkdown(source)
}

describe('generated images in markdown', () => {
  it('wires a markdown image token to the authenticated loader', () => {
    const html = render(`Aquí está:\n\n![poblacion-mundial-barras-hombres-mujeres-2026.png](${FILE_URL})\n`)

    expect(html).toContain('data-generated-image="1"')
    expect(html).toContain('data-generated-src="/api/v1/files/generated/b9a8b239-916e-47bc-ae72-20f6a740f318"')
    // The echoed host must never survive: otro equipo resolvería localhost contra sí mismo.
    expect(html).not.toContain('localhost:18080')
    // Placeholder src so no unauthenticated request is fired before the loader swaps it.
    expect(html).toContain('data:image/gif;base64')
    expect(html).toContain('alt="poblacion-mundial-barras-hombres-mujeres-2026.png"')
  })

  it('still handles the link form the render tools return', () => {
    const html = render('Gráfica: [g4_surtidor.png](/api/v1/files/generated/abc-123)')

    expect(html).toContain('data-generated-image="1"')
    expect(html).toContain('data-generated-src="/api/v1/files/generated/abc-123"')
    expect(html).not.toContain('<a href="/api/v1/files/generated/abc-123"')
  })

  it('leaves external images exactly as marked renders them', () => {
    const html = render('![foto](https://example.com/x.png)')

    expect(html).toContain('src="https://example.com/x.png"')
    expect(html).not.toContain('data-generated-image')
  })

  it('does not touch a file link that is not an image', () => {
    const html = render('Informe: [informe.pdf](/api/v1/files/generated/pdf-1)')

    expect(html).toContain('href="/api/v1/files/generated/pdf-1"')
    expect(html).not.toContain('data-generated-image')
  })

  it('keeps the alt text when the model writes a bare generated URL in an image token', () => {
    const html = render('![](/api/v1/files/generated/img-7)')

    expect(html).toContain('data-generated-src="/api/v1/files/generated/img-7"')
    // Falls back to the id when there is no alt text to name the file with.
    expect(html).toContain('alt="img-7"')
  })

  it('renders the exact answer reported from the real session', () => {
    // Verbatim (trimmed) from conversation conv_1790029096976_tsdw26: the
    // assistant DID emit a markdown image, and the chat showed nothing.
    const answer = [
      'Aquí está la gráfica de barras, renderizada en línea dentro del chat:',
      '',
      '![poblacion-mundial-barras-hombres-mujeres-2026.png](http://localhost:18080/api/v1/files/generated/b9a8b239-916e-47bc-ae72-20f6a740f318)',
      '',
      '## 📊 Población mundial por sexo (2026)',
      '',
      '| Grupo | Cantidad | Porcentaje |',
      '|---|---:|---:|',
      '| 👨 Hombres | 4.178.989.381 | 50,255 % |',
    ].join('\n')

    const html = render(answer)

    expect(html).toContain('data-generated-src="/api/v1/files/generated/b9a8b239-916e-47bc-ae72-20f6a740f318"')
    expect(html).toContain('data-generated-image="1"')
    expect(html).not.toContain('localhost:18080')
    // The table still renders as a table.
    expect(html).toContain('<table')
  })
})
