/**
 * Conversation-level file inventory.
 *
 * The chat already renders generated-file download links inside each message
 * body, and `RunOverviewPanel` lists the files of the LATEST turn only. Neither
 * answers "where are the files we produced earlier in this conversation?" — for
 * that the user still has to scroll back through the history looking for a
 * download link (upstream issue #384 asks for exactly this).
 *
 * This module turns the per-message `metadata.generatedFiles` (persisted by the
 * server in `mate_message.metadata`, written by `AgentStreamAccumulator`) into a
 * turn-grouped inventory with a deliverable / intermediate split.
 *
 * Classification is deliberately fail-open — anything ambiguous is shown:
 *   1. `cited`        the assistant linked it in its final answer. Strongest
 *                     signal (the model is instructed to echo what it produced)
 *                     and the only one that catches a deliverable produced by
 *                     `execute_code` instead of a render tool.
 *   2. `delivery-tool` the producing tool is a delivery tool (`send_file`,
 *                     `renderPdf*`, `renderDocx*`, `render_xlsx`, `render_pptx`,
 *                     `render_html_image`, `office_document`, `*_package`,
 *                     `*_publish`, `capture_screenshot`).
 *   3. `document-ext` a document/archive extension, unless the name looks like
 *                     scratch (e.g. `TEST_pdf_b64.pdf`).
 *   otherwise         `auxiliary` — charts, intermediate HTML, `palette.json`,
 *                     debug files… hidden behind a toggle, never dropped.
 *   `fallback`        a turn whose files are ALL intermediates shows them, so a
 *                     turn is never rendered empty.
 *
 * No API call: the history endpoint already returns every message with its
 * metadata when no `limit` is passed, so the inventory is derived locally.
 */
import type { GeneratedFile, Message } from '@/types'

/**
 * Why a file was treated as a deliverable (exposed for the UI tooltip/tests).
 * The order of `REASON_RANK` decides which signal wins when the same document
 * shows up more than once (a regenerated file mints a new URL each time):
 * `cited` > `delivery-tool` > `document-ext` > `auxiliary`.
 */
export type FileClassificationReason =
  | 'cited'
  | 'delivery-tool'
  | 'document-ext'
  | 'fallback'
  | 'auxiliary'

const REASON_RANK: Record<FileClassificationReason, number> = {
  cited: 3,
  'delivery-tool': 2,
  'document-ext': 1,
  fallback: 1,
  auxiliary: 0,
}

/** One row of the panel: a filename, its versions and its classification. */
export interface ConversationFile {
  /** Display name. */
  name: string
  /** URL the panel links to (the strongest/newest known version). */
  url: string
  /** Every URL seen for this filename, newest first (regeneration mints a new id). */
  versions: string[]
  /** Tool that produced the linked URL, when the server recorded one. */
  toolName?: string
  /** True when this is (very likely) a deliverable of its turn. */
  isPrimary: boolean
  reason: FileClassificationReason
  /**
   * True when the download link is past the server TTL, so clicking it would
   * only produce a 404 toast. Derived from the turn timestamp (see
   * `GENERATED_FILE_TTL_MS`) because there is no "does this file exist"
   * endpoint; a missing timestamp stays `false` (never scare the user with a
   * guess).
   */
  expired: boolean
}

/** Files grouped by the assistant turn that produced them, newest turn first. */
export interface ConversationFileTurn {
  messageId?: string | number
  /** Turn timestamp (`Message.createTime`), used for the group label. */
  createdAt?: string
  primary: ConversationFile[]
  auxiliary: ConversationFile[]
}

/**
 * Server-side lifetime of a generated file, mirrored from
 * `GeneratedFileCache.TTL` (`Duration.ofDays(7)`). The downloads are served
 * from disk but every read checks the entry's own expiry, so a link older than
 * this answers 404. Used only to LABEL a row (never to hide it): the panel has
 * no "does this file still exist" endpoint, and the turn timestamp is always
 * >= the file's creation time, so the label is conservative — it can miss a
 * file that died in the last few minutes, but it never marks a live one dead.
 */
export const GENERATED_FILE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Data source seam. Today the inventory comes from message metadata; a future
 * server-side artifact catalog (upstream tracks one in issue #514 / PR #539)
 * can implement this same signature and be passed as the panel's `source`
 * prop, making that swap a one-liner. Keep `ConversationFileTurn` stable.
 */
export type ConversationFilesSource = (messages: Message[]) => ConversationFileTurn[]

const FILE_ID_ONE = /\/api\/v1\/files\/generated\/([A-Za-z0-9-]+)/
const FILE_ID_ALL = /\/api\/v1\/files\/generated\/([A-Za-z0-9-]+)/g

/**
 * Delivery tools, matched on the normalised tool name (lower-case, alphanumerics
 * only) so `renderPdfFromFile`, `render_pdf` and `renderpdf` all match. Kept as
 * patterns instead of an exact list: tool method names are the source of truth
 * and vary per tool.
 */
const DELIVERY_TOOL_PATTERNS = [
  'sendfile',
  'renderpdf',
  'renderdocx',
  'renderxlsx',
  'renderpptx',
  'renderhtmlimage',
  'officedocument',
  'package',
  'publish',
  'screenshot',
]

const DOCUMENT_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'rtf', 'odt',
  'xls', 'xlsx', 'ods',
  'ppt', 'pptx', 'odp',
  'csv', 'zip', 'epub',
])

/** Scratch/debug names: `test_local.md`, `tmp_out.csv`, `informe_b64.pdf`… */
const SCRATCH_PREFIX_RE = /^(test|tmp|temp|scratch|debug|sample|copy)[-_ .]/i
const SCRATCH_INFIX_RE = /[-_](test|tmp|temp|b64|bak|backup|old)\d*([-_.]|$)/i

/** File id (the UUID in the download URL) or undefined when the URL is odd. */
export function generatedFileId(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined
  return FILE_ID_ONE.exec(url)?.[1]
}

/**
 * Ids of every generated file the text points at — bare URL or markdown link,
 * absolute or relative. Matching by id (not by full URL) is what makes the
 * "cited in the answer" signal robust: the same file can be echoed with a
 * different host.
 */
export function citedFileIds(content: string | undefined | null): Set<string> {
  const ids = new Set<string>()
  if (!content) return ids
  for (const match of content.matchAll(FILE_ID_ALL)) ids.add(match[1])
  return ids
}

function normalizeToolName(name: string | undefined): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** True when the tool that produced a link is a delivery (not scratch) tool. */
export function isDeliveryTool(name: string | undefined): boolean {
  const normalized = normalizeToolName(name)
  if (!normalized) return false
  return DELIVERY_TOOL_PATTERNS.some(pattern => normalized.includes(pattern))
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Debug/scratch filenames that should not reach the deliverable list. */
export function looksLikeScratch(name: string): boolean {
  return SCRATCH_PREFIX_RE.test(name) || SCRATCH_INFIX_RE.test(name)
}

/** Classify a single entry. See the module header for the rule order. */
export function classifyFile(
  entry: { filename?: string; url: string; toolName?: string },
  citedIds: Set<string>,
): { isPrimary: boolean; reason: FileClassificationReason } {
  const id = generatedFileId(entry.url)
  if (id && citedIds.has(id)) return { isPrimary: true, reason: 'cited' }
  if (isDeliveryTool(entry.toolName)) return { isPrimary: true, reason: 'delivery-tool' }

  const name = entry.filename || ''
  if (DOCUMENT_EXTENSIONS.has(fileExtension(name)) && !looksLikeScratch(name)) {
    return { isPrimary: true, reason: 'document-ext' }
  }
  return { isPrimary: false, reason: 'auxiliary' }
}

/**
 * Build the inventory for a conversation. Messages are walked newest-first, so
 * the resulting turns (and the versions inside each row) are newest-first.
 *
 * @param now injectable clock (tests); defaults to `Date.now()`.
 */
export function collectConversationFileTurns(
  messages: Message[],
  now: number = Date.now(),
): ConversationFileTurn[] {
  const turns: ConversationFileTurn[] = []
  if (!Array.isArray(messages)) return turns

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    const files = (message?.metadata?.generatedFiles || []) as GeneratedFile[]
    if (!files.length) continue

    // Everything produced in a turn is stamped with that turn's id/time, so the
    // expiry label is derived once per turn. Unparseable/missing timestamp =>
    // not expired (fail-open: never tell the user a live file is gone).
    const createdAtMs = message.createTime ? new Date(message.createTime).getTime() : NaN
    const expired = Number.isFinite(createdAtMs) && now - createdAtMs > GENERATED_FILE_TTL_MS

    const cited = citedFileIds(message.content)
    const byName = new Map<string, ConversationFile>()

    for (const file of files) {
      const url = String(file?.url || '')
      if (!url) continue
      const id = generatedFileId(url)
      const name = String(file?.filename || '').trim() || id || url
      const { isPrimary, reason } = classifyFile(
        { filename: name, url, toolName: file?.toolName },
        cited,
      )

      const existing = byName.get(name)
      if (!existing) {
        byName.set(name, {
          name,
          url,
          versions: [url],
          toolName: file?.toolName,
          isPrimary,
          reason,
          expired,
        })
        continue
      }

      // Same document regenerated (a new id each time): keep one row, remember
      // every version, and let the STRONGEST signal win — otherwise whichever
      // version happened to be stored first would pin both the classification
      // and the link (e.g. an `execute_code` copy shadowing the cited one).
      existing.versions.push(url)
      if (REASON_RANK[reason] > REASON_RANK[existing.reason]) {
        existing.isPrimary = isPrimary
        existing.reason = reason
        existing.url = url
        existing.toolName = file?.toolName
      }
    }

    const all = [...byName.values()]
    let primary = all.filter(file => file.isPrimary)
    let auxiliary = all.filter(file => !file.isPrimary)

    // A turn with only intermediates would render an empty deliverable list:
    // show them instead (e.g. a turn that produced charts the answer never
    // linked). Fail-open, never hide a turn's work.
    if (!primary.length && auxiliary.length) {
      primary = auxiliary.map(file => ({ ...file, isPrimary: true, reason: 'fallback' as const }))
      auxiliary = []
    }

    turns.push({
      messageId: message.id,
      createdAt: message.createTime,
      primary,
      auxiliary,
    })
  }

  return turns
}

/** Panel counters: deliverables vs intermediates across every turn. */
export function summarizeConversationFiles(turns: ConversationFileTurn[]): {
  primary: number
  auxiliary: number
  expired: number
  total: number
} {
  let primary = 0
  let auxiliary = 0
  let expired = 0
  for (const turn of turns) {
    primary += turn.primary.length
    auxiliary += turn.auxiliary.length
    expired += [...turn.primary, ...turn.auxiliary].filter(file => file.expired).length
  }
  return { primary, auxiliary, expired, total: primary + auxiliary }
}

/** Default source: the persisted metadata of every message in the conversation. */
export const messageMetadataFilesSource: ConversationFilesSource = collectConversationFileTurns
