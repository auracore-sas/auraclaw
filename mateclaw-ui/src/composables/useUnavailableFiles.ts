/**
 * Registry of generated files this browser has seen the server refuse.
 *
 * Why it exists: a generated file's bytes live for `mateclaw.generated-file.ttl`
 * (365 days by default) and are then swept, but the message metadata keeps the
 * link forever. So the conversation-file panel can list a row whose download is
 * dead, and a client-side guess ("older than N days => gone") would be wrong the
 * moment an operator changes that setting.
 *
 * Instead the UI learns from the server: whatever gets a 404/410 while being
 * downloaded or previewed is recorded here, and the panel renders those rows as
 * unavailable (struck through, no link). No TTL constant in the client, no false
 * positives, and it self-heals — a file that resolves again is not marked.
 *
 * Only failures observed by the browser are recorded, so the registry is
 * per-session (in memory) and starts empty on every reload.
 */
import { reactive } from 'vue'
import { generatedFileId } from '@/utils/conversationFiles'

/** Ids the server has answered 404/410 for during this session. */
const unavailable = reactive(new Set<string>())

/**
 * Record that a download URL no longer resolves. Ignores anything that is not a
 * generated-file URL (attachments and other endpoints have their own lifetime)
 * and re-marking an id is a no-op.
 */
export function markFileUnavailable(url: unknown): void {
  const id = generatedFileId(url)
  if (id) unavailable.add(id)
}

/** True when this download URL was refused by the server earlier in the session. */
export function isFileUnavailable(url: unknown): boolean {
  const id = generatedFileId(url)
  return !!id && unavailable.has(id)
}

/** How many distinct files this session saw refused (used by tests/diagnostics). */
export function unavailableFileCount(): number {
  return unavailable.size
}

/** Test helper: forget everything learned (keeps suites independent). */
export function resetUnavailableFiles(): void {
  unavailable.clear()
}

/**
 * True for the HTTP statuses that mean "the artifact is not there any more":
 * 404 (unknown/expired/swept) and 410 (gone). Kept next to the registry so the
 * download handler and the preview dialog agree on what counts as a dead file.
 */
export function isMissingFileStatus(message: unknown): boolean {
  const status = /(\d{3})/.exec(String(message ?? ''))?.[1]
  return status === '404' || status === '410'
}
