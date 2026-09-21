import { describe, expect, it } from 'vitest'
import {
  citedFileIds,
  classifyFile,
  collectConversationFileTurns,
  fileExtension,
  generatedFileId,
  isDeliveryTool,
  looksLikeScratch,
  summarizeConversationFiles,
} from '../conversationFiles'
import type { Message } from '@/types'

/**
 * Fixtures mirror real conversations from our own deployment (read from
 * `mate_message.metadata->generatedFiles`), especially the noisy case: a
 * "PDF report with charts" turn that produced 19 entries of which only one was
 * the actual deliverable.
 */

const URL_BASE = '/api/v1/files/generated/'

/**
 * Fixed clock: `collectConversationFileTurns` derives the expiry label from the
 * turn timestamp, so tests must not depend on the day they run.
 */
const NOW = Date.parse('2026-09-21T15:00:00')
const DAY_MS = 24 * 60 * 60 * 1000

function file(filename: string, id: string, toolName?: string) {
  return { filename, url: `${URL_BASE}${id}`, toolName }
}

function message(partial: Partial<Omit<Message, 'metadata'>> & { metadata?: any }): Message {
  return {
    id: partial.id ?? 1,
    conversationId: 'c1',
    role: 'assistant',
    content: '',
    contentParts: [],
    ...partial,
  } as Message
}

describe('generated-file helpers', () => {
  it('extracts the file id from relative and absolute download URLs', () => {
    expect(generatedFileId('/api/v1/files/generated/abc-123')).toBe('abc-123')
    expect(generatedFileId('http://host:18088/api/v1/files/generated/abc-123?a=1')).toBe('abc-123')
    expect(generatedFileId('/api/v1/files/other/abc')).toBeUndefined()
    expect(generatedFileId(undefined)).toBeUndefined()
  })

  it('collects ids cited as markdown links or bare URLs', () => {
    const content = [
      'Listo: [Informe.pdf](/api/v1/files/generated/id-1)',
      'y también http://host/api/v1/files/generated/id-2 aquí',
      'repetido /api/v1/files/generated/id-1',
    ].join('\n')
    expect([...citedFileIds(content)].sort()).toEqual(['id-1', 'id-2'])
    expect(citedFileIds('').size).toBe(0)
    expect(citedFileIds(undefined).size).toBe(0)
  })

  it('recognises delivery tools regardless of naming style', () => {
    for (const tool of [
      'send_file', 'renderPdf', 'renderPdfFromFile', 'renderDocx', 'renderDocxFromFiles',
      'render_xlsx', 'render_pptx', 'render_html_image', 'office_document',
      'gzh_package', 'xhs_publish', 'capture_screenshot',
    ]) {
      expect(isDeliveryTool(tool), tool).toBe(true)
    }
    for (const tool of ['execute_code', 'execute_shell_command', undefined, '']) {
      expect(isDeliveryTool(tool), String(tool)).toBe(false)
    }
  })

  it('detects scratch names but not real deliverables', () => {
    expect(looksLikeScratch('TEST_pdf_b64.pdf')).toBe(true)
    expect(looksLikeScratch('test_local.md')).toBe(true)
    expect(looksLikeScratch('tmp_out.csv')).toBe(true)
    expect(looksLikeScratch('informe_v2_test.pdf')).toBe(true)
    expect(looksLikeScratch('Informe_Ventas_NEOGAS_2026-09-13_con_graficas.pdf')).toBe(false)
    expect(looksLikeScratch('g4_surtidor.png')).toBe(false)
  })

  it('classifies with the documented rule order', () => {
    const cited = citedFileIds('[x](/api/v1/files/generated/c-id)')
    // 1. cited wins even when the tool is a script runner (real case: a PDF
    //    produced by execute_code and then echoed in the answer).
    expect(classifyFile(file('informe.pdf', 'c-id', 'execute_code'), cited))
      .toEqual({ isPrimary: true, reason: 'cited' })
    // 2. delivery tool, even without a citation and without a document extension.
    expect(classifyFile(file('poster.png', 'p-id', 'render_html_image'), cited))
      .toEqual({ isPrimary: true, reason: 'delivery-tool' })
    // 3. document extension, but not for scratch names.
    expect(classifyFile(file('report.xlsx', 'd-id', 'execute_code'), cited))
      .toEqual({ isPrimary: true, reason: 'document-ext' })
    expect(classifyFile(file('TEST_pdf_b64.pdf', 's-id', 'execute_code'), cited))
      .toEqual({ isPrimary: false, reason: 'auxiliary' })
    // 4. everything else is an intermediate.
    for (const name of ['g1_kpi.png', 'palette.json', 'chart.html', 'informe_final.md']) {
      expect(classifyFile(file(name, 'a-id', 'execute_code'), cited).isPrimary, name).toBe(false)
    }
  })

  it('exposes the extension helper', () => {
    expect(fileExtension('Informe.PDF')).toBe('pdf')
    expect(fileExtension('no-extension')).toBe('')
  })
})

describe('collectConversationFileTurns', () => {
  /** Turn A: 19 entries, the deliverable cited, the same PDF in 3 versions. */
  function noisyTurn(): Message {
    const charts = ['g1_kpi', 'g2_grado', 'g3_pago', 'g4_surtidor', 'g5_usuario', 'g6_hora', 'g7_turno', 'g8_clientes']
      .map((name, i) => file(`${name}.png`, `png-${i}`, 'execute_code'))
    const scratch = [
      file('test_local.md', 's1', 'execute_code'),
      file('test_abs.md', 's2', 'execute_code'),
      file('TEST_pdf_local.pdf', 's3', 'execute_code'),
      file('test_b64.md', 's4', 'execute_code'),
      file('test_html.md', 's5', 'execute_code'),
      file('TEST_pdf_b64.pdf', 's6', 'execute_code'),
      file('TEST_pdf_html.pdf', 's7', 'execute_code'),
    ]
    const finalName = 'Informe_Ventas_NEOGAS_2026-09-13_con_graficas.pdf'
    const versions = [
      file(finalName, 'pdf-old', 'execute_code'),
      file(finalName, 'pdf-mid', 'renderPdfFromFile'),
      file(finalName, 'pdf-cited', 'send_file'),
    ]
    return message({
      id: 741,
      createTime: '2026-09-21T14:32:00',
      // The cited version is intentionally NOT the first one.
      content: `Aquí tienes el informe: [${finalName}](/api/v1/files/generated/pdf-cited)`,
      metadata: {
        generatedFiles: [
          ...charts, ...scratch, file('informe_final.md', 'md-1', 'execute_code'), ...versions,
        ],
      },
    })
  }

  it('keeps one row per filename, merges versions and promotes the cited one', () => {
    const [turn] = collectConversationFileTurns([noisyTurn()], NOW)

    expect(turn.primary).toHaveLength(1)
    const deliverable = turn.primary[0]
    expect(deliverable.name).toBe('Informe_Ventas_NEOGAS_2026-09-13_con_graficas.pdf')
    expect(deliverable.reason).toBe('cited')
    // The row must link to the cited version, not to the first one seen.
    expect(deliverable.url).toBe(`${URL_BASE}pdf-cited`)
    expect(deliverable.versions).toHaveLength(3)

    // 19 entries collapse to 17 rows: 8 charts + 7 scratch + informe_final.md + 1 PDF.
    expect(turn.auxiliary).toHaveLength(16)
    expect(summarizeConversationFiles([turn])).toEqual({ primary: 1, auxiliary: 16, expired: 0, total: 17 })
  })

  it('classifies a render-tool image as a deliverable and keeps the intermediates', () => {
    // Turn B from real data: 7 intermediate HTML + palette.json (execute_code)
    // and 3 PNG rendered by render_html_image, with nothing cited in the answer.
    const turn = message({
      id: 321,
      createTime: '2026-09-21T13:10:00',
      content: 'Listo.',
      metadata: {
        generatedFiles: [
          ...['g2_grado', 'g3_pago', 'g4_surtidor', 'g5_usuario', 'g6_hora', 'g7_turno', 'g8_clientes']
            .map((n, i) => file(`${n}.html`, `html-${i}`, 'execute_code')),
          file('palette.json', 'pal', 'execute_code'),
          ...['v2_g8_clientes', 'v2_g4_surtidor', 'v2_g7_turno']
            .map((n, i) => file(`${n}.png`, `v2-${i}`, 'render_html_image')),
        ],
      },
    })
    const [grouped] = collectConversationFileTurns([turn], NOW)
    expect(grouped.primary.map(f => f.name).sort()).toEqual([
      'v2_g4_surtidor.png', 'v2_g7_turno.png', 'v2_g8_clientes.png',
    ])
    expect(grouped.primary.every(f => f.reason === 'delivery-tool')).toBe(true)
    expect(grouped.auxiliary).toHaveLength(8)
  })

  it('falls back to showing every file when a turn has no deliverable', () => {
    // Turn with nothing cited and no delivery tool: charts written by code.
    const turn = message({
      id: 500,
      content: 'He generado los gráficos.',
      metadata: {
        generatedFiles: [
          file('chart.png', 'f1', 'execute_code'),
          file('out.html', 'f2', 'execute_code'),
          file('data.json', 'f3', 'execute_code'),
          file('notes.txt', 'f4', 'execute_code'),
        ],
      },
    })
    const [grouped] = collectConversationFileTurns([turn], NOW)
    expect(grouped.primary).toHaveLength(4)
    expect(grouped.primary.every(f => f.reason === 'fallback')).toBe(true)
    expect(grouped.auxiliary).toHaveLength(0)
  })

  it('merges duplicate names across tools and orders turns newest first', () => {
    const older = message({
      id: 100,
      createTime: '2026-09-20T09:00:00',
      content: 'ok',
      metadata: {
        generatedFiles: [
          file('Informe.pdf', 'a1', 'execute_code'),
          file('Informe.pdf', 'a2', 'send_file'),
        ],
      },
    })
    const newer = message({
      id: 200,
      createTime: '2026-09-21T09:00:00',
      content: 'ok',
      metadata: {
        generatedFiles: [file('resumen.docx', 'b1', 'renderDocx')],
      },
    })

    const turns = collectConversationFileTurns([older, newer], NOW)
    expect(turns.map(t => t.messageId)).toEqual([200, 100])
    expect(turns[0].createdAt).toBe('2026-09-21T09:00:00')
    expect(turns[1].primary).toHaveLength(1)
    expect(turns[1].primary[0].versions).toEqual([
      `${URL_BASE}a1`, `${URL_BASE}a2`,
    ])
    expect(turns[0].primary[0].reason).toBe('delivery-tool')
  })

  it('labels files past the server TTL as expired, and only those', () => {
    const stale = message({
      id: 900,
      createTime: new Date(NOW - 8 * DAY_MS).toISOString(),
      content: 'ok',
      metadata: { generatedFiles: [file('viejo.pdf', 'old-1', 'send_file')] },
    })
    const fresh = message({
      id: 901,
      createTime: new Date(NOW - 6 * DAY_MS).toISOString(),
      content: 'ok',
      metadata: { generatedFiles: [file('nuevo.pdf', 'new-1', 'send_file')] },
    })
    const undated = message({
      id: 902,
      content: 'ok',
      metadata: { generatedFiles: [file('sin-fecha.pdf', 'n-1', 'send_file')] },
    })

    const turns = collectConversationFileTurns([stale, fresh, undated], NOW)
    const byId = new Map(turns.map(t => [t.messageId, t.primary[0]]))
    expect(byId.get(900)?.expired).toBe(true)
    expect(byId.get(901)?.expired).toBe(false)
    // No timestamp => no guess (never claim a live file is gone).
    expect(byId.get(902)?.expired).toBe(false)

    expect(summarizeConversationFiles(turns)).toEqual({
      primary: 3, auxiliary: 0, expired: 1, total: 3,
    })
  })

  it('ignores messages without files and tolerates malformed entries', () => {
    const turns = collectConversationFileTurns([
      message({ id: 1, content: 'hola' }),
      message({ id: 2, content: 'sin metadata' }),
      message({ id: 3, metadata: { generatedFiles: [] } }),
      message({
        id: 4,
        content: 'raro',
        metadata: { generatedFiles: [{ filename: 'sin-url.pdf' }, { url: `${URL_BASE}ok-id` }] },
      }),
    ], NOW)
    expect(turns).toHaveLength(1)
    // `sin-url.pdf` carries no URL, so it is skipped entirely.
    expect(turns[0].primary).toHaveLength(1)
    expect(turns[0].primary[0].name).toBe('ok-id')
    expect(collectConversationFileTurns([], NOW)).toEqual([])
    expect(collectConversationFileTurns(undefined as unknown as Message[], NOW)).toEqual([])
  })
})
