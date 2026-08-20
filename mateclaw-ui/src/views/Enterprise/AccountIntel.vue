<template>
  <div class="account-shell">
    <aside class="account-list mc-surface-card">
      <header class="list-head">
        <h3 class="list-title">{{ t('enterprise.account.listTitle') }}</h3>
        <div class="list-filters">
          <button v-for="f in listFilters" :key="f.key"
                  class="chip" :class="{ active: listFilter === f.key }"
                  @click="listFilter = f.key">
            {{ f.label }}
            <span v-if="f.count != null" class="chip-count">{{ f.count }}</span>
          </button>
        </div>
      </header>

      <ul class="account-cards">
        <li v-for="a in filteredAccounts" :key="a.id"
            class="account-card" :class="{ active: a.id === selectedId }"
            @click="selectedId = a.id">
          <div class="account-logo" :style="{ background: a.color }">{{ a.short }}</div>
          <div class="account-body">
            <div class="account-name">{{ a.name }}</div>
            <div class="account-meta">{{ a.industry }} · {{ a.region }}</div>
            <div class="account-score-row">
              <div class="score-bar"><div class="score-fill" :style="{ width: a.score + '%' }"></div></div>
              <span class="score-text">{{ a.score }}</span>
            </div>
            <div class="account-stage">{{ stageLabel(a.stage) }}</div>
          </div>
        </li>
      </ul>
    </aside>

    <section class="account-center mc-surface-card">
      <header class="center-head">
        <div class="center-headline">
          <h2 class="center-title">{{ selectedAccount.name }}</h2>
          <div class="center-sub">
            <span>{{ selectedAccount.industry }}</span>
            <span class="dot"></span>
            <span>{{ selectedAccount.region }}</span>
            <span class="dot"></span>
            <span>{{ stageLabel(selectedAccount.stage) }}</span>
            <span class="dot"></span>
            <span>{{ t('enterprise.account.aum') }} {{ selectedAccount.aum }}</span>
          </div>
        </div>
        <div class="score-pill" :class="scoreToneFor(selectedAccount.score)">
          <span class="score-pill-label">{{ t('enterprise.account.opportunityScore') }}</span>
          <span class="score-pill-value">{{ selectedAccount.score }}</span>
          <span class="score-pill-delta">{{ selectedAccount.scoreDelta }}</span>
        </div>
      </header>

      <div class="people-strip">
        <div class="people-label">{{ t('enterprise.account.keyPeople') }}</div>
        <div class="people-row">
          <div v-for="p in selectedAccount.people" :key="p.name" class="person">
            <div class="person-avatar">{{ p.short }}</div>
            <div class="person-body">
              <div class="person-name">{{ p.name }}</div>
              <div class="person-role">{{ p.role }}</div>
            </div>
            <span class="person-tag" :class="`tag-${p.kind}`">{{ kindLabel(p.kind) }}</span>
          </div>
        </div>
      </div>

      <div class="timeline-wrap">
        <div class="timeline-head">
          <div class="timeline-title">{{ t('enterprise.account.timelineTitle') }}</div>
          <div class="timeline-tabs">
            <button v-for="f in tlFilters" :key="f.key"
                    class="chip" :class="{ active: tlFilter === f.key }"
                    @click="tlFilter = f.key">{{ f.label }}</button>
          </div>
        </div>
        <ol class="timeline">
          <li v-for="ev in filteredTimeline" :key="ev.id" class="tl-item">
            <div class="tl-bullet" :class="`tl-${ev.kind}`"></div>
            <div class="tl-body">
              <div class="tl-row">
                <span class="tl-kind" :class="`kind-${ev.kind}`">{{ kindLabelEvent(ev.kind) }}</span>
                <span class="tl-time">{{ ev.at }}</span>
              </div>
              <div class="tl-summary">{{ ev.summary }}</div>
              <div class="tl-evidence">
                <span class="ev-label">{{ t('enterprise.account.evidence') }}</span>
                <span>{{ ev.source }}</span>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <aside class="account-actions mc-surface-card">
      <header class="actions-head">
        <h3 class="list-title">{{ t('enterprise.account.actionsTitle') }}</h3>
        <p class="actions-sub">{{ t('enterprise.account.actionsSub') }}</p>
      </header>

      <ul class="action-list">
        <li v-for="(a, i) in selectedAccount.actions" :key="i" class="action-item" :class="`priority-${a.priority}`">
          <div class="action-head">
            <span class="action-priority" :class="`priority-${a.priority}`">{{ priorityLabel(a.priority) }}</span>
            <span class="action-when">{{ a.when }}</span>
          </div>
          <div class="action-title">{{ a.title }}</div>
          <div class="action-rationale">{{ a.rationale }}</div>
          <div class="action-foot">
            <button class="btn-action">{{ t('enterprise.account.btnDoIt') }}</button>
            <button class="btn-action btn-action--ghost">{{ t('enterprise.account.btnSnooze') }}</button>
          </div>
        </li>
      </ul>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
type ListFilterKey = 'all' | 'hot' | 'cooling'
type TlFilterKey = 'all' | 'public' | 'meeting' | 'doc'

const listFilter = ref<ListFilterKey>('all')
const tlFilter = ref<TlFilterKey>('all')

const listFilters = computed<{ key: ListFilterKey; label: string; count: number }[]>(() => [
  { key: 'all', label: t('enterprise.account.filterAll'), count: 14 },
  { key: 'hot', label: t('enterprise.account.filterHot'), count: 4 },
  { key: 'cooling', label: t('enterprise.account.filterCooling'), count: 3 },
])

const tlFilters = computed<{ key: TlFilterKey; label: string }[]>(() => [
  { key: 'all', label: t('enterprise.account.tlAll') },
  { key: 'public', label: t('enterprise.account.tlPublic') },
  { key: 'meeting', label: t('enterprise.account.tlMeeting') },
  { key: 'doc', label: t('enterprise.account.tlDoc') },
])

interface Person { name: string; role: string; kind: 'decider' | 'influencer' | 'user' | 'procurement'; short: string }
interface Event { id: string; kind: 'news' | 'hiring' | 'funding' | 'product' | 'meeting' | 'doc' | 'competitor'; summary: string; source: string; at: string }
interface Action { priority: 'high' | 'medium' | 'low'; when: string; title: string; rationale: string }

interface Account {
  id: string
  name: string
  short: string
  industry: string
  region: string
  stage: 'prospect' | 'qualified' | 'proposal' | 'negotiation' | 'won'
  aum: string
  score: number
  scoreDelta: string
  color: string
  people: Person[]
  events: Event[]
  actions: Action[]
}

const accounts: Account[] = [
  {
    id: 'acme',
    name: 'Acme Corp',
    short: 'AC',
    industry: 'SaaS de comercio electrónico',
    region: 'Norteamérica · SF',
    stage: 'negotiation',
    aum: 'US$12M / año',
    score: 82,
    scoreDelta: '+8 (esta semana)',
    color: 'linear-gradient(135deg, #d96d46, #ebb08f)',
    people: [
      { name: 'Dr. Chen', role: 'CTO (nuevo)', kind: 'decider', short: 'Ch' },
      { name: 'Marcus Lee', role: 'VP Engineering', kind: 'influencer', short: 'M' },
      { name: 'Ing. Zhang', role: 'Arquitecto Senior', kind: 'user', short: 'Zh' },
      { name: 'Janet Wu', role: 'Procurement', kind: 'procurement', short: 'J' },
    ],
    events: [
      { id: 'e1', kind: 'hiring', summary: 'Acme está contratando Privacy Counsel en LinkedIn (4 puestos), señal de que acelera su área de cumplimiento', source: 'Señal LinkedIn · captura automática', at: 'hace 6 h' },
      { id: 'e2', kind: 'news', summary: 'El CEO dijo en la reunión trimestral de Acme: «En 2026 H1 llevaremos toda la infraestructura a la nube»', source: 'Informe trimestral oficial · pág. 4', at: 'Hoy 10:30' },
      { id: 'e3', kind: 'meeting', summary: 'Segunda llamada con el Dr. Chen: el CTO mostró interés explícito en residencia de datos + capacidad de despliegue privado', source: 'Acta de reunión · registro de ventas', at: 'Ayer 16:00' },
      { id: 'e4', kind: 'competitor', summary: 'Apareció un registro POC de Zerto en el sistema de compras de Acme: máxima alerta', source: 'Señal de competencia · Crunchbase', at: 'Anteayer' },
      { id: 'e5', kind: 'doc', summary: 'Se subió el white paper de arquitectura técnica 2025 de Acme a la biblioteca interna; se identificaron 7 puntos de entrada potenciales', source: 'Base de clientes · Acme.pdf', at: 'Anteayer' },
      { id: 'e6', kind: 'funding', summary: 'Acme cerró ronda D de US$80M y se prepara para expandirse a Europa', source: 'TechCrunch · artículo', at: 'la semana pasada' },
    ],
    actions: [
      { priority: 'high',   when: 'Hoy', title: 'Enviar al Dr. Chen el PDF de la propuesta de despliegue privado', rationale: 'El Dr. Chen mostró interés explícito en residencia de datos en la última reunión; el follow-up pendiente no se ha enviado' },
      { priority: 'high',   when: 'Esta semana', title: 'Agendar una sesión de revisión técnica con Marcus Lee', rationale: 'El VP de Ingeniería es un influenciador clave; la señal del POC de Zerto significa que nuestra ventana de tiempo se acorta' },
      { priority: 'medium', when: 'Esta semana', title: 'Comparar el caso Acme con el caso BlueWave', rationale: 'Un competidor del mismo sector (SaaS e-commerce) tiene volumen similar: sirve como case study' },
      { priority: 'low',    when: 'La próxima semana', title: 'Responder a la señal de «cloud» del informe trimestral de Acme con un artículo de thought leadership', rationale: 'El canal de content marketing puede amplificar esa señal de oportunidad' },
    ],
  },
  {
    id: 'bluewave',
    name: 'BlueWave Tech',
    short: 'BW',
    industry: 'Fintech',
    region: 'Hong Kong',
    stage: 'won',
    aum: 'US$8M / año',
    score: 91,
    scoreDelta: '+2',
    color: 'linear-gradient(135deg, #184a45, #4a8c84)',
    people: [], events: [], actions: [],
  },
  {
    id: 'finchen',
    name: 'FinChen Finanzas',
    short: 'FC',
    industry: 'Banca',
    region: 'Shanghái',
    stage: 'qualified',
    aum: 'Potencial US$20M',
    score: 64,
    scoreDelta: '-3',
    color: 'linear-gradient(135deg, #9b7d6c, #d9cec2)',
    people: [], events: [], actions: [],
  },
  {
    id: 'zerto-prospect',
    name: 'Vertex Logistics',
    short: 'VL',
    industry: 'Logística',
    region: 'Shenzhen',
    stage: 'prospect',
    aum: 'Potencial US$4M',
    score: 38,
    scoreDelta: '-12',
    color: 'linear-gradient(135deg, #cdbdad, #ebe3db)',
    people: [], events: [], actions: [],
  },
]

const filteredAccounts = computed(() => {
  switch (listFilter.value) {
    case 'hot': return accounts.filter(a => a.score >= 70)
    case 'cooling': return accounts.filter(a => a.scoreDelta.startsWith('-'))
    default: return accounts
  }
})

const selectedId = ref<string>(accounts[0].id)
const selectedAccount = computed(() => accounts.find(a => a.id === selectedId.value) ?? accounts[0])

const filteredTimeline = computed(() => {
  const evs = selectedAccount.value.events
  if (tlFilter.value === 'all') return evs
  if (tlFilter.value === 'meeting') return evs.filter(e => e.kind === 'meeting')
  if (tlFilter.value === 'doc') return evs.filter(e => e.kind === 'doc')
  // 'public' = news/hiring/funding/product/competitor
  return evs.filter(e => ['news', 'hiring', 'funding', 'product', 'competitor'].includes(e.kind))
})

function stageLabel(s: Account['stage']): string { return t(`enterprise.account.stage.${s}`) }
function priorityLabel(p: 'high' | 'medium' | 'low'): string { return t(`enterprise.account.priority.${p}`) }
function kindLabel(k: Person['kind']): string { return t(`enterprise.account.role.${k}`) }
function kindLabelEvent(k: Event['kind']): string { return t(`enterprise.account.eventKind.${k}`) }

function scoreToneFor(score: number): string {
  if (score >= 75) return 'tone-good'
  if (score >= 50) return 'tone-warn'
  return 'tone-bad'
}
</script>

<style scoped>
.account-shell {
  display: grid;
  grid-template-columns: 280px 1fr 340px;
  grid-template-rows: minmax(0, 1fr);
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.account-list, .account-center, .account-actions {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow: hidden;
}
.account-list { padding: 16px 0; }

/* === list pane === */
.list-head { padding: 0 18px; display: flex; flex-direction: column; gap: 8px; }
.list-title { font-size: 14px; font-weight: 700; color: var(--mc-text-primary); margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
.list-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.chip {
  border: 1px solid var(--mc-border-light);
  background: var(--mc-bg-elevated);
  color: var(--mc-text-secondary);
  font-size: 11px;
  padding: 4px 9px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.chip.active { background: var(--mc-primary-bg); color: var(--mc-primary-hover); border-color: var(--mc-primary); }
.chip-count { opacity: 0.65; }

.account-cards { list-style: none; margin: 0; padding: 0 0 16px; overflow-y: auto; flex: 1; }
.account-card {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  padding: 12px 18px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: all 0.12s;
}
.account-card:hover { background: var(--mc-bg-muted); }
.account-card.active { background: var(--mc-primary-bg); border-left-color: var(--mc-primary); }
.account-logo {
  width: 40px; height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 13px;
  font-weight: 700;
}
.account-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.account-name { font-size: 13px; font-weight: 600; color: var(--mc-text-primary); }
.account-meta { font-size: 11px; color: var(--mc-text-tertiary); }
.account-score-row { display: flex; gap: 6px; align-items: center; margin-top: 2px; }
.score-bar { flex: 1; height: 4px; background: var(--mc-bg-sunken); border-radius: 2px; overflow: hidden; }
.score-fill { height: 100%; background: linear-gradient(90deg, var(--mc-primary), var(--mc-primary-light)); }
.score-text { font-size: 11px; font-weight: 700; color: var(--mc-primary-hover); }
.account-stage {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--mc-bg-muted);
  color: var(--mc-text-secondary);
  align-self: flex-start;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* === center pane === */
.center-head { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1px solid var(--mc-border-light); }
.center-headline { display: flex; flex-direction: column; gap: 4px; }
.center-title { font-size: 18px; font-weight: 700; color: var(--mc-text-primary); margin: 0; }
.center-sub { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--mc-text-secondary); flex-wrap: wrap; }
.dot { width: 3px; height: 3px; background: currentColor; border-radius: 50%; opacity: 0.5; }

.score-pill {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  border-radius: 12px;
  background: var(--mc-bg-muted);
  border: 1px solid var(--mc-border-light);
}
.score-pill.tone-good { border-color: #84cc16; background: #f7fee7; }
.score-pill.tone-warn { border-color: #fbbf24; background: #fffbeb; }
.score-pill.tone-bad  { border-color: #ef4444; background: #fef2f2; }
.score-pill-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mc-text-tertiary); }
.score-pill-value { font-size: 22px; font-weight: 700; color: var(--mc-text-primary); }
.score-pill-delta { font-size: 11px; font-weight: 600; color: #15803d; }
.score-pill.tone-bad .score-pill-delta { color: #b91c1c; }

/* === people === */
.people-strip { background: var(--mc-bg-muted); border-radius: 10px; padding: 10px 12px; }
.people-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mc-text-tertiary); margin-bottom: 8px; }
.people-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
.person {
  display: flex; gap: 8px; align-items: center;
  background: var(--mc-bg-elevated);
  border-radius: 8px;
  padding: 8px 10px;
}
.person-avatar {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: var(--mc-primary-bg);
  color: var(--mc-primary-hover);
  font-size: 12px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.person-body { flex: 1; min-width: 0; }
.person-name { font-size: 12px; font-weight: 600; color: var(--mc-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.person-role { font-size: 11px; color: var(--mc-text-tertiary); }
.person-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
.tag-decider { background: #fee2e2; color: #b91c1c; }
.tag-influencer { background: #fef3c7; color: #b45309; }
.tag-user { background: #dbeafe; color: #1e40af; }
.tag-procurement { background: var(--mc-bg-sunken); color: var(--mc-text-secondary); }

/* === timeline === */
.timeline-wrap { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 10px; }
.timeline-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.timeline-title { font-size: 14px; font-weight: 700; color: var(--mc-text-primary); }
.timeline-tabs { display: flex; gap: 6px; flex-wrap: wrap; }

.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.tl-item { display: grid; grid-template-columns: 12px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--mc-border-light); }
.tl-item:last-child { border-bottom: none; }
.tl-bullet {
  width: 12px; height: 12px;
  border-radius: 50%;
  margin-top: 4px;
}
.tl-news { background: var(--mc-text-secondary); }
.tl-hiring { background: #2563eb; }
.tl-funding { background: #15803d; }
.tl-product { background: var(--mc-accent); }
.tl-meeting { background: var(--mc-primary); }
.tl-doc { background: #f59e0b; }
.tl-competitor { background: #b91c1c; }

.tl-body { display: flex; flex-direction: column; gap: 4px; }
.tl-row { display: flex; gap: 8px; align-items: center; }
.tl-kind {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.kind-news, .kind-competitor { background: var(--mc-bg-sunken); color: var(--mc-text-secondary); }
.kind-competitor { background: #fee2e2; color: #b91c1c; }
.kind-hiring { background: #dbeafe; color: #1e40af; }
.kind-funding { background: #dcfce7; color: #15803d; }
.kind-product { background: var(--mc-accent-soft); color: var(--mc-accent); }
.kind-meeting { background: var(--mc-primary-bg); color: var(--mc-primary-hover); }
.kind-doc { background: #fef3c7; color: #b45309; }

.tl-time { font-size: 11px; color: var(--mc-text-tertiary); font-family: var(--mc-font-mono); }
.tl-summary { font-size: 13px; color: var(--mc-text-primary); line-height: 1.5; }
.tl-evidence { font-size: 11px; color: var(--mc-text-tertiary); display: flex; gap: 6px; align-items: baseline; }
.ev-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }

/* === actions pane === */
.actions-head { display: flex; flex-direction: column; gap: 4px; }
.actions-sub { font-size: 11px; color: var(--mc-text-tertiary); margin: 0; line-height: 1.45; }
.action-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1; }
.action-item {
  border: 1px solid var(--mc-border-light);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--mc-bg-elevated);
  border-left-width: 4px;
}
.action-item.priority-high { border-left-color: #ef4444; }
.action-item.priority-medium { border-left-color: #f59e0b; }
.action-item.priority-low { border-left-color: var(--mc-border); }

.action-head { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.action-priority {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.action-priority.priority-high { background: #fee2e2; color: #b91c1c; }
.action-priority.priority-medium { background: #fef3c7; color: #b45309; }
.action-priority.priority-low { background: var(--mc-bg-muted); color: var(--mc-text-secondary); }
.action-when { font-size: 11px; color: var(--mc-text-tertiary); }
.action-title { font-size: 13px; font-weight: 600; color: var(--mc-text-primary); line-height: 1.45; }
.action-rationale { font-size: 12px; color: var(--mc-text-secondary); line-height: 1.5; }
.action-foot { display: flex; gap: 6px; margin-top: 4px; }
.btn-action {
  background: var(--mc-primary);
  color: white;
  border: none;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-action:hover { background: var(--mc-primary-hover); }
.btn-action--ghost { background: transparent; color: var(--mc-text-secondary); border: 1px solid var(--mc-border); }
.btn-action--ghost:hover { background: var(--mc-bg-muted); }

@media (max-width: 1200px) { .account-shell { grid-template-columns: 240px 1fr 280px; } }
@media (max-width: 1000px) { .account-shell { grid-template-columns: 1fr; } }
</style>
