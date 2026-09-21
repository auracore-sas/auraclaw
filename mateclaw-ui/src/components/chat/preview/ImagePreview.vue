<script setup lang="ts">
/**
 * Image viewer for generated artifacts (charts, screenshots, rendered HTML).
 *
 * Before this existed, clicking a generated `.png` could only download it: the
 * preview pipeline had no image kind, so the chat could never *show* a picture
 * it had produced. Now every image link, inline image and panel thumbnail lands
 * here.
 *
 * Security: the bytes are rendered through `<img>` with a blob URL. An SVG is
 * therefore never opened as a document — `<img>` does not run the scripts a
 * generated SVG may contain, while a same-origin blob document would. For that
 * reason "open in a new tab" is offered for raster formats only.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { extensionOf } from './previewKind'

const props = defineProps<{
  /** Raw image bytes, already fetched with auth by the dialog. */
  data: ArrayBuffer
  filename: string
}>()

const { t } = useI18n()

const objectUrl = ref('')
const scale = ref(1)
const MIN_SCALE = 0.25
const MAX_SCALE = 8

const isSvg = computed(() => extensionOf(props.filename) === 'svg')

/** MIME for the blob; without it an SVG blob would not render. */
const mimeType = computed(() => {
  switch (extensionOf(props.filename)) {
    case 'svg': return 'image/svg+xml'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    case 'bmp': return 'image/bmp'
    case 'avif': return 'image/avif'
    default: return 'image/png'
  }
})

function revoke() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = ''
  }
}

/** Rebuild the object URL whenever the dialog loads another image. */
watch(
  () => [props.data, props.filename] as const,
  () => {
    revoke()
    objectUrl.value = URL.createObjectURL(new Blob([props.data], { type: mimeType.value }))
    scale.value = 1
  },
  { immediate: true },
)

onBeforeUnmount(revoke)

function zoomBy(factor: number) {
  scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value * factor))
}

function resetZoom() {
  scale.value = 1
}

/** Ctrl/⌘ + wheel zooms (a plain wheel keeps scrolling the zoomed image). */
function onWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15)
}

/** Drag to pan once the image is larger than the viewport. */
const viewport = ref<HTMLElement | null>(null)

function onPointerDown(event: PointerEvent) {
  const el = viewport.value
  if (!el || scale.value <= 1) return
  const startX = event.clientX
  const startY = event.clientY
  const startLeft = el.scrollLeft
  const startTop = el.scrollTop
  const move = (moveEvent: PointerEvent) => {
    el.scrollLeft = startLeft - (moveEvent.clientX - startX)
    el.scrollTop = startTop - (moveEvent.clientY - startY)
  }
  const stop = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
}

function openInTab() {
  if (!objectUrl.value || isSvg.value) return
  window.open(objectUrl.value, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="image-preview">
    <div class="image-preview__toolbar">
      <button type="button" :title="t('chat.preview.zoomOut')" @click="zoomBy(1 / 1.25)">−</button>
      <button type="button" class="image-preview__percent" :title="t('chat.preview.zoomReset')" @click="resetZoom">
        {{ Math.round(scale * 100) }}%
      </button>
      <button type="button" :title="t('chat.preview.zoomIn')" @click="zoomBy(1.25)">+</button>
      <button
        v-if="!isSvg"
        type="button"
        class="image-preview__open"
        :title="t('chat.preview.openInTab')"
        @click="openInTab"
      >{{ t('chat.preview.openInTab') }}</button>
    </div>

    <div ref="viewport" class="image-preview__viewport" @wheel="onWheel" @pointerdown="onPointerDown">
      <img
        v-if="objectUrl"
        :src="objectUrl"
        :alt="filename"
        class="image-preview__img"
        :style="{ width: `${scale * 100}%` }"
        draggable="false"
      />
    </div>
  </div>
</template>

<style scoped>
.image-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.image-preview__toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--mc-border-light);
  flex-shrink: 0;
}
.image-preview__toolbar button {
  min-width: 26px;
  height: 24px;
  border: 1px solid var(--mc-border-light);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  color: var(--mc-text-secondary);
}
.image-preview__toolbar button:hover {
  color: var(--mc-primary);
  border-color: var(--mc-primary);
}
.image-preview__percent {
  min-width: 52px !important;
  font-size: 11px !important;
}
.image-preview__open {
  margin-left: auto;
  padding: 0 8px;
  font-size: 11px;
}
.image-preview__viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background:
    repeating-conic-gradient(#00000008 0% 25%, transparent 0% 50%) 50% / 16px 16px;
  cursor: grab;
}
.image-preview__img {
  max-width: none;
  height: auto;
  user-select: none;
}
</style>
