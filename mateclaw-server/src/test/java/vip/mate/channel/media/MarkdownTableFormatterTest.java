package vip.mate.channel.media;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V902: Telegram no soporta tablas markdown — el formateador las convierte
 * en bloques monospace alineados (dentro de un code fence ```, que Telegram
 * sí renderiza en monospace).
 */
class MarkdownTableFormatterTest {

    @Test
    @DisplayName("tabla markdown básica → bloque monospace alineado")
    void basicTableBecomesMonospaceBlock() {
        String in = "| Tipo | Cantidad | % |\n|---|---|---|\n| RUC | 22 | 95.7% |\n| Cédula | 1 | 4.3% |";
        String out = MarkdownTableFormatter.format(in);

        assertThat(out).startsWith("```\n");
        assertThat(out).endsWith("```");
        // Header + separador visual + filas alineadas por columna
        assertThat(out).contains("| Tipo   | Cantidad | %     |");
        assertThat(out).contains("| ------ | -------- | ----- |");
        assertThat(out).contains("| RUC    | 22       | 95.7% |");
        assertThat(out).contains("| Cédula | 1        | 4.3%  |");
    }

    @Test
    @DisplayName("columnas con anchos distintos → alineadas (padding)")
    void columnsArePadded() {
        String in = "| A | B |\n|---|---|\n| x | muy larga |";
        String out = MarkdownTableFormatter.format(in);

        // Columna B domina el ancho; la A se alinea por su propio ancho
        assertThat(out).contains("| A | B         |");
        assertThat(out).contains("| x | muy larga |");
    }

    @Test
    @DisplayName("marcado inline dentro de celdas → texto plano limpio")
    void inlineMarkdownStrippedFromCells() {
        String in = "| **Nombre** | `code` |\n|---|---|\n| [link](http://x) | _itálica_ |";
        String out = MarkdownTableFormatter.format(in);

        assertThat(out)
                .contains("| Nombre | code    |")
                .contains("| link   | itálica |")
                .doesNotContain("**").doesNotContain("[link](").doesNotContain("`code`");
    }

    @Test
    @DisplayName("pipe escapado dentro de celda → literal")
    void escapedPipeStaysLiteral() {
        String in = "| A | B |\n|---|---|\n| a \\| b | c |";
        String out = MarkdownTableFormatter.format(in);

        assertThat(out).contains("| a | b | c |");
    }

    @Test
    @DisplayName("texto sin tablas → sin cambios")
    void plainTextUntouched() {
        String in = "Hola, esto es texto normal sin pipes | sueltos";
        assertThat(MarkdownTableFormatter.format(in)).isEqualTo(in);
    }

    @Test
    @DisplayName("prosa con pipes sueltos sin separador → no se toca")
    void proseWithLoosePipesUntouched() {
        String in = "a | b\nc | d";
        // Sin línea separadora markdown → no es tabla → intacto.
        assertThat(MarkdownTableFormatter.format(in)).isEqualTo(in);
    }

    @Test
    @DisplayName("múltiples tablas en un mismo texto → todas convertidas")
    void multipleTablesConverted() {
        String in = "Primera:\n| X |\n|---|\n| 1 |\n\nSegunda:\n| Y |\n|---|\n| 2 |";
        String out = MarkdownTableFormatter.format(in);

        assertThat(out).contains("Primera:").contains("Segunda:");
        assertThat(out).contains("```\n| X |\n| - |\n| 1 |\n```");
        assertThat(out).contains("```\n| Y |\n| - |\n| 2 |\n```");
    }

    @Test
    @DisplayName("null / vacío → sin cambios")
    void nullAndEmptyUntouched() {
        assertThat(MarkdownTableFormatter.format(null)).isNull();
        assertThat(MarkdownTableFormatter.format("")).isEmpty();
    }

    @Test
    @DisplayName("tabla demasiado ancha → lista de viñetas legible en celular")
    void wideTableCollapsesToBullets() {
        String in = "| Tipo de identificación | Cantidad | % |\n|---|---|---|\n"
                + "| 🔶 RUC (Registro Único de Contribuyentes) | 22 | 95.7% |\n"
                + "| 🔷 Cédula de Identidad | 1 | 4.3% |";
        String out = MarkdownTableFormatter.format(in);

        // Colapsa a bullets con la etiqueta + resto separado por " · "
        assertThat(out).startsWith("• 🔶 RUC (Registr…");
        assertThat(out).contains("• 🔷 Cédula de Id…: 1 · 4.3%");
        assertThat(out).doesNotContain("```");
    }

    @Test
    @DisplayName("celdas muy largas en tabla angosta → truncadas con …")
    void longCellsTruncated() {
        String in = "| Nombre |\n|---|\n| Una descripción extremadamente larga aquí |";
        String out = MarkdownTableFormatter.format(in);

        assertThat(out).startsWith("```");
        assertThat(out).contains("…");
        assertThat(out).doesNotContain("extremadamente larga aquí");
    }

    @Test
    @DisplayName("separador con dos puntos (alineación) → detectado")
    void alignmentSeparatorDetected() {
        String in = "| A | B |\n|:--|--:|\n| 1 | 2 |";
        String out = MarkdownTableFormatter.format(in);
        assertThat(out).startsWith("```");
        assertThat(out).contains("| 1 | 2 |");
    }
}
