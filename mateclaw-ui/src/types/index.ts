import type { ChatErrorInfo } from './chatError'

// ==================== 通用 ====================
export interface ApiResult<T = any> {
  code: number
  msg: string
  data: T
}

// ==================== 用户 ====================
export interface User {
  id: string | number
  username: string
  nickname: string
  avatar?: string
  email?: string
  role: 'admin' | 'user'
  enabled: boolean
  createTime: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  username: string
  nickname: string
  role: string
}

// ==================== Agent ====================
export interface Agent {
  id: string | number
  name: string
  description?: string
  agentType: 'react' | 'plan_execute'
  systemPrompt?: string
  modelName?: string
  maxIterations: number
  enabled: boolean
  icon?: string
  tags?: string
  workspaceBasePath?: string | null
  /** Agent-level primary wiki KB. Null means use workspace fallback. */
  primaryKbId?: string | number | null
  /**
   * Explicit opt-out: drop every SKILL.md catalog entry from the system
   * prompt and exclude skill-expanded tools. Independent of binding rows
   * (when `true`, the agent is treated as "no skills" regardless of any
   * leftover `mate_agent_skill` rows). Defaults to `false`.
   */
  skillsDisabled?: boolean
  /**
   * Explicit opt-out: exclude every non-system-level tool from the agent's
   * effective set and suppress MCP auto-include. System-level memory and
   * delegation primitives still pass through. Defaults to `false`.
   */
  toolsDisabled?: boolean
  /**
   * Explicit opt-out: this agent sees zero knowledge bases regardless of
   * leftover `mate_agent_wiki_kb` rows. Wiki tools degrade with their
   * standard "no knowledge base" message; the webchat `/wiki/pages` picker
   * returns an empty list. Defaults to `false`. Issue #304.
   */
  wikiDisabled?: boolean
  createTime?: string
  updateTime?: string
}

// 兼容旧代码
export type AgentEntity = Agent
export type AgentState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'COMPLETED'

// ==================== 会话与消息 ====================
export interface Conversation {
  id?: string | number
  conversationId: string
  title: string
  agentId: string | number
  agentName?: string
  agentIcon?: string
  username?: string
  messageCount: number
  lastMessage?: string
  status?: 'active' | 'closed'
  streamStatus?: 'idle' | 'running'
  source?: string
  conversationKind?: 'primary' | 'team_worker' | 'scheduled'
  pinned?: number
  /** Provider id of the model this conversation is pinned to (per-conversation model). */
  modelProvider?: string
  /** Model id this conversation is pinned to. Paired with modelProvider. */
  modelName?: string
  lastActiveTime?: string
  updateTime?: string
  createTime?: string
}

export interface Message {
  id?: string | number
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  contentParts: MessageContentPart[]
  thinkingExpanded?: boolean
  toolName?: string
  status?: 'generating' | 'completed' | 'stopped' | 'failed' | 'awaiting_approval' | 'interrupted'
  createTime?: string
  // Token 统计
  promptTokens?: number
  completionTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  // Runtime model attribution (assistant messages): the model that actually produced this reply
  runtimeModel?: string
  runtimeProvider?: string
  // 前端临时字段
  streaming?: boolean  // 内部动画控制，UI 渲染以 status 为准
  attachments?: ChatAttachment[]
  // Agent 事件元数据
  metadata?: MessageMetadata
  // 结构化错误信息（status === 'failed' 时可用）
  errorInfo?: ChatErrorInfo
}

export interface ChatAttachment {
  name: string
  size: number
  url: string
  storedName: string
  path: string
  contentType?: string
  /** 本地预览 URL（ObjectURL），图片附件用于避免 JWT 认证问题 */
  previewUrl?: string
}

export interface ToolCallMeta {
  name: string
  arguments?: string
  status: 'running' | 'completed' | 'awaiting_approval'
  result?: string
  success?: boolean
  startTime?: number
}

export interface PlanMeta {
  planId: string | number
  steps: string[]
  currentStep: number
  stepResults?: { result: string; status: string }[]
}

/** One tool the subagent called, shown in the nested delegation timeline. */
export interface DelegationToolEntry {
  name: string
  status: 'running' | 'completed' | 'error'
}

/**
 * A subagent at depth >= 2 in the delegation tree (a grandchild and deeper).
 * Built on the frontend from the flat delegation_* event stream, keyed by
 * subagentId and nested by parentSubagentId.
 */
export interface DelegationNode {
  subagentId: string
  agentName: string
  status: 'running' | 'completed' | 'error'
  depth: number
  task?: string
  plan?: PlanMeta
  tools?: DelegationToolEntry[]
  result?: string
  durationMs?: number
  /** Child token usage relayed from delegation_end / delegation_child_complete. */
  promptTokens?: number
  completionTokens?: number
  /** Heartbeat watchdog flagged this subagent as making no observable progress. */
  stale?: boolean
  /** Spawned via fire-and-forget delegation: runs detached, result via task_output. */
  async?: boolean
  children: DelegationNode[]
}

export interface PendingApprovalMeta {
  pendingId: string
  toolName: string
  arguments: string
  reason: string
  /**
   * pending_approval / approved / denied are server-authoritative terminal states.
   * 'expired' is a frontend-only local synthesis used by hydrate reverse-convergence
   * (RFC-067 §4.9): when a message's metadata still says pending_approval but the
   * server's getPendingApprovals no longer lists that pendingId, the UI flips to
   * 'expired' so the banner clears without waiting for a fresh stream event.
   */
  status: 'pending_approval' | 'approved' | 'denied' | 'expired'
  // 增强字段（Phase 6: 结构化风险信息）
  findings?: GuardFinding[]
  maxSeverity?: GuardSeverity
  summary?: string
}

/** 单个展示分段（Claude Code 风格分段式渲染） */
export interface MessageSegment {
  id: string
  type: 'thinking' | 'tool_call' | 'content' | 'phase' | 'approval' | 'plan'
  status: 'running' | 'completed' | 'error'
  /**
   * Producer-assigned emission index, monotonic within a turn. Present on
   * persisted segments; absent on live ones, which are already appended in
   * event order. Renderers sort by it instead of relocating segments by type.
   */
  seq?: number
  /** type=thinking */
  thinkingText?: string
  /** type=tool_call */
  toolName?: string
  toolArgs?: string
  toolResult?: string
  toolSuccess?: boolean
  /** LLM-provided tool call id, used to pair tool_call_started ↔ tool_call_completed */
  toolCallId?: string
  /**
   * For a top-level delegation segment (toolName starts with "→"): the depth-1
   * child agent's own token usage, kept as numbers (alongside the human-readable
   * suffix in toolArgs) so the message footer can roll children up into a turn total.
   */
  delegPromptTokens?: number
  delegCompletionTokens?: number
  /** type=content */
  text?: string
  /** type=phase */
  phaseName?: string
  /** type=approval */
  approval?: PendingApprovalMeta
  /** type=plan */
  plan?: PlanMeta
  /**
   * For delegation segments (toolName starts with "→"): the subagent's own
   * activity, relayed from the child conversation. Renders as a nested timeline
   * (its plan checklist + the tools it called + any grandchildren it delegated)
   * instead of jammed text in toolArgs. The depth-1 child is the segment itself;
   * `children` holds depth-2+ subagents as a recursive tree.
   */
  childTimeline?: {
    plan?: PlanMeta
    tools?: DelegationToolEntry[]
    children?: DelegationNode[]
  }
  /** For a delegation segment: heartbeat flagged the subagent as stalled (no progress). */
  delegationStale?: boolean
  /** For a delegation segment: spawned fire-and-forget, runs detached (result via task_output). */
  delegationAsync?: boolean
  /** 时间戳 */
  timestamp?: number
  /** Wall-clock end of the segment (set when status flips to completed); with
   *  timestamp it yields the real duration for history replays. */
  endTimestamp?: number
  /**
   * Iteration index this segment belongs to (0-based). Set by iteration_start —
   * lets MessageBubble group thinking/tool/content segments per iteration so
   * the next iteration's output never appends onto the previous one's tail.
   */
  iterationIndex?: number
  /** Subagent / delegation child ID, when this segment was emitted under a child scope. */
  subagentId?: string
  /** Backend signaled the running content was truncated to break a repetition pattern. */
  repetitionWarning?: 'char_pattern' | 'sentence_repetition'
  /** Number of trailing characters dropped when the repetition guard fired. */
  truncatedChars?: number
  /**
   * Producer-assigned content semantics from the backend agent graph:
   * 'pre_tool_narration' (provisional — text emitted alongside tool calls
   * before any observation this turn), 'grounded_narration', or
   * 'final_answer'. Delivered live via the segment_kind SSE event and
   * persisted in metadata.segments; absent on legacy messages.
   */
  kind?: string
  /** Backend marked this model-predicted tool result as replaced by a later actual tool result. */
  superseded?: boolean
  /** Segment ID that replaced this pre-tool prediction. */
  supersededBySegmentId?: string
  /** Machine-readable reason for superseding this segment. */
  supersededReason?: string
  /** MCP progress: 0-100 percentage */
  progress?: number
  /** MCP progress: human-readable stage message */
  progressMessage?: string
  /** MCP progress: current stage (prepare/execute/finalize) */
  progressStage?: string
}

/** A file artifact generated by a tool during the turn, surfaced in the run-overview rail. */
export interface GeneratedFile {
  filename: string
  url: string
  toolName?: string
}

export interface MessageMetadata {
  /** Internal note discriminator, e.g. 'compression_summary' | 'team_announce' | 'team_announce_reply' */
  type?: string
  /** type=team_announce: number of settled team tasks carried by this note */
  taskCount?: number
  /** Team orchestration ids remain strings to preserve Snowflake precision. */
  runId?: string
  taskId?: string
  originMessageId?: string
  teamId?: string
  leadConversationId?: string
  currentPhase?: string
  toolCalls?: ToolCallMeta[]
  plan?: PlanMeta
  pendingApproval?: PendingApprovalMeta
  /** 当前正在执行的工具名称 */
  runningToolName?: string
  /** 服务端警告列表 */
  warnings?: string[]
  /** 分段式展示数据（新版渲染用） */
  segments?: MessageSegment[]
  /** 运行总览展示的已生成文件列表 */
  generatedFiles?: GeneratedFile[]
  /** 浏览器执行操作记录 */
  browserActions?: Array<{
    action: string
    success: boolean
    url?: string
    title?: string
    screenshot?: string
    durationMs: number
    timestamp: number
  }>
  /**
   * Multimodal sidecar routing snapshot for this turn — written by the backend
   * when the user uploaded an image / video the primary model couldn't handle
   * natively. The chat bubble renders a "primary 🔀 sidecar" badge from this.
   */
  routing?: RoutingMeta
}

export interface RoutingMeta {
  /** "none" | "sidecar" | "native" — lowercased on the wire to keep the JSON small. */
  strategy: 'none' | 'sidecar' | 'native'
  sidecarModelId?: number
  sidecarModel?: string
  sidecarProvider?: string
  /** Modality names like ["VISION"] / ["VIDEO"] / ... — uppercase to match the backend enum. */
  requiredModalities?: string[]
  primaryMissing?: string[]
  skipped?: Array<{ type: string; fileName?: string; reason: string }>
}

export interface AgentCapabilities {
  agentId: number
  modelName: string
  providerId: string
  /** Modality enum values: TEXT / VISION / VIDEO / AUDIO. */
  modalities: string[]
  defaultVisionModelId?: number | null
  defaultVisionModelLabel?: string | null
  defaultVideoModelId?: number | null
  defaultVideoModelLabel?: string | null
}

export interface MessageContentPart {
  type: 'text' | 'thinking' | 'image' | 'file' | 'audio' | 'video' | 'model3d' | 'tool_call' | 'parse_error'
  text?: string
  fileUrl?: string
  fileName?: string
  storedName?: string
  contentType?: string
  fileSize?: number
  path?: string
  /** 前端流式渲染用：已显示的字符数。undefined 表示全部显示。 */
  visibleLength?: number
}

// ==================== 技能 ====================
export interface Skill {
  id: string | number
  /** Slug / immutable identifier */
  name: string
  /** RFC-042 §2.2 — locale display names; null = fall back to `name` */
  nameZh?: string
  nameEn?: string
  description?: string
  skillType: string
  icon?: string
  version?: string
  author?: string
  config?: string
  configJson?: string
  sourceCode?: string
  skillContent?: string
  enabled: boolean
  builtin?: boolean
  tags?: string
  createTime: string
  /** RFC-023: 来源对话 ID（AI 合成时记录） */
  sourceConversationId?: string
  /** RFC-023: 安全扫描状态 (PASSED / FAILED / null) */
  securityScanStatus?: string
  /** RFC-042 §2.3 — JSON-serialised SkillSecurityFinding[] from last scan */
  securityScanResult?: string
  /** RFC-042 §2.3 — wall-clock time of the last scan */
  securityScanTime?: string
  /** Lifecycle curator state: 'active' / 'stale' / 'archived' */
  lifecycleState?: string
  /** User-pinned skill — exempt from automatic archival */
  pinned?: boolean
  /** Last activity timestamp — drives the curator's idle window */
  lastActivityAt?: string
  /** When the curator moved this skill to archived state */
  archivedAt?: string
}

/** 运行时解析状态（来自 /runtime/status） */
export interface SkillRuntimeStatus {
  /** RFC-090 Phase 2 — entity primary key */
  id?: number
  name: string
  description?: string
  source: string  // "directory" | "database"
  configuredSkillDir?: string | null
  skillDirPath?: string | null
  runtimeAvailable: boolean
  resolutionError?: string | null
  references: Record<string, any>
  scripts: Record<string, any>
  enabled: boolean
  icon?: string
  // Security scan fields
  securityBlocked?: boolean
  securitySeverity?: string | null
  securitySummary?: string | null
  securityFindings?: SkillSecurityFinding[]
  securityWarnings?: string[]
  // Dependency check fields
  dependencyReady?: boolean
  missingDependencies?: string[]
  dependencySummary?: string | null
  // Computed label
  runtimeStatusLabel?: string
  // RFC-090 §14.1 — features matrix + manifest SoT
  manifest?: SkillManifest | null
  /** Map<featureId, "READY" | "SETUP_NEEDED" | "UNSUPPORTED"> */
  featureStatuses?: Record<string, string>
  /** featureIds whose status is READY */
  activeFeatures?: string[]
  /** Tools advertised to the LLM after feature filtering */
  effectiveAllowedTools?: string[]
  /** Human-readable tool names for display after feature filtering */
  effectiveAllowedToolsDisplay?: string[]
}

/** RFC-090 §14.6 — typed view onto manifest_json */
export interface SkillManifest {
  id?: string
  name?: string
  description?: string
  icon?: string
  version?: string
  author?: string
  /** prompt | code | mcp | acp | knowledge */
  type?: string
  category?: string
  allowedTools?: string[]
  requires?: SkillManifestRequirement[]
  platforms?: string[]
  features?: SkillManifestFeature[]
  settings?: SkillManifestSetting[]
  requiresModel?: string[]
  dashboardMetrics?: SkillManifestDashboardMetric[]
  selfEvolution?: { lessonsEnabled?: boolean; lessonsMaxEntries?: number; memoryWritesAllowed?: boolean }
  knowledge?: {
    bindKb?: string
    retrieval?: string
    topK?: number
    citation?: string
    rerank?: boolean
    boundKbId?: number | null
  } | null
  extras?: Record<string, any>
}

export interface SkillManifestRequirement {
  key: string
  type?: string
  check?: string
  optional?: boolean
  description?: string
  install?: Record<string, string>
}

export interface SkillManifestFeature {
  id: string
  label?: string
  requires?: string[]
  platforms?: string[]
  tools?: string[]
  fallbackMessage?: string
  unsupportedMessage?: string
}

export interface SkillManifestSetting {
  key: string
  label?: string
  type?: string
  defaultValue?: any
  options?: Record<string, any>[]
}

export interface SkillManifestDashboardMetric {
  label?: string
  memoryKey?: string
  format?: string
}

/** 安全扫描发现 */
export interface SkillSecurityFinding {
  ruleId: string
  severity: string
  category: string
  title: string
  description?: string
  filePath?: string
  lineNumber?: number
  snippet?: string
  remediation?: string
}

// 兼容旧代码
export type SkillEntity = Skill

// ==================== Skill 安装 ====================
export interface InstallRequest {
  bundleUrl: string
  version?: string
  enable?: boolean
  targetName?: string
  overwrite?: boolean
}

export interface InstallTask {
  taskId: string
  bundleUrl: string
  status: 'PENDING' | 'INSTALLING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  error?: string
  result?: InstallResult
  createdAt: string
  updatedAt: string
}

export interface InstallResult {
  name: string
  enabled: boolean
  sourceUrl: string
  sourceType: string
}

export interface HubSkillInfo {
  name: string
  slug: string
  description: string
  author: string
  version: string
  icon?: string
  tags?: string[]
  downloads?: number
  bundleUrl: string
}

// ==================== 工具 ====================
export interface Tool {
  id: string | number
  name: string
  displayName?: string
  description?: string
  beanName?: string
  toolType: string
  /** Runtime @Tool function names shown to the model, when resolvable. */
  runtimeNames?: string[]
  icon?: string
  mcpEndpoint?: string
  paramsSchema?: string
  enabled: boolean
  builtin?: boolean
  /** Progressive-disclosure tier: 'core' | 'extension'. Null/absent = core. */
  disclosureTier?: string
  channelId?: string | number
  createTime: string
}

// ==================== 渠道 ====================
export interface Channel {
  id: string | number
  name: string
  channelType: string
  agentId?: string | number
  botPrefix?: string
  configJson?: string
  /** Identity snapshot from the most recent successful credential verify
   *  (RFC-084). JSON-encoded {accountName, accountId, team, region, ...}. */
  identityJson?: string
  enabled: boolean
  description?: string
  // 前端扩展字段
  icon?: string
  color?: string
  createTime?: string
}

/** 渠道配置字段定义 */
export interface ChannelFieldDef {
  key: string
  label: string
  placeholder: string
  required?: boolean
  sensitive?: boolean
  readOnly?: boolean
  tooltip?: string
  type: 'text' | 'password' | 'select' | 'switch' | 'number'
  options?: { label: string; value: string }[]
  defaultValue?: string | boolean | number
  /** 条件显示：仅当指定字段等于指定值时才显示此字段 */
  showIf?: { field: string; value: string | boolean | number }
}

/** 各渠道的表单字段定义 */
export const CHANNEL_FIELD_DEFS: Record<string, ChannelFieldDef[]> = {
  dingtalk: [
    { key: 'client_id', label: 'AppKey', placeholder: 'dingxxxxxxxx', required: true, type: 'text', tooltip: 'AppKey (Client ID) de la aplicación en la Plataforma Abierta de DingTalk' },
    { key: 'client_secret', label: 'AppSecret', placeholder: 'xxxxxxxxxxxxxxxx', required: true, sensitive: true, type: 'password', tooltip: 'AppSecret de la aplicación en la Plataforma Abierta de DingTalk' },
    { key: 'connection_mode', label: 'Modo de conexión', placeholder: '', type: 'select', defaultValue: 'stream', tooltip: 'Stream (conexión larga) no requiere IP pública (recomendado); Webhook requiere URL de callback pública', options: [{ label: 'Stream (conexión larga, recomendado)', value: 'stream' }, { label: 'Webhook (callback HTTP)', value: 'webhook' }] },
    { key: 'message_type', label: 'Formato de mensaje', placeholder: '', type: 'select', defaultValue: 'markdown', tooltip: 'markdown: mensaje normal; card: tarjeta AI en streaming (requiere ID de plantilla)', options: [{ label: 'Markdown', value: 'markdown' }, { label: 'AI Card (tarjeta streaming)', value: 'card' }] },
    { key: 'card_template_id', label: 'ID de plantilla de tarjeta', placeholder: 'dt_card_1234', required: true, type: 'text', tooltip: 'ID de plantilla de AI Card de DingTalk', showIf: { field: 'message_type', value: 'card' } },
    { key: 'robot_code', label: 'Código del robot', placeholder: 'Vacío usará AppKey automáticamente (robots de apps propias)', type: 'text', tooltip: 'robotCode del robot de DingTalk, usado para enviar adjuntos (imagen / DOCX) y AI Cards. En la mayoría de robots de apps propias robotCode == AppKey; si se deja vacío se usa el fallback. Solo las apps de terceros / robots solicitados por separado deben rellenarlo' },
  ],
  feishu: [
    { key: 'app_id', label: 'App ID', placeholder: 'cli_xxxxxxxx', required: true, type: 'text', tooltip: 'App ID de la aplicación en la Plataforma Abierta de Feishu' },
    { key: 'app_secret', label: 'App Secret', placeholder: 'xxxxxxxxxxxxxxxx', required: true, sensitive: true, type: 'password', tooltip: 'App Secret de la aplicación en la Plataforma Abierta de Feishu' },
    { key: 'connection_mode', label: 'Modo de conexión', placeholder: '', type: 'select', defaultValue: 'websocket', tooltip: 'WebSocket (conexión larga) no requiere IP pública (recomendado; funciona en desarrollo local e intranet); Webhook requiere URL de callback pública', options: [{ label: 'WebSocket (conexión larga, recomendado)', value: 'websocket' }, { label: 'Webhook (callback HTTP)', value: 'webhook' }] },
    { key: 'domain', label: 'Región del servicio', placeholder: '', type: 'select', defaultValue: 'feishu', tooltip: 'La versión de China usa feishu (open.feishu.cn); la internacional usa lark (open.larksuite.com)', options: [{ label: 'Feishu (versión China)', value: 'feishu' }, { label: 'Lark (internacional)', value: 'lark' }] },
    { key: 'verification_token', label: 'Token de verificación', placeholder: 'xxxxxxxx', type: 'text', tooltip: 'Verification Token de la suscripción de eventos', showIf: { field: 'connection_mode', value: 'webhook' } },
    { key: 'encrypt_key', label: 'Clave de cifrado', placeholder: 'Clave de cifrado de eventos (obligatoria en modo webhook)', sensitive: true, type: 'password', tooltip: 'Encrypt Key, usada para descifrar mensajes en callbacks de eventos webhook (obligatoria en modo webhook; si no, el arranque lo rechaza)', showIf: { field: 'connection_mode', value: 'webhook' } },
    { key: 'enable_reaction', label: 'Reacciones a mensajes', placeholder: '', type: 'switch', defaultValue: true, tooltip: 'Añade automáticamente una reacción 👍 al recibir mensajes para que el usuario sepa que llegaron' },
    { key: 'enable_nickname_cache', label: 'Obtener apodos', placeholder: '', type: 'switch', defaultValue: true, tooltip: 'Obtiene el apodo real del usuario vía la API de contactos (requiere permiso contact:user.base:readonly)' },
    { key: 'enable_quoted_context', label: 'Contexto de mensajes citados', placeholder: '', type: 'switch', defaultValue: true, tooltip: 'Cuando el usuario responde citando un mensaje, se inyecta su contenido al prompt para que el agente entienda referencias sin sujeto como «explícamelo»' },
    { key: 'media_download_enabled', label: 'Descarga de medios', placeholder: '', type: 'switch', defaultValue: false, tooltip: 'Descarga imágenes y archivos de los mensajes a local (se guardan en ~/.mateclaw/media/feishu/)' },
    { key: 'card_streaming_enabled', label: 'Tarjetas streaming', placeholder: '', type: 'switch', defaultValue: true, tooltip: 'Usa CardKit para actualizar respuestas en tiempo real; requiere permiso cardkit:card:write' },
    { key: 'stream_progress', label: 'Trazado de ejecución', placeholder: '', type: 'switch', defaultValue: true, tooltip: 'Muestra estado de pensamiento, pasos del plan, progreso de herramientas y narración por etapas en la tarjeta streaming; el pensamiento crudo y los nombres de herramientas siguen controlados por los filtros de abajo' },
  ],
  telegram: [
    { key: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', required: true, sensitive: true, type: 'password', tooltip: 'Bot Token obtenido de @BotFather' },
    { key: 'show_typing', label: 'Mostrar estado de escritura', placeholder: '', type: 'switch', defaultValue: true, tooltip: 'Muestra «escribiendo…» antes de enviar la respuesta (refresco cada 4 s)' },
    { key: 'connection_mode', label: 'Modo de conexión', placeholder: '', type: 'select', defaultValue: 'polling', tooltip: 'Long-Polling no requiere IP pública (recomendado); Webhook requiere URL de callback pública', options: [{ label: 'Long-Polling (sondeo, recomendado)', value: 'polling' }, { label: 'Webhook (callback HTTP)', value: 'webhook' }] },
    { key: 'polling_timeout', label: 'Tiempo de espera de sondeo (s)', placeholder: '20', type: 'number', defaultValue: 20, tooltip: 'Timeout de Long-Polling; el servidor responde de inmediato cuando hay mensajes nuevos', showIf: { field: 'connection_mode', value: 'polling' } },
    { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://your-domain.com/api/v1/channels/webhook/telegram', type: 'text', tooltip: 'URL de callback accesible públicamente; el sistema llama a setWebhook automáticamente', showIf: { field: 'connection_mode', value: 'webhook' } },
    { key: 'http_proxy', label: 'Proxy HTTP', placeholder: 'http://127.0.0.1:7890', type: 'text', tooltip: 'Dirección del proxy HTTP (necesario para acceder a la API de Telegram desde ciertas redes)' },
  ],
  discord: [
    { key: 'bot_token', label: 'Bot Token', placeholder: 'MTxxxxxxxx.xxxxxxxx.xxxxxxxx', required: true, sensitive: true, type: 'password', tooltip: 'Bot Token obtenido del Portal de Desarrolladores de Discord' },
    { key: 'accept_bot_messages', label: 'Recibir mensajes de bots', placeholder: '', type: 'switch', defaultValue: false, tooltip: 'Si se reciben mensajes de otros bots' },
    { key: 'http_proxy', label: 'Proxy HTTP', placeholder: 'http://127.0.0.1:7890', type: 'text', tooltip: 'Dirección del proxy HTTP (opcional, para la conexión Gateway WebSocket y la API REST)' },
  ],
  wecom: [
    { key: 'bot_id', label: 'ID del robot', placeholder: 'bot_xxxxxxxxxx', required: true, type: 'text', tooltip: 'Bot ID del robot inteligente de WeChat Work (se obtiene al crearlo en la consola de WeChat Work)' },
    { key: 'secret', label: 'Secret', placeholder: 'xxxxxxxxxxxxxxxx', required: true, sensitive: true, type: 'password', tooltip: 'Secret del robot inteligente de WeChat Work' },
    { key: 'welcome_text', label: 'Mensaje de bienvenida', placeholder: '¡Hola! Soy tu asistente de IA', type: 'text', tooltip: 'Mensaje de bienvenida enviado automáticamente la primera vez que el usuario inicia una conversación (vacío = no enviar)' },
    { key: 'media_download_enabled', label: 'Descarga de medios', placeholder: '', type: 'switch', defaultValue: false, tooltip: 'Descarga y descifra imágenes y archivos de los mensajes a local (requiere espacio en disco)' },
    { key: 'media_dir', label: 'Directorio de medios', placeholder: 'data/media', type: 'text', tooltip: 'Directorio donde se guardan los archivos multimedia (por defecto data/media)' },
    { key: 'max_reconnect_attempts', label: 'Máx. reintentos de conexión', placeholder: '-1 = reintentos ilimitados', type: 'number', defaultValue: -1, tooltip: 'Máximo de reintentos tras cortarse el WebSocket; -1 = ilimitado' },
  ],
  weixin: [
    { key: 'bot_token', label: 'Bot Token', placeholder: 'Se obtiene automáticamente tras el login por QR', required: true, sensitive: true, type: 'password', tooltip: 'Token del bot iLink de WeChat, obtenido iniciando sesión con el código QR' },
    { key: 'base_url', label: 'URL de la API', placeholder: 'https://ilinkai.weixin.qq.com', type: 'text', defaultValue: 'https://ilinkai.weixin.qq.com', tooltip: 'URL base de la API de iLink Bot (normalmente no requiere cambios)' },
    { key: 'media_download_enabled', label: 'Descarga de medios', placeholder: '', type: 'switch', defaultValue: false, tooltip: 'Descarga y descifra imágenes, archivos y videos de los mensajes a local' },
    { key: 'media_dir', label: 'Directorio de medios', placeholder: 'data/media', type: 'text', tooltip: 'Directorio donde se guardan los archivos multimedia (por defecto data/media)' },
  ],
  qq: [
    { key: 'app_id', label: 'AppID', placeholder: '102xxxxxx', required: true, type: 'text', tooltip: 'AppID del robot de la Plataforma Abierta de QQ' },
    { key: 'client_secret', label: 'AppSecret', placeholder: 'xxxxxxxxxxxxxxxx', required: true, sensitive: true, type: 'password', tooltip: 'AppSecret del robot de la Plataforma Abierta de QQ' },
    { key: 'markdown_enabled', label: 'Mensajes Markdown', placeholder: '', type: 'switch', defaultValue: true, tooltip: 'Envía mensajes en formato Markdown (QQ puede no soportarlo en algunos casos; desactívalo para volver a texto plano)' },
    { key: 'max_reconnect_attempts', label: 'Máx. reintentos de conexión', placeholder: '100', type: 'number', defaultValue: 100, tooltip: 'Máximo de reintentos tras cortarse el WebSocket' },
  ],
  slack: [
    { key: 'bot_token', label: 'Bot Token', placeholder: 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx', required: true, sensitive: true, type: 'password', tooltip: 'Bot User OAuth Token de Slack (en Slack App → OAuth & Permissions)' },
    { key: 'app_token', label: 'App Token', placeholder: 'xapp-xxxxxxxxxxxx', required: true, sensitive: true, type: 'password', tooltip: 'App-Level Token de Slack (requiere scope connections:write; se genera en Slack App → Basic Information → App-Level Tokens)' },
    { key: 'signing_secret', label: 'Signing Secret', placeholder: 'xxxxxxxxxxxxxxxx', sensitive: true, type: 'password', tooltip: 'Signing Secret de la app de Slack (verifica firmas en modo Webhook; opcional en Socket Mode)' },
  ],
  webchat: [
    { key: 'api_key', label: 'API Key', placeholder: 'La genera la plataforma al guardar', required: true, sensitive: true, readOnly: true, type: 'password', tooltip: 'Clave del canal WebChat embebido, generada automáticamente por la plataforma; cópiala tras crearlo' },
    { key: 'title', label: 'Título', placeholder: 'AuraClaw', type: 'text', defaultValue: 'AuraClaw', tooltip: 'Título que se muestra en la parte superior del panel de chat' },
    { key: 'placeholder', label: 'Texto de ejemplo del input', placeholder: 'Type a message...', type: 'text', defaultValue: 'Type a message...', tooltip: 'Texto de ejemplo por defecto del campo de entrada' },
    { key: 'primary_color', label: 'Color del tema', placeholder: '#409eff', type: 'text', defaultValue: '#409eff', tooltip: 'Color principal de burbujas y encabezado del chat; usa un valor hexadecimal' },
    { key: 'welcome_message', label: 'Mensaje de bienvenida', placeholder: 'Hola, ¿en qué puedo ayudarte?', type: 'text', tooltip: 'Mensaje de bienvenida que el SDK del frontend puede leer y mostrar tras inicializarse (principalmente para la API de configuración)' },
    { key: 'allowed_origins', label: 'Dominios de inserción permitidos', placeholder: 'https://example.com, https://app.example.com', type: 'text', tooltip: 'Lista de dominios para la validación de orígenes de inserción; sepáralos con comas' },
  ],
}

// ==================== 流控制 ====================

/** 流阶段（前后端统一命名） */
export type StreamPhase =
  | 'preparing_context' // 正在准备上下文
  | 'reading_memory'    // 正在读取记忆/历史
  | 'reasoning'         // 正在推理分析
  | 'drafting_answer'   // 正在起草答案
  | 'summarizing_observations' // 正在整理工具结果
  | 'thinking'         // 模型推理中
  | 'streaming'        // 正在输出文本
  | 'executing_tool'   // 正在执行工具
  | 'awaiting_approval' // 等待审批
  | 'finalizing'       // 正在收尾
  | 'failed'           // 已失败
  | 'interrupting'     // 正在中断
  | 'queued'           // 有排队消息
  | 'reconnecting'     // 正在重连
  | 'stopped'          // 已停止
  | 'completed'        // 已完成
  | 'idle'             // 空闲

/** 阶段事件数据 */
export interface PhaseEventData {
  phase: StreamPhase | string
  timestamp?: number
  toolName?: string
  toolCount?: number
  observationCount?: number
  summaryChars?: number
  iteration?: number
}

/** 排队的用户消息 */
export interface QueuedMessage {
  /** 消息内容 */
  content: string
  /** 入队时间 */
  enqueuedAt: number
  /** 状态 */
  status: 'queued' | 'sending' | 'cancelled'
  /** 内容块（延迟创建用户消息时使用） */
  contentParts?: MessageContentPart[]
  /** 所属会话 ID */
  conversationId?: string
}

/** 心跳事件数据 */
export interface HeartbeatData {
  conversationId: string
  currentPhase: string
  waitingReason: string
  runningToolName: string
  queueLength: number
  timestamp: number
}

/** 中断响应 */
export interface InterruptResponse {
  interrupted: boolean
  queued: boolean
  reason: string
}

// ==================== 计划 ====================
export interface SubPlan {
  id: string | number
  planId: string | number
  stepIndex: number
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
  startTime?: string
  endTime?: string
  /** Delegated specialist agent for this step (snowflake id — keep as string).
   *  Absent/null means the step runs with the parent (plan) agent. */
  assignedAgentId?: string | number
}

export interface Plan {
  id: string | number
  agentId: string
  /** Conversation/run that produced the plan (may be absent on legacy rows). */
  conversationId?: string
  goal: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  totalSteps: number
  completedSteps: number
  summary?: string
  steps?: SubPlan[]
  createTime: string
}

// ==================== 工作区文件 ====================
export interface WorkspaceFile {
  id: string | number
  agentId: string | number
  filename: string
  content?: string
  fileSize: number
  enabled: boolean
  sortOrder: number
  /** Memory subject for PERSONAL rows ("user:42", "feishu:ou_xxx"); empty/null for shared rows */
  ownerKey?: string | null
  /** Visibility scope: PERSONAL / TEAM / GLOBAL */
  scope?: string
  createTime: string
  updateTime: string
}

// ==================== 通用分页 ====================
export interface PageResult<T> {
  records: T[]
  total: number
  size: number
  current: number
}

// ==================== 模型与设置 ====================
export interface ModelConfig {
  id: string | number
  name: string
  provider: string
  modelName: string
  description?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  enableSearch?: boolean
  searchStrategy?: string
  enabled: boolean
  isDefault: boolean
  createTime?: string
  updateTime?: string
}

export interface SystemSettings {
  language: 'zh-CN' | 'en-US' | 'es-ES'
  streamEnabled: boolean
  debugMode: boolean
  // Whether chat renders the model's reasoning ("thinking") blocks; default true
  showThinking: boolean
  // Whether chat renders every iteration's reasoning or only the span that
  // produced the answer; default true. Only meaningful while showThinking is on.
  thinkingFull: boolean
  // Default workspace storage root; '' = use the server-side default
  workspaceStorageRoot?: string
  // 搜索服务配置
  searchEnabled: boolean
  searchProvider: 'serper' | 'tavily'
  searchFallbackEnabled: boolean
  serperApiKey?: string
  serperBaseUrl: string
  tavilyApiKey?: string
  tavilyBaseUrl: string
  serperApiKeyMasked?: string
  tavilyApiKeyMasked?: string
  weixinoaAppId?: string
  weixinoaAppSecret?: string
  weixinoaAppSecretMasked?: string
  // Keyless 搜索 provider
  duckduckgoEnabled: boolean
  searxngBaseUrl: string
  // 视频生成配置
  videoEnabled?: boolean
  videoProvider?: string
  videoFallbackEnabled?: boolean
  zhipuApiKey?: string
  zhipuBaseUrl?: string
  zhipuApiKeyMasked?: string
  falApiKey?: string
  falApiKeyMasked?: string
  klingAccessKey?: string
  klingSecretKey?: string
  klingAccessKeyMasked?: string
  klingSecretKeyMasked?: string
}

export interface SearchProviderCatalogEntry {
  id: string
  label: string
  builtin: boolean
  requiresCredential: boolean
  available: boolean
  pluginName: string | null
}

export interface SearchProviderCatalog {
  providers: SearchProviderCatalogEntry[]
  resolvedId: string | null
  resolvedSource: string | null
}

export interface ProviderModelInfo {
  id: string
  name: string
  /** Discovery probe result (backend `probeOk` field). True = verified reachable, false = probe failed, undefined = not probed */
  probeOk?: boolean
  /** Short error message when probeOk=false */
  probeError?: string
  /**
   * RFC-049 PR-1-UI (narrow): whether the model accepts the OpenAI
   * `reasoning_effort` parameter. True only for OpenAI reasoning family.
   */
  supportsReasoningEffort?: boolean
  /**
   * RFC-049 PR-1-UI (broad): whether the model supports any form of deep
   * thinking (OpenAI reasoning_effort, Kimi/DeepSeek native thinking,
   * Anthropic extended thinking). This is the field the UI "thinking depth"
   * toggle should gate on.
   */
  supportsThinking?: boolean
  /** Explicit input window in tokens; null/undefined when the operator set none. */
  maxInputTokens?: number | null
  /** Window budgeting would use right now: configured, built-in table, or global default. */
  effectiveMaxInputTokens?: number | null
  /** Where `effectiveMaxInputTokens` comes from. */
  maxInputTokensSource?: 'configured' | 'catalog' | 'default'
}

/**
 * RFC-073: combined runtime state of a provider.
 * - LIVE         pool member, not in cooldown — usable
 * - COOLDOWN     pool member, transient backoff after consecutive failures
 * - REMOVED      probed and HARD-removed (auth/billing/init-probe failure)
 * - UNPROBED     startup window, decision not made yet
 * - UNCONFIGURED user hasn't supplied required credentials
 */
export type Liveness = 'LIVE' | 'COOLDOWN' | 'REMOVED' | 'UNPROBED' | 'UNCONFIGURED'

export interface ProviderInfo {
  id: string
  name: string
  protocol?: string
  apiKeyPrefix?: string
  chatModel?: string
  models: ProviderModelInfo[]
  extraModels: ProviderModelInfo[]
  isCustom: boolean
  isLocal: boolean
  supportModelDiscovery: boolean
  supportConnectionCheck: boolean
  freezeUrl: boolean
  requireApiKey: boolean
  configured: boolean
  available: boolean
  apiKey?: string
  baseUrl?: string
  generateKwargs?: Record<string, unknown>
  authType?: string
  oauthConnected?: boolean
  oauthExpiresAt?: number
  /** RFC-009 P3.5: position in the multi-model failover chain (0 = excluded). */
  fallbackPriority?: number
  /** RFC-073: runtime state — UI source of truth for whether this provider is usable now. */
  liveness?: Liveness
  /** Populated only when liveness ∈ {REMOVED, COOLDOWN}. */
  unavailableReason?: string
  /** Epoch ms of the most recent removal, populated only when liveness == REMOVED. */
  lastProbedAtMs?: number
  /** Remaining cooldown window in ms, populated only when liveness == COOLDOWN. */
  cooldownRemainingMs?: number
  /** RFC-074: whether the user has explicitly opted this provider into the dropdown. */
  enabled?: boolean

  // Issue #81: derived liveness fields powering the chat-console popup state machine.
  /** CONFIGURED / MISSING / NOT_REQUIRED / OAUTH_PENDING. */
  authStatus?: string
  /** null = base url N/A; true/false = applicable and complete/incomplete. */
  baseUrlComplete?: boolean | null
  /** Comma-joined missing field names ("apiKey", "baseUrl"); empty when nothing missing. */
  missingFields?: string
  /**
   * Machine-readable next-step key driving the popup primary button.
   * fill_base_url / fill_api_key / start_oauth / configure_required_fields /
   * test_connection / pull_model / wait_cooldown / reprobe / none.
   */
  suggestedAction?: string
  /** i18n key for the actionable hint, e.g. "provider.hint.llamacppBaseUrlExample". */
  suggestedActionHintKey?: string | null
  /** Template params for vue-i18n t(key, args). */
  suggestedActionHintArgs?: Record<string, unknown>
}

/**
 * RFC-074: response payload from POST /models/{id}/enable | disable.
 * Frontend reads this to decide whether to fire a "switched default to X" toast.
 */
export interface EnableResult {
  defaultSwitched: boolean
  newDefaultProviderId?: string | null
  newDefaultModel?: string | null
}

export interface ActiveModelsInfo {
  activeLlm?: {
    providerId: string
    model: string
  }
}

export interface DiscoverResult {
  discoveredModels: ProviderModelInfo[]
  newModels: ProviderModelInfo[]
  totalDiscovered: number
  newCount: number
}

export interface TestResult {
  success: boolean
  latencyMs: number
  message?: string
  errorMessage?: string
}

// ==================== 安全 ====================

export type GuardSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
export type GuardCategory =
  | 'COMMAND_INJECTION'
  | 'DATA_EXFILTRATION'
  | 'PATH_TRAVERSAL'
  | 'SENSITIVE_FILE_ACCESS'
  | 'NETWORK_ABUSE'
  | 'CREDENTIAL_EXPOSURE'
  | 'RESOURCE_ABUSE'
  | 'CODE_EXECUTION'
  | 'PRIVILEGE_ESCALATION'
export type GuardDecision = 'ALLOW' | 'NEEDS_APPROVAL' | 'BLOCK'

export interface GuardFinding {
  ruleId: string
  severity: GuardSeverity
  category: GuardCategory
  title: string
  description?: string
  remediation?: string
  toolName?: string
  paramName?: string
  matchedPattern?: string
  snippet?: string
}

export interface GuardRule {
  id: string | number
  ruleId: string
  name: string
  description?: string
  toolName?: string
  paramName?: string
  category: string
  severity: string
  decision: string
  pattern: string
  excludePattern?: string
  remediation?: string
  builtin: boolean
  enabled: boolean
  priority: number
  createTime?: string
  updateTime?: string
}

export interface GuardConfig {
  id: string | number
  enabled: boolean
  guardScope: string
  guardedToolsJson?: string
  deniedToolsJson?: string
  fileGuardEnabled: boolean
  sensitivePathsJson?: string
  auditEnabled?: boolean
  auditMinSeverity?: string
  auditRetentionDays?: number
}

export interface AuditLogEntry {
  id: string | number
  conversationId?: string
  agentId?: string
  userId?: string
  channelType?: string
  toolName: string
  toolParamsJson?: string
  decision: string
  maxSeverity?: string
  findingsJson?: string
  pendingId?: string
  createTime: string
}

export interface AuditStats {
  total: number
  blocked: number
  needsApproval: number
  allowed: number
}

// ==================== 定时任务 ====================
export interface CronJob {
  id: string | number
  name: string
  cronExpression: string
  timezone: string
  agentId: string | number | null
  agentName?: string
  taskType: 'text' | 'agent' | 'reminder' | 'wiki_process'
  triggerMessage?: string
  requestBody?: string
  enabled: boolean
  nextRunTime?: string
  lastRunTime?: string
  createTime?: string
  updateTime?: string
  // RFC-063r §2.9 / §2.14: channel binding + most-recent delivery snapshot.
  // channelId / deliveryConfig: round-trippable on create/update.
  // lastDeliveryStatus / lastDeliveryError: read-only, populated by
  // selectListWithDeliveryStatus / selectByIdWithDeliveryStatus on the backend.
  // Runtime is always a string (global Long→String serialization); keep the
  // union so pre-existing number literals in callers still type-check.
  channelId?: string | number | null
  channelName?: string | null
  deliveryConfig?: {
    targetId?: string | null
    threadId?: string | null
    accountId?: string | null
    /** IM senderId of the delivery target user — used for session matching. */
    userId?: string | null
    /** True = run the job but don't push the result to the channel. */
    suppressAgentReply?: boolean | null
  } | null
  lastDeliveryStatus?: 'NONE' | 'PENDING' | 'DELIVERED' | 'NOT_DELIVERED'
  lastDeliveryError?: string | null
}

// ==================== Approval Auto-Grant ====================

export type GrantScope = 'USER' | 'AGENT' | 'CONVERSATION' | 'WORKSPACE'
export type GrantKind = 'ALWAYS' | 'UNTIL_TIMESTAMP' | 'UNTIL_CONVERSATION_END'
export type GrantSeverity = 'LOW' | 'MEDIUM' | 'HIGH'
export type ResolutionDecisionSource = 'USER_MANUAL' | 'AUTO_GRANT' | 'HARD_BLOCK' | 'TIMEOUT'

/**
 * A user-authorized rule that lets ApprovalGrantResolver skip the manual
 * approval step for matching tool calls. All snowflake-typed fields are
 * strings end-to-end per CLAUDE.md precision convention.
 */
export interface ApprovalGrant {
  id: string
  workspaceId: string
  scopeType: GrantScope
  scopeId: string
  toolName: string | null
  ruleId: string | null
  maxSeverity: GrantSeverity
  grantKind: GrantKind
  expireAt: string | null
  grantedBy: string
  /** Display name (nickname → username) of the granter; null if the user was deleted. */
  grantedByName?: string | null
  grantedAt: string
  revoked: number
  revokedBy: string | null
  revokedAt: string | null
  note: string | null
}

/** Active-grant summary for the global chip + ChatInput pill counters. */
export interface ActiveGrantsSummary {
  count: number
  hasWorkspaceWide: boolean
}

/**
 * Paged response shape from /approval/grants. Mirrors the MyBatis Plus
 * {@code IPage} JSON layout already used by skills and other paged endpoints in
 * mateclaw. {@code total/size/current/pages} arrive as JSON strings because the
 * global Long→String serializer catches them; the consumer coerces via
 * {@code Number(...)} at the use site so the el-pagination component gets numbers.
 */
export interface ApprovalGrantPage {
  records: ApprovalGrant[]
  total: number | string
  size: number | string
  current: number | string
  pages: number | string
}

/**
 * Approval-layer final decision row. workspaceId can be null for HARD_BLOCK
 * events that fired before workspace resolution.
 */
export interface ResolutionLog {
  id: string
  workspaceId: string | null
  conversationId: string | null
  agentId: string | null
  userId: string | null
  toolCallId: string | null
  toolName: string
  maxSeverity: GrantSeverity | null
  ruleIds: string | null
  decisionSource: ResolutionDecisionSource
  grantId: string | null
  pendingId: string | null
  argsPreview: string | null
  note: string | null
  createTime: string
}

/** Payload for POST /approval/grants. */
export interface CreateGrantPayload {
  scopeType: GrantScope
  scopeId: string
  toolName?: string | null
  ruleId?: string | null
  maxSeverity: GrantSeverity
  grantKind: GrantKind
  expireAt?: string | null
  note?: string | null
  /** Required when scope+toolName combination is admin+password (see §2.4.5). */
  password?: string
}
