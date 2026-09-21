<script setup lang="ts">
/**
 * Conversation-level file panel: every file produced during THIS conversation,
 * grouped by the turn that produced it, split into deliverables and
 * intermediates.
 *
 * Why it exists: the run-overview rail lists the files of the latest turn only
 * (`latestAssistant.metadata.generatedFiles`), so in a long conversation the
 * earlier files are still only reachable by scrolling back through the history
 * looking for a download link (upstream issue #384 asks for exactly this).
 *
 * Data: `metadata.generatedFiles` of every message, which the server persists in
 * `mate_message.metadata`; the history endpoint returns all messages when no
 * `limit` is passed, so no extra API call is needed. The classification rules
 * live in `@/utils/conversationFiles` (unit-tested).
 *
 * Interaction: rows are plain `<a href="/api/v1/files/generated/…">` anchors, so
 * the app-wide `useGlobalFileDownloadClick` delegator handles them — preview for
 * previewable formats, authenticated blob download otherwise, and a toast when
 * the artifact is gone (its server-side lifetime is
 * `mateclaw.generated-file.ttl`, 365 days by default). No download logic here on
 * purpose — and no client-side expiry label either, so the UI cannot drift from
 * the configured TTL.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Message } from '@/types'
import { isFileUnavailable } from '@/composables/useUnavailableFiles'
import { isImageName } from '@/components/chat/preview/previewKind'
import {
  messageMetadataFilesSource,
  summarizeConversationFiles,
  type ConversationFile,
  type ConversationFilesSource,
  type ConversationFileTurn,
} from '@/utils/conversationFiles'

const props = defineProps<{
  messages: Message[]
  /** Override the data source (e.g. a future server-side artifact catalog). */
  source?: ConversationFilesSource
}>()

const { t, locale } = useI18n()

const COLLAPSED_KEY = 'mc-files-collapsed'
const SHOW_AUXILIARY_KEY = 'mc-files-show-aux'
const HIDE_UNAVAILABLE_KEY = 'mc-files-hide-unavailable'

/**
 * Preferences are read defensively: Node >= 22 exposes an experimental global
 * `localStorage` that is undefined unless `--localstorage-file` is passed, and
 * test/SSR environments may lack it entirely. A missing preference must never
 * break the chat.
 */
function readPreference(key: string): string | null {
  try {
    return window.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writePreference(key: string, value: string): void {
  try {
    window.localStorage?.setItem(key, value)
  } catch {
    /* storage unavailable — keep the in-memory state only */
  }
}

// Collapsed by default: the chat column keeps its space until asked for.
const collapsed = ref(readPreference(COLLAPSED_KEY) !== 'false')
const showAuxiliary = ref(readPreference(SHOW_AUXILIARY_KEY) === 'true')
// Unavailable rows are shown (struck through) until the user asks for them gone.
const hideUnavailable = ref(readPreference(HIDE_UNAVAILABLE_KEY) === 'true')

function toggleHideUnavailable() {
  hideUnavailable.value = !hideUnavailable.value
  writePreference(HIDE_UNAVAILABLE_KEY, String(hideUnavailable.value))
}

function setCollapsed(value: boolean) {
  collapsed.value = value
  writePreference(COLLAPSED_KEY, String(value))
}

function toggleAuxiliary() {
  showAuxiliary.value = !showAuxiliary.value
  writePreference(SHOW_AUXILIARY_KEY, String(showAuxiliary.value))
}

const activeSource = computed<ConversationFilesSource>(() => props.source || messageMetadataFilesSource)
const turns = computed(() => activeSource.value(props.messages))
const summary = computed(() => summarizeConversationFiles(turns.value))
const hasFiles = computed(() => summary.value.total > 0)

/**
 * Files this session saw the server refuse (404/410 while downloading or
 * previewing). Learned, not guessed: the TTL is a server setting, so no constant
 * here could keep up with it. See `useUnavailableFiles`.
 */
const unavailableCount = computed(() =>
  summarizeUnavailable(turns.value),
)

function summarizeUnavailable(groups: ConversationFileTurn[]): number {
  let count = 0
  for (const turn of groups) {
    for (const file of [...turn.primary, ...turn.auxiliary]) {
      if (isFileUnavailable(file.url)) count += 1
    }
  }
  return count
}

/** Rows to render: the user can hide the ones known to be gone. */
const displayTurns = computed<ConversationFileTurn[]>(() =>
  turns.value
    .map(turn => ({
      ...turn,
      primary: visibleFiles(turn.primary),
      auxiliary: visibleFiles(turn.auxiliary),
    }))
    .filter(turn => turn.primary.length > 0 || turn.auxiliary.length > 0),
)

function visibleFiles(files: ConversationFile[]): ConversationFile[] {
  return hideUnavailable.value ? files.filter(file => !isFileUnavailable(file.url)) : files
}

/**
 * Thumbnails for image rows (charts, screenshots). The bytes need auth, so the
 * `<img>` is handed to the app-wide `useGlobalGeneratedImageBlob` loader, which
 * swaps the src for a blob URL after an authenticated fetch.
 *
 * Two details keep it cheap and quiet:
 *   - the image is mounted only once its row scrolls into view: the loader
 *     fetches on insertion, so mounting eagerly would download every chart of
 *     the conversation the moment the panel is expanded;
 *   - `data-generated-src` carries the real URL and `src` a transparent pixel,
 *     so the browser does not fire a doomed unauthenticated request (401) that
 *     would flash a broken image while the authenticated fetch is in flight.
 */
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const loadedThumbs = ref(new Set<string>())
const thumbTargets = new WeakMap<Element, string>()
let thumbObserver: IntersectionObserver | null = null

function isImageRow(file: ConversationFile): boolean {
  return isImageName(file.name)
}

function observeThumb(file: ConversationFile, el: Element | null) {
  if (!el || !isImageRow(file)) return
  // No IntersectionObserver (tests/SSR): mount it right away.
  if (!thumbObserver) {
    loadedThumbs.value.add(file.url)
    return
  }
  thumbTargets.set(el, file.url)
  thumbObserver.observe(el)
}

// Narrow viewports: the expanded panel floats over the chat as a drawer instead
// of squeezing the conversation column (same behaviour as the run-overview rail).
const isNarrow = ref(false)
let mql: MediaQueryList | null = null
function onMqlChange(e: MediaQueryListEvent | MediaQueryList) {
  isNarrow.value = e.matches
}
onMounted(() => {
  mql = window.matchMedia('(max-width: 1280px)')
  onMqlChange(mql)
  mql.addEventListener('change', onMqlChange)

  if (typeof IntersectionObserver !== 'undefined') {
    thumbObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const url = thumbTargets.get(entry.target)
          if (url) loadedThumbs.value.add(url)
          thumbObserver?.unobserve(entry.target)
        }
      },
      { rootMargin: '160px' },
    )
  }
})
onBeforeUnmount(() => {
  mql?.removeEventListener('change', onMqlChange)
  thumbObserver?.disconnect()
  thumbObserver = null
})

const showBackdrop = computed(() => isNarrow.value && !collapsed.value && hasFiles.value)

const dateFormatter = computed(
  () => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }),
)

function formatTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.value.format(date)
}

/** Row tooltip: why the row is in the deliverable or the collapsed list. */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toUpperCase().slice(0, 4)
}

/** Tooltip explaining WHY a row is in the primary or the collapsed list. */
function reasonLabel(file: ConversationFile): string {
  switch (file.reason) {
    case 'cited':
      return t('chat.filesPanel.reason.cited')
    case 'delivery-tool':
      return file.toolName
        ? t('chat.filesPanel.reason.deliveryToolNamed', { tool: file.toolName })
        : t('chat.filesPanel.reason.deliveryTool')
    case 'document-ext':
      return t('chat.filesPanel.reason.documentExt')
    case 'fallback':
      return t('chat.filesPanel.reason.fallback')
    default:
      return t('chat.filesPanel.reason.auxiliary')
  }
}
</script>

<template>
  <teleport to="body" :disabled="!showBackdrop">
    <div v-if="showBackdrop" class="conv-files__backdrop" @click="setCollapsed(true)"></div>
  </teleport>

  <aside
    v-if="hasFiles"
    class="conv-files"
    :class="{ 'is-collapsed': collapsed, 'is-narrow': isNarrow }"
  >
    <!-- Collapsed rail: deliverable count (and intermediates when present). -->
    <button
      v-if="collapsed"
      class="conv-files__rail"
      :title="t('chat.filesPanel.expand')"
      @click="setCollapsed(false)"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"
        />
      </svg>
      <span class="conv-files__rail-badge">{{ summary.primary }}</span>
      <span
        v-if="summary.auxiliary"
        class="conv-files__rail-badge is-aux"
        :title="t('chat.filesPanel.auxiliaryTitle')"
      >{{ summary.auxiliary }}</span>
      <span
        v-if="unavailableCount"
        class="conv-files__rail-badge is-unavailable"
        :title="t('chat.filesPanel.unavailableTitle')"
      >{{ unavailableCount }}</span>
    </button>

    <template v-else>
      <header class="conv-files__header">
        <span class="conv-files__title">{{ t('chat.filesPanel.title') }}</span>
        <button
          class="conv-files__action"
          :title="t('chat.filesPanel.collapse')"
          @click="setCollapsed(true)"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 6l6 6-6 6"
            />
          </svg>
        </button>
      </header>

      <div class="conv-files__body">
        <section
          v-for="(turn, index) in displayTurns"
          :key="String(turn.messageId ?? index)"
          class="conv-files__turn"
        >
          <div v-if="formatTime(turn.createdAt) || turn.auxiliary.length" class="conv-files__turn-head">
            <span class="conv-files__turn-time">{{ formatTime(turn.createdAt) }}</span>
            <span v-if="turn.auxiliary.length" class="conv-files__turn-meta">
              {{ t('chat.filesPanel.turnAuxiliary', { count: turn.auxiliary.length }) }}
            </span>
          </div>

            <a
              v-for="file in turn.primary"
              :key="`p-${file.name}`"
              class="conv-files__file"
              :class="{ 'is-unavailable': isFileUnavailable(file.url) }"
              :href="isFileUnavailable(file.url) ? undefined : file.url"
              :aria-disabled="isFileUnavailable(file.url) || undefined"
              target="_blank"
              rel="noopener"
              :title="isFileUnavailable(file.url) ? t('chat.filesPanel.unavailableHint') : reasonLabel(file)"
            >
              <span
                v-if="isImageRow(file) && !isFileUnavailable(file.url)"
                class="conv-files__thumb"
                :ref="el => observeThumb(file, el as Element | null)"
              >
                <img
                  v-if="loadedThumbs.has(file.url)"
                  :data-generated-src="file.url"
                  :src="TRANSPARENT_PIXEL"
                  :alt="file.name"
                  class="conv-files__thumb-img"
                  data-generated-image="1"
                />
              </span>
              <span class="conv-files__ext">{{ extensionOf(file.name) }}</span>
              <span class="conv-files__name">{{ file.name }}</span>
              <span v-if="isFileUnavailable(file.url)" class="conv-files__unavailable-chip">
                {{ t('chat.filesPanel.unavailable') }}
              </span>
              <span v-if="file.versions.length > 1" class="conv-files__versions">
                {{ t('chat.filesPanel.versions', { count: file.versions.length }) }}
              </span>
            </a>

          <template v-if="showAuxiliary">
            <a
              v-for="file in turn.auxiliary"
              :key="`a-${file.name}`"
              class="conv-files__file is-auxiliary"
              :class="{ 'is-unavailable': isFileUnavailable(file.url) }"
              :href="isFileUnavailable(file.url) ? undefined : file.url"
              :aria-disabled="isFileUnavailable(file.url) || undefined"
              target="_blank"
              rel="noopener"
              :title="isFileUnavailable(file.url) ? t('chat.filesPanel.unavailableHint') : reasonLabel(file)"
            >
              <span
                v-if="isImageRow(file) && !isFileUnavailable(file.url)"
                class="conv-files__thumb"
                :ref="el => observeThumb(file, el as Element | null)"
              >
                <img
                  v-if="loadedThumbs.has(file.url)"
                  :data-generated-src="file.url"
                  :src="TRANSPARENT_PIXEL"
                  :alt="file.name"
                  class="conv-files__thumb-img"
                  data-generated-image="1"
                />
              </span>
              <span class="conv-files__ext">{{ extensionOf(file.name) }}</span>
              <span class="conv-files__name">{{ file.name }}</span>
              <span v-if="isFileUnavailable(file.url)" class="conv-files__unavailable-chip">
                {{ t('chat.filesPanel.unavailable') }}
              </span>
              <span v-if="file.versions.length > 1" class="conv-files__versions">
                {{ t('chat.filesPanel.versions', { count: file.versions.length }) }}
              </span>
            </a>
          </template>
        </section>

        <button
          v-if="summary.auxiliary"
          class="conv-files__toggle"
          @click="toggleAuxiliary"
        >
          {{
            showAuxiliary
              ? t('chat.filesPanel.hideAuxiliary')
              : t('chat.filesPanel.showAuxiliary', { count: summary.auxiliary })
          }}
        </button>

        <button
          v-if="unavailableCount"
          class="conv-files__toggle is-filter"
          @click="toggleHideUnavailable"
        >
          {{
            hideUnavailable
              ? t('chat.filesPanel.showUnavailable', { count: unavailableCount })
              : t('chat.filesPanel.hideUnavailable', { count: unavailableCount })
          }}
        </button>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.conv-files {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--mc-border-light);
  background: var(--mc-bg-muted, #f9f7f5);
  overflow: hidden;
  min-height: 0;
  transition: width 0.2s ease;
}
.conv-files.is-collapsed {
  width: 44px;
}
.conv-files.is-narrow:not(.is-collapsed) {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(340px, 88vw);
  z-index: 2000;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.18);
}
.conv-files__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1999;
  background: rgba(0, 0, 0, 0.3);
}
.conv-files__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--mc-text-tertiary);
}
.conv-files__rail:hover {
  color: var(--mc-primary);
}
.conv-files__rail-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--mc-success, #67c23a);
  background: var(--mc-bg-sunken, #f3f0ed);
  border: 1px solid var(--mc-border-light);
  border-radius: 10px;
  padding: 1px 6px;
}
.conv-files__rail-badge.is-aux {
  color: var(--mc-text-tertiary);
}
.conv-files__rail-badge.is-unavailable {
  color: var(--mc-danger, #f56c6c);
}
.conv-files__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--mc-border-light);
  flex-shrink: 0;
}
.conv-files__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mc-text-primary);
}
.conv-files__action {
  display: inline-flex;
  align-items: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--mc-text-tertiary);
  padding: 2px;
}
.conv-files__action:hover {
  color: var(--mc-primary);
}
.conv-files__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 0;
}
.conv-files__turn + .conv-files__turn {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--mc-border-light);
}
.conv-files__turn-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin: 0 2px 6px;
}
.conv-files__turn-time {
  font-size: 11px;
  color: var(--mc-text-tertiary);
}
.conv-files__turn-meta {
  font-size: 11px;
  color: var(--mc-text-tertiary);
}
.conv-files__file {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 6px;
  text-decoration: none;
  color: var(--mc-text-primary);
  font-size: 12px;
  line-height: 1.35;
}
.conv-files__file:hover {
  background: var(--mc-bg-sunken, #f3f0ed);
  color: var(--mc-primary);
}
.conv-files__file.is-auxiliary {
  color: var(--mc-text-secondary);
  opacity: 0.85;
}
/* Known gone (the server answered 404/410 for this row): keep the name for
   traceability, but stop offering a link that cannot work. */
.conv-files__file.is-unavailable {
  color: var(--mc-text-tertiary);
  cursor: default;
}
.conv-files__file.is-unavailable .conv-files__name {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}
.conv-files__unavailable-chip {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--mc-danger, #f56c6c);
  border: 1px solid var(--mc-danger, #f56c6c);
  border-radius: 4px;
  padding: 0 3px;
}
/* Thumbnail of a generated image (chart/screenshot): the picture is the point of
   the artifact, so show it instead of only its name. */
.conv-files__thumb {
  flex-shrink: 0;
  display: inline-flex;
  width: 34px;
  height: 34px;
  border: 1px solid var(--mc-border-light);
  border-radius: 5px;
  overflow: hidden;
  background: var(--mc-bg-sunken, #f3f0ed);
}
.conv-files__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.conv-files__ext {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--mc-text-tertiary);
  background: var(--mc-bg-sunken, #f3f0ed);
  border: 1px solid var(--mc-border-light);
  border-radius: 4px;
  padding: 1px 3px;
  min-width: 26px;
  text-align: center;
}
.conv-files__name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.conv-files__versions {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--mc-text-tertiary);
}
.conv-files__toggle {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 5px 8px;
  border: 1px dashed var(--mc-border-light);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  color: var(--mc-text-secondary);
}
.conv-files__toggle:hover {
  color: var(--mc-primary);
  border-color: var(--mc-primary);
}
.conv-files__toggle.is-filter {
  margin-top: 6px;
}
</style>
