import { createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The conversation-file panel learns which rows are dead from the server (a
 * 404/410 while downloading), instead of guessing from a TTL that is now a
 * deployment setting. These tests cover both halves: the registry itself and
 * the global click handler that feeds it.
 */

vi.mock('@/api/index', () => ({
  fetchAuthenticatedBlob: vi.fn(),
  http: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('@/composables/useMcToast', () => ({
  mcToast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('@/components/chat/preview/previewBus', () => ({ openFilePreview: vi.fn() }))

import { fetchAuthenticatedBlob } from '@/api/index'
import { mcToast } from '@/composables/useMcToast'
import { openFilePreview } from '@/components/chat/preview/previewBus'
import { useGlobalFileDownloadClick } from '../useGlobalFileDownloadClick'
import {
  isFileUnavailable,
  isMissingFileStatus,
  markFileUnavailable,
  resetUnavailableFiles,
  unavailableFileCount,
} from '../useUnavailableFiles'

const apps: Array<ReturnType<typeof createApp>> = []

function mountHandler() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(
    defineComponent({
      setup() {
        useGlobalFileDownloadClick()
        return () => h('div')
      },
    }),
  )
  app.use(
    createI18n({
      legacy: false,
      locale: 'es-ES',
      messages: {
        'es-ES': {
          chat: {
            downloadExpired: 'Este archivo expiró',
            downloadStarted: 'Descargando {name}',
            downloadFailed: 'Error: {reason}',
          },
        },
      },
    }),
  )
  app.mount(host)
  apps.push(app)
  return host
}

/** Click a generated-file link the way a user would (bubbles to the delegator). */
function clickGeneratedLink(id: string, name = 'datos.zip') {
  const anchor = document.createElement('a')
  anchor.setAttribute('href', `/api/v1/files/generated/${id}`)
  anchor.textContent = name
  document.body.appendChild(anchor)
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  return anchor
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
  resetUnavailableFiles()
  vi.clearAllMocks()
})

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

describe('useUnavailableFiles', () => {
  it('tracks generated-file ids and ignores every other URL', () => {
    markFileUnavailable('/api/v1/files/generated/abc-1')
    expect(isFileUnavailable('/api/v1/files/generated/abc-1')).toBe(true)
    expect(isFileUnavailable('http://host:18080/api/v1/files/generated/abc-1')).toBe(true)
    expect(isFileUnavailable('/api/v1/files/generated/abc-2')).toBe(false)

    // Attachments and other endpoints have their own lifetime: never recorded.
    markFileUnavailable('/api/v1/chat/files/other-1')
    markFileUnavailable(undefined)
    markFileUnavailable('')
    expect(unavailableFileCount()).toBe(1)
  })

  it('only treats 404/410 as "the artifact is gone"', () => {
    expect(isMissingFileStatus('Fetch failed: 404')).toBe(true)
    expect(isMissingFileStatus('Fetch failed: 410')).toBe(true)
    expect(isMissingFileStatus('Fetch failed: 500')).toBe(false)
    expect(isMissingFileStatus('Fetch failed: 501')).toBe(false)
    expect(isMissingFileStatus(undefined)).toBe(false)
  })
})

describe('useGlobalFileDownloadClick', () => {
  it('records the file when the download answers 404, and keeps the user in the chat', async () => {
    ;(fetchAuthenticatedBlob as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Fetch failed: 404'),
    )
    mountHandler()

    clickGeneratedLink('dead-1')
    await settle()

    expect(isFileUnavailable('/api/v1/files/generated/dead-1')).toBe(true)
    expect(mcToast.error).toHaveBeenCalledWith('Este archivo expiró')
  })

  it('opens a generated image in the viewer instead of downloading it', async () => {
    mountHandler()
    const img = document.createElement('img')
    img.setAttribute('data-generated-image', '1')
    img.setAttribute('data-generated-src', '/api/v1/files/generated/img-9')
    img.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
    img.setAttribute('alt', 'g4_surtidor.png')
    document.body.appendChild(img)

    img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle()

    // The dialog is what shows the picture (with zoom), and it renders the blob
    // inside <img>, so a generated SVG can never run scripts.
    expect(openFilePreview).toHaveBeenCalledWith({
      name: 'g4_surtidor.png',
      url: '/api/v1/files/generated/img-9',
    })
    expect(fetchAuthenticatedBlob).not.toHaveBeenCalled()
  })

  it('does not record a file for a transient error', async () => {
    ;(fetchAuthenticatedBlob as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Fetch failed: 500'),
    )
    mountHandler()

    clickGeneratedLink('flaky-1')
    await settle()

    expect(isFileUnavailable('/api/v1/files/generated/flaky-1')).toBe(false)
    expect(mcToast.error).toHaveBeenCalled()
  })

  it('leaves a healthy download alone', async () => {
    ;(fetchAuthenticatedBlob as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Blob(['ok']),
    )
    // happy-dom has no URL.createObjectURL by default.
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    mountHandler()

    clickGeneratedLink('live-1')
    await settle()

    expect(isFileUnavailable('/api/v1/files/generated/live-1')).toBe(false)
    expect(mcToast.success).toHaveBeenCalled()
  })
})
