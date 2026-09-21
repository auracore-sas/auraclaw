import { createI18n } from 'vue-i18n'
import { compileToFunction, registerMessageCompiler } from '@intlify/core-base'
import { ref } from 'vue'
import { settingsApi } from '@/api'

export type AppLocale = 'zh-CN' | 'en-US' | 'es-ES'

const STORAGE_KEY = 'mateclaw_locale'
const DEFAULT_LOCALE: AppLocale = 'es-ES'

/**
 * Missing keys in the active locale resolve against this one.
 *
 * It MUST be 'en-US' (the upstream source of truth), never DEFAULT_LOCALE:
 * with `fallbackLocale: 'es-ES'` any string the upstream adds and `es-ES.ts`
 * has not translated yet renders in the UI as the raw key path. English is
 * the one dictionary guaranteed to be complete, because upstream ships it.
 */
export const FALLBACK_LOCALE: AppLocale = 'en-US'

export const currentLocale = ref<AppLocale>(DEFAULT_LOCALE)

// Replace vue-i18n's default message compiler with a safety wrapper. The
// default compiler throws on parse errors in production builds, which
// caused a regression: workflow step prompts containing Pebble syntax
// (`Hello {{ inputs.payload }}`) leaked into i18n's parser through one of
// vue-i18n's internal lookups and aborted the property panel render.
// Catching the throw here keeps the panel alive — the worst case is that
// a malformed message renders as its literal text instead of the
// interpolated form, which is the same fallback dev mode already has.
const safeMessageCompiler = ((message: any, context: any) => {
  try {
    return compileToFunction(message, context)
  } catch {
    const literal = typeof message === 'string' ? message : String(message)
    return () => literal
  }
}) as typeof compileToFunction
registerMessageCompiler(safeMessageCompiler)

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages: {} as Record<AppLocale, any>,
  messageCompiler: safeMessageCompiler,
})

const loadedLocales = new Set<AppLocale>()

// Each locale dictionary is ~78KB. Splitting them into their own chunks keeps
// the entry bundle ~150KB lighter — only the active locale is fetched on cold
// start, the other one only when the user switches language.
async function loadLocaleMessages(locale: AppLocale) {
  if (loadedLocales.has(locale)) return
  const messages = locale === 'zh-CN'
    ? (await import('./locales/zh-CN')).default
    : locale === 'es-ES'
      ? (await import('./locales/es-ES')).default
      : (await import('./locales/en-US')).default
  i18n.global.setLocaleMessage(locale, messages)
  loadedLocales.add(locale)
}

function normalizeLocale(locale?: string | null): AppLocale {
  if (locale === 'en' || locale === 'en-US') {
    return 'en-US'
  }
  if (locale === 'es' || locale === 'es-ES' || locale === 'es-419' || locale === 'es-MX') {
    return 'es-ES'
  }
  if (locale === 'zh' || locale === 'zh-CN') {
    return 'zh-CN'
  }
  return DEFAULT_LOCALE
}

export async function applyLocale(locale?: string | null) {
  const normalized = normalizeLocale(locale)
  // Must finish loading messages before flipping currentLocale, otherwise the
  // first render after a switch would show the i18n keys verbatim.
  await loadLocaleMessages(normalized)
  // The fallback dictionary has to be resident too, or vue-i18n cannot resolve
  // keys the active locale does not define yet (strings added by a newer
  // upstream release). Costs one extra ~78KB chunk, only when the active
  // locale is not English.
  if (normalized !== FALLBACK_LOCALE) {
    await loadLocaleMessages(FALLBACK_LOCALE)
  }
  currentLocale.value = normalized
  i18n.global.locale.value = normalized
  localStorage.setItem(STORAGE_KEY, normalized)
  return normalized
}

export async function initializeLocale() {
  try {
    const res: any = await settingsApi.getLanguage()
    return await applyLocale(res.data)
  } catch {
    return await applyLocale(localStorage.getItem(STORAGE_KEY))
  }
}
