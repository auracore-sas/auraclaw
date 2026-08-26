package vip.mate.channel.media;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * V902: Telegram (ni Markdown legacy ni MarkdownV2) soporta tablas markdown —
 * se muestran desalineadas o como texto plano con pipes. La solución es
 * convertir las tablas a un bloque de código monospace con columnas
 * alineadas: Telegram sí renderiza {@code ```code fences```} en monospace,
 * así que las columnas quedan perfectamente alineadas.
 *
 * <p>Detección conservadora: solo se convierten runs de líneas que empiezan
 * con {@code |} cuya segunda línea es el separador markdown ({@code |---|---|})
 * — un párrafo de prosa con pipes sueltos no se toca.
 *
 * <p>Reutilizable por otros canales IM sin soporte de tablas (qq / slack /
 * discord / weixin…).
 */
public final class MarkdownTableFormatter {

    private MarkdownTableFormatter() {
    }

    /** Línea separadora markdown: solo {@code -}, {@code :}, espacios y pipes. */
    private static final Pattern SEPARATOR_LINE = Pattern.compile(
            "^\\s*\\|?[\\s:|-]*\\|?\\s*$");

    /** Pipe no escapado (para dividir celdas; {@code \|} es literal). */
    private static final Pattern PIPE_SPLIT = Pattern.compile("(?<!\\\\)\\|");

    /** Marcado inline dentro de las celdas (se limpia para monospace limpio). */
    private static final Pattern INLINE_MD = Pattern.compile(
            "\\*\\*(.+?)\\*\\*|`(.+?)`|\\[([^\\]]+)\\]\\([^)]*\\)|_(.+?)_");

    /**
     * Formatea las tablas markdown de {@code text} como bloques monospace.
     * Devuelve el texto sin cambios cuando no hay tablas detectables.
     */
    public static String format(String text) {
        if (text == null || text.isBlank() || !text.contains("|")) {
            return text;
        }
        String[] lines = text.split("\n", -1);
        StringBuilder out = new StringBuilder(text.length() + 64);
        int i = 0;
        while (i < lines.length) {
            // ¿Empieza un run de tabla aquí? Línea actual con pipes y, si
            // existe, la siguiente es el separador markdown.
            if (isTableStart(lines, i)) {
                int end = i;
                while (end < lines.length && looksLikeTableRow(lines[end])) {
                    end++;
                }
                // Reclasificar: la línea actual + todas las del run; la
                // segunda línea del run debe ser separador (ya validado).
                out.append(renderTable(lines, i, end));
                i = end;
            } else {
                out.append(lines[i]);
                i++;
            }
            if (i < lines.length) {
                out.append('\n');
            }
        }
        return out.toString();
    }

    /** La línea {@code i} abre una tabla: es fila y la siguiente es separador. */
    private static boolean isTableStart(String[] lines, int i) {
        if (!looksLikeTableRow(lines[i])) {
            return false;
        }
        return i + 1 < lines.length && isSeparator(lines[i + 1]);
    }

    /** Fila de tabla candidata: empieza con {@code |} (tras espacios). */
    private static boolean looksLikeTableRow(String line) {
        String t = line.trim();
        return t.startsWith("|") && t.contains("|");
    }

    /** Separador markdown ({@code |---|---|}, {@code | :-- |}…). */
    static boolean isSeparator(String line) {
        String t = line.trim();
        if (!t.contains("|") || !t.contains("-")) {
            return false;
        }
        String stripped = t.replace("|", "").replace("-", "").replace(":", "").trim();
        return stripped.isEmpty() && SEPARATOR_LINE.matcher(t).matches();
    }

    /** Renderiza el run [start, end) como bloque monospace alineado. */
    private static String renderTable(String[] lines, int start, int end) {
        List<List<String>> rows = new ArrayList<>();
        for (int r = start; r < end; r++) {
            if (isSeparator(lines[r])) {
                continue; // no es fila de datos
            }
            rows.add(splitCells(lines[r]));
        }
        if (rows.isEmpty()) {
            // Sin filas de datos: devolver las líneas originales sin tocar.
            StringBuilder raw = new StringBuilder();
            for (int r = start; r < end; r++) {
                if (r > start) raw.append('\n');
                raw.append(lines[r]);
            }
            return raw.toString();
        }
        int cols = rows.stream().mapToInt(List::size).max().orElse(0);
        // Ancho por columna (máximo de las celdas, incluyendo el header).
        int[] widths = new int[cols];
        for (List<String> row : rows) {
            for (int c = 0; c < row.size() && c < cols; c++) {
                widths[c] = Math.max(widths[c], row.get(c).length());
            }
        }
        StringBuilder sb = new StringBuilder();
        sb.append("```\n");
        for (int r = 0; r < rows.size(); r++) {
            List<String> row = rows.get(r);
            // Separador visual entre header y cuerpo (estilo markdown).
            if (r == 1) {
                sb.append(rowLine(dashRow(widths), widths, false));
                sb.append('\n');
            }
            sb.append(rowLine(row, widths, true));
            if (r < rows.size() - 1) {
                sb.append('\n');
            }
        }
        sb.append("\n```");
        return sb.toString();
    }

    /** Una línea de la tabla renderizada con celdas alineadas. */
    private static String rowLine(List<String> row, int[] widths, boolean pad) {
        StringBuilder sb = new StringBuilder("| ");
        for (int c = 0; c < widths.length; c++) {
            String cell = c < row.size() ? row.get(c) : "";
            sb.append(pad ? padRight(cell, widths[c]) : cell);
            if (c < widths.length - 1) {
                sb.append(" | ");
            }
        }
        return sb.append(" |").toString();
    }

    private static List<String> dashRow(int[] widths) {
        List<String> dashes = new ArrayList<>(widths.length);
        for (int w : widths) {
            dashes.add("-".repeat(Math.max(1, w)));
        }
        return dashes;
    }

    private static String padRight(String s, int width) {
        int diff = width - s.length();
        return diff > 0 ? s + " ".repeat(diff) : s;
    }

    /**
     * Divide una línea de tabla en celdas: quita los pipes externos, parte
     * por pipes no escapados, desescapa {@code \|} y limpia el marcado
     * inline (negritas / código / links / itálicas → texto plano).
     */
    static List<String> splitCells(String line) {
        String t = line.trim();
        if (t.startsWith("|")) t = t.substring(1);
        if (t.endsWith("|") && !t.endsWith("\\|")) t = t.substring(0, t.length() - 1);
        String[] raw = PIPE_SPLIT.split(t);
        List<String> cells = new ArrayList<>(raw.length);
        for (String cell : raw) {
            cells.add(cleanCell(cell));
        }
        return cells;
    }

    static String cleanCell(String cell) {
        String c = cell.trim().replace("\\|", "|");
        return INLINE_MD.matcher(c).replaceAll(m -> {
            for (int g = 1; g <= 4; g++) {
                String v = m.group(g);
                if (v != null) return v;
            }
            return m.group(0);
        });
    }
}
