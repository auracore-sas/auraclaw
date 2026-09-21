import { createApp, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ImagePreview from '../ImagePreview.vue'

/**
 * The image viewer exists because generated pictures (charts, screenshots,
 * rendered HTML) could previously only be downloaded: the preview pipeline had
 * no image kind. It must show the bytes, zoom, and — importantly — never expose
 * a same-origin blob document for an SVG, whose embedded scripts would then run
 * with our session.
 */

// `ArrayBuffer` (not SharedArrayBuffer) is what the preview pipeline hands around.
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer as ArrayBuffer
const SVG_BYTES = new TextEncoder()
  .encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
  .buffer.slice(0) as ArrayBuffer

const apps: Array<ReturnType<typeof createApp>> = []

function mount(filename: string, data: ArrayBuffer = PNG_BYTES) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(ImagePreview, { data, filename })
  app.use(
    createI18n({
      legacy: false,
      locale: 'es-ES',
      messages: {
        'es-ES': {
          chat: {
            preview: {
              zoomIn: 'Acercar',
              zoomOut: 'Alejar',
              zoomReset: 'Ajustar a la ventana',
              openInTab: 'Abrir en pestaña',
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
  URL.createObjectURL = vi.fn(() => 'blob:generated-image')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

describe('ImagePreview', () => {
  it('renders the fetched bytes through an <img> with a blob URL', () => {
    const host = mount('chart.png')

    const img = host.querySelector<HTMLImageElement>('.image-preview__img')!
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('blob:generated-image')
    expect(img.getAttribute('alt')).toBe('chart.png')
    // A raster image may be opened full size in a tab.
    expect(host.querySelector('.image-preview__open')).toBeTruthy()
  })

  it('builds the blob with the image MIME so SVG renders', () => {
    mount('diagram.svg', SVG_BYTES)
    const blob = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob
    expect(blob.type).toBe('image/svg+xml')
  })

  it('refuses to open an SVG as a same-origin blob document', () => {
    const host = mount('diagram.svg', SVG_BYTES)
    const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null)
    // No affordance at all: an inline SVG document could run its own scripts
    // with our origin (and read the session token).
    expect(host.querySelector('.image-preview__open')).toBeNull()
    expect(windowOpen).not.toHaveBeenCalled()
    windowOpen.mockRestore()
  })

  it('zooms in, out and back to fit', async () => {
    const host = mount('chart.png')
    // Toolbar order: zoom out, fit-percentage (reset), zoom in, open in tab.
    const [out, reset, zoomIn] = [...host.querySelectorAll<HTMLButtonElement>('.image-preview__toolbar button')]
    const percent = () => host.querySelector('.image-preview__percent')!.textContent!.trim()

    expect(percent()).toBe('100%')
    zoomIn.click()
    await nextTick()
    expect(percent()).toBe('125%')
    out.click()
    await nextTick()
    expect(percent()).toBe('100%')
    // The percentage button resets a zoomed image.
    zoomIn.click()
    zoomIn.click()
    await nextTick()
    expect(percent()).not.toBe('100%')
    reset.click()
    await nextTick()
    expect(percent()).toBe('100%')
  })

  it('frees the object URL when the dialog is closed', () => {
    const host = mount('chart.png')
    expect(host.querySelector('.image-preview__img')).toBeTruthy()
    apps.splice(0).forEach(app => app.unmount())
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:generated-image')
  })
})
