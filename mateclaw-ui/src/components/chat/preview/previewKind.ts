import type { ChatAttachment } from '@/types'

/**
 * In-browser preview strategy for a chat attachment.
 *
 * - 'pdf'    — rendered client-side with pdfjs-dist
 * - 'docx'   — rendered client-side with docx-preview
 * - 'sheet'  — xlsx/csv parsed client-side with exceljs
 * - 'text'   — markdown / code / plain text, reuses the chat markdown renderer
 * - 'html'   — rendered inside a sandboxed iframe (scripts allowed, opaque
 *              origin — no same-origin access)
 * - 'office' — needs server-side conversion to PDF (soffice); the frontend
 *              requests `{url}/preview` and renders the result as 'pdf'.
 *              Falls back to download when the server has no converter (501).
 * - 'image'  — shown as-is with zoom/pan (AuraClaw): charts and screenshots
 *              produced by tools are pictures, and before this they could only
 *              be DOWNLOADED, never displayed in the UI.
 */
export type PreviewKind = 'pdf' | 'docx' | 'sheet' | 'text' | 'html' | 'office' | 'image'

/**
 * Extensions rendered by the image viewer. Raster formats are opened in a new
 * tab on request; `svg` deliberately is NOT (a same-origin blob document can run
 * the scripts embedded in the file — it is only ever rendered inside `<img>`,
 * which cannot execute them).
 */
export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'svg'])

/** Extensions rendered as markdown (full rich rendering). */
const MARKDOWN_EXTS = new Set(['md', 'markdown'])

/** Extensions rendered as syntax-highlighted code. */
const CODE_EXTS = new Set([
  'json', 'yaml', 'yml', 'toml', 'xml', 'sql', 'sh', 'bash', 'zsh',
  'js', 'ts', 'jsx', 'tsx', 'vue', 'py', 'java', 'kt', 'go', 'rs',
  'rb', 'c', 'cpp', 'h', 'cs', 'php', 'lua', 'css', 'scss', 'less',
  'properties', 'ini', 'conf', 'gradle', 'dockerfile',
])

/** Extensions rendered as plain preformatted text. */
const PLAIN_TEXT_EXTS = new Set(['txt', 'log', 'csv-report', 'text'])

/** Extensions the server-side office→PDF converter accepts. */
const OFFICE_CONVERT_EXTS = new Set([
  'ppt', 'pptx', 'doc', 'xls', 'odt', 'ods', 'odp', 'rtf', 'wps',
])

/** True for names that the image viewer can display (used by links/thumbnails). */
export function isImageName(name: string | undefined): boolean {
  return IMAGE_EXTS.has(extensionOf(name))
}

export function extensionOf(name: string | undefined): string {
  if (!name) return ''
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

/** Sub-flavor for the text preview so it can pick a rendering mode. */
export function textFlavorOf(name: string | undefined): 'markdown' | 'code' | 'plain' {
  const ext = extensionOf(name)
  if (MARKDOWN_EXTS.has(ext)) return 'markdown'
  if (CODE_EXTS.has(ext)) return 'code'
  return 'plain'
}

/**
 * Decide how (and whether) an attachment can be previewed in-browser.
 * Returns null when the only sensible action is download.
 */
export function previewKindOf(attachment: Pick<ChatAttachment, 'name' | 'contentType'>): PreviewKind | null {
  const ext = extensionOf(attachment.name)
  const mime = attachment.contentType || ''

  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (ext === 'docx'
      || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'docx'
  }
  if (ext === 'xlsx' || ext === 'csv'
      || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      || mime === 'text/csv') {
    return 'sheet'
  }
  if (ext === 'html' || ext === 'htm' || mime === 'text/html') return 'html'
  // Images: a chart or screenshot is meant to be SEEN, not downloaded.
  if (IMAGE_EXTS.has(ext) || mime.startsWith('image/')) return 'image'
  if (MARKDOWN_EXTS.has(ext) || CODE_EXTS.has(ext) || PLAIN_TEXT_EXTS.has(ext)
      || mime.startsWith('text/')) {
    return 'text'
  }
  if (OFFICE_CONVERT_EXTS.has(ext)) return 'office'
  return null
}
