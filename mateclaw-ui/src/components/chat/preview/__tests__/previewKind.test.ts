import { describe, it, expect } from 'vitest'
import { previewKindOf, textFlavorOf, extensionOf, isImageName } from '../previewKind'

describe('previewKindOf', () => {
  it('routes PDF by extension and by MIME', () => {
    expect(previewKindOf({ name: 'report.pdf', contentType: '' })).toBe('pdf')
    expect(previewKindOf({ name: 'nomatch', contentType: 'application/pdf' })).toBe('pdf')
  })

  it('routes docx to the client-side docx renderer', () => {
    expect(previewKindOf({ name: 'a.docx', contentType: '' })).toBe('docx')
  })

  it('routes xlsx and csv to the sheet renderer', () => {
    expect(previewKindOf({ name: 'a.xlsx', contentType: '' })).toBe('sheet')
    expect(previewKindOf({ name: 'data.csv', contentType: '' })).toBe('sheet')
  })

  it('routes html to the sandboxed html renderer', () => {
    expect(previewKindOf({ name: 'page.html', contentType: '' })).toBe('html')
    expect(previewKindOf({ name: 'page.htm', contentType: '' })).toBe('html')
  })

  it('routes markdown / code / text / text-MIME to the text renderer', () => {
    expect(previewKindOf({ name: 'notes.md', contentType: '' })).toBe('text')
    expect(previewKindOf({ name: 'app.ts', contentType: '' })).toBe('text')
    expect(previewKindOf({ name: 'log.txt', contentType: '' })).toBe('text')
    expect(previewKindOf({ name: 'weird', contentType: 'text/plain' })).toBe('text')
  })

  it('routes legacy/binary office formats to server-side conversion', () => {
    for (const ext of ['pptx', 'ppt', 'doc', 'xls', 'odt', 'ods', 'odp', 'rtf', 'wps']) {
      expect(previewKindOf({ name: `f.${ext}`, contentType: '' })).toBe('office')
    }
  })

  it('routes images to the image viewer, by extension or by MIME', () => {
    // AuraClaw: charts/screenshots used to be download-only, so the chat could
    // never SHOW a picture it had produced.
    for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'svg']) {
      expect(previewKindOf({ name: `chart.${ext}`, contentType: '' })).toBe('image')
    }
    expect(previewKindOf({ name: 'grafica', contentType: 'image/png' })).toBe('image')
    expect(previewKindOf({ name: 'foto.PNG', contentType: '' })).toBe('image')
  })

  it('flags image names for links and thumbnails', () => {
    expect(isImageName('g4_surtidor.png')).toBe(true)
    expect(isImageName('cover.SVG')).toBe(true)
    expect(isImageName('informe.pdf')).toBe(false)
    expect(isImageName('sin-extension')).toBe(false)
    expect(isImageName(undefined)).toBe(false)
  })

  it('returns null (download-only) for unknown binary formats', () => {
    expect(previewKindOf({ name: 'archive.zip', contentType: 'application/zip' })).toBeNull()
    expect(previewKindOf({ name: 'firmware.bin', contentType: '' })).toBeNull()
    expect(previewKindOf({ name: 'noextension', contentType: '' })).toBeNull()
  })

  it('routes generated images to the image viewer (AuraClaw change)', () => {
    // Upstream returned null here on purpose: attachment images are rendered by
    // MessageBubble's own branches, so previewKindOf only saw the residue.
    // AuraClaw changed the contract because GENERATED images (charts, rendered
    // HTML, screenshots) had no way to be displayed: clicking one downloaded it.
    // The image viewer is now the single place that shows a picture, whichever
    // surface links it (message, conversation-file panel, history).
    // Keep this expectation when merging upstream; if they add their own image
    // preview, prefer theirs and drop ours (see docs/CUSTOMIZATIONS.md).
    expect(previewKindOf({ name: 'pic.png', contentType: 'image/png' })).toBe('image')
    expect(previewKindOf({ name: 'chart.PNG', contentType: '' })).toBe('image')
  })
})

describe('textFlavorOf', () => {
  it('classifies markdown, code, and plain text', () => {
    expect(textFlavorOf('a.md')).toBe('markdown')
    expect(textFlavorOf('a.ts')).toBe('code')
    expect(textFlavorOf('a.json')).toBe('code')
    expect(textFlavorOf('a.txt')).toBe('plain')
    expect(textFlavorOf('a.unknown')).toBe('plain')
  })
})

describe('extensionOf', () => {
  it('lowercases and handles dotless names', () => {
    expect(extensionOf('Report.PDF')).toBe('pdf')
    expect(extensionOf('name.tar.gz')).toBe('gz')
    expect(extensionOf('noext')).toBe('')
    expect(extensionOf(undefined)).toBe('')
  })
})
