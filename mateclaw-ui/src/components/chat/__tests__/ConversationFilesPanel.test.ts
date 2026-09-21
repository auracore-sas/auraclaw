import { createApp, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '@/types'

import { markFileUnavailable, resetUnavailableFiles } from '@/composables/useUnavailableFiles'
import ConversationFilesPanel from '../ConversationFilesPanel.vue'

/**
 * The panel is the visible half of the conversation-file inventory: it must stay
 * collapsed until asked for, show the deliverables, and keep the intermediate
 * files behind a toggle (they are the noise of a report-with-charts turn).
 */

const URL_BASE = '/api/v1/files/generated/'

function message(partial: Partial<Omit<Message, 'metadata'>> & { metadata?: any }): Message {
  return {
    id: partial.id ?? 1,
    conversationId: 'c1',
    role: 'assistant',
    content: '',
    contentParts: [],
    ...partial,
  } as Message
}

const deliverable = 'Informe_Ventas.pdf'
const intermediate = 'g4_surtidor.png'

const deliverableTurn = message({
  id: 741,
  createTime: '2026-09-21T14:32:00',
  content: `Informe listo: [${deliverable}](/api/v1/files/generated/pdf-cited)`,
  metadata: {
    generatedFiles: [
      { filename: intermediate, url: `${URL_BASE}png-1`, toolName: 'execute_code' },
      { filename: deliverable, url: `${URL_BASE}pdf-cited`, toolName: 'send_file' },
    ],
  },
})

const apps: Array<ReturnType<typeof createApp>> = []

function mount(messages: Message[]) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(ConversationFilesPanel, { messages })
  app.use(
    createI18n({
      legacy: false,
      locale: 'es-ES',
      messages: {
        'es-ES': {
          chat: {
            filesPanel: {
              title: 'Archivos de la Conversación',
              collapse: 'Contraer panel',
              expand: 'Ver archivos',
              auxiliaryTitle: 'Archivos intermedios',
              turnAuxiliary: '+{count} intermedios',
              showAuxiliary: 'Mostrar intermedios ({count})',
              hideAuxiliary: 'Ocultar intermedios',
              versions: '{count} versiones',
              unavailable: 'no disponible',
              unavailableHint: 'Ya no está disponible en el servidor',
              unavailableTitle: 'Archivos que el servidor ya no tiene',
              hideUnavailable: 'Ocultar no disponibles ({count})',
              showUnavailable: 'Mostrar no disponibles ({count})',
              reason: {
                cited: 'Citado en la respuesta final',
                deliveryTool: 'Generado por una herramienta de entrega',
                deliveryToolNamed: 'Generado por {tool}',
                documentExt: 'Documento generado',
                fallback: 'Turno sin entregables identificados',
                auxiliary: 'Archivo intermedio del proceso',
              },
            },
          },
        },
      },
    }),
  )
  app.mount(host)
  apps.push(app)
  return host
}

beforeEach(() => {
  resetUnavailableFiles()
  // Node 26 exposes an experimental global `localStorage` that is undefined
  // unless `--localstorage-file` is passed, which shadows happy-dom's. Give the
  // component a real store to talk to (in the browser it is the real one).
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  for (const target of [globalThis, window] as unknown as object[]) {
    try {
      Object.defineProperty(target, 'localStorage', { configurable: true, value: storage })
    } catch {
      /* ignore: the component also handles a missing store */
    }
  }

  // happy-dom may not implement matchMedia; the panel only needs the listener API.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })) as unknown as typeof window.matchMedia
  }
})

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

describe('ConversationFilesPanel', () => {
  it('renders nothing when the conversation produced no files', () => {
    const host = mount([message({ id: 1, content: 'hola' })])
    expect(host.querySelector('.conv-files')).toBeNull()
  })

  it('starts collapsed with the deliverable count and expands on click', async () => {
    const host = mount([deliverableTurn])

    const rail = host.querySelector<HTMLButtonElement>('.conv-files__rail')!
    expect(rail).toBeTruthy()
    // One deliverable, so the rail badge reads "1"; the intermediates badge is separate.
    expect(rail.querySelector('.conv-files__rail-badge')?.textContent).toBe('1')
    expect(host.querySelector('.conv-files__body')).toBeNull()

    rail.click()
    await nextTick()

    expect(host.querySelector('.conv-files__header')).toBeTruthy()
    const names = [...host.querySelectorAll('.conv-files__name')].map(n => n.textContent)
    expect(names).toContain(deliverable)
  })

  it('keeps intermediates behind the toggle', async () => {
    const host = mount([deliverableTurn])
    host.querySelector<HTMLButtonElement>('.conv-files__rail')!.click()
    await nextTick()

    // Default view: only the deliverable.
    expect([...host.querySelectorAll('.conv-files__name')].map(n => n.textContent))
      .not.toContain(intermediate)

    const toggle = host.querySelector<HTMLButtonElement>('.conv-files__toggle')!
    expect(toggle.textContent).toContain('Mostrar intermedios (1)')
    toggle.click()
    await nextTick()

    expect([...host.querySelectorAll('.conv-files__name')].map(n => n.textContent))
      .toContain(intermediate)
    expect(host.querySelector('.conv-files__file.is-auxiliary')).toBeTruthy()
  })

  it('links rows to the download endpoint so the global handler can preview them', async () => {
    const host = mount([deliverableTurn])
    host.querySelector<HTMLButtonElement>('.conv-files__rail')!.click()
    await nextTick()

    const link = host.querySelector<HTMLAnchorElement>('.conv-files__file')!
    expect(link.getAttribute('href')).toBe(`${URL_BASE}pdf-cited`)
    expect(link.getAttribute('target')).toBe('_blank')
    // The row explains why it is a deliverable.
    expect(link.getAttribute('title')).toBe('Citado en la respuesta final')
  })

  it('strikes through a file the server refused, and hides it on request', async () => {
    const host = mount([deliverableTurn])

    // The registry is fed by the download handler learning from a 404 — the UI
    // never guesses from a TTL. Marking must re-render without a reload.
    markFileUnavailable(`${URL_BASE}pdf-cited`)
    await nextTick()
    expect(host.querySelector('.conv-files__rail-badge.is-unavailable')?.textContent).toBe('1')

    host.querySelector<HTMLButtonElement>('.conv-files__rail')!.click()
    await nextTick()

    const row = [...host.querySelectorAll<HTMLAnchorElement>('.conv-files__file')]
      .find(el => el.textContent?.includes(deliverable))!
    expect(row.classList.contains('is-unavailable')).toBe(true)
    expect(row.querySelector('.conv-files__unavailable-chip')?.textContent?.trim()).toBe('no disponible')
    // Name kept for traceability, but the dead link is no longer offered.
    expect(row.getAttribute('href')).toBeNull()
    expect(row.getAttribute('title')).toBe('Ya no está disponible en el servidor')

    // (c) hide the rows known to be gone.
    const filter = host.querySelector<HTMLButtonElement>('.conv-files__toggle.is-filter')!
    expect(filter.textContent).toContain('Ocultar no disponibles (1)')
    filter.click()
    await nextTick()
    expect([...host.querySelectorAll('.conv-files__name')].map(n => n.textContent))
      .not.toContain(deliverable)
    expect(filter.textContent).toContain('Mostrar no disponibles (1)')

    // …and the same toggle brings it back.
    filter.click()
    await nextTick()
    expect([...host.querySelectorAll('.conv-files__name')].map(n => n.textContent))
      .toContain(deliverable)
  })

  it('remembers the expanded state across mounts', async () => {
    const first = mount([deliverableTurn])
    first.querySelector<HTMLButtonElement>('.conv-files__rail')!.click()
    await nextTick()
    expect(localStorage.getItem('mc-files-collapsed')).toBe('false')

    const second = mount([deliverableTurn])
    expect(second.querySelector('.conv-files__body')).toBeTruthy()
  })
})
