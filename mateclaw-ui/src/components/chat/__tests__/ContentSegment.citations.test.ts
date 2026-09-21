import { createApp, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it } from 'vitest'
import ContentSegment from '../ContentSegment.vue'
import type { MessageSegment } from '@/types'

/**
 * The segmented (Claude-Code-style) view renders each content segment through
 * its own markdown pipeline, so it needs the same "is this a wiki source table?"
 * decision as MessageBubble. Miss it here and web sources come back as dead wiki
 * citation anchors — which is exactly what happened after the first fix.
 */
const segment = {
  id: 'seg-1',
  type: 'content',
  text: ['Datos.', '', 'Fuentes:', '[1] Worldometer — World Population Clock (LIVE, 2026)'].join('\n'),
  status: 'completed',
} as unknown as MessageSegment

const apps: Array<ReturnType<typeof createApp>> = []

function mount(props: Record<string, unknown>) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(ContentSegment, { segment, ...props })
  app.use(createI18n({ legacy: false, locale: 'es-ES', messages: { 'es-ES': {} } }))
  app.mount(host)
  apps.push(app)
  return host
}

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

describe('ContentSegment citations', () => {
  it('leaves web sources alone when the turn is not wiki-based', async () => {
    const host = mount({ wikiCitations: false })
    await nextTick()
    expect(host.innerHTML).not.toContain('wiki-citation')
    expect(host.innerHTML).not.toContain('href="#"')
    expect(host.innerHTML).toContain('Worldometer')
  })

  it('wraps the markers for a wiki turn', async () => {
    const host = mount({ wikiCitations: true })
    await nextTick()
    expect(host.innerHTML).toContain('wiki-citation')
    expect(host.innerHTML).not.toContain('href="#"')
  })
})
