package vip.mate.tool.builtin;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Fallback docs es→en: si un slug no existe en {@code docs/es/}, se sirve la
 * versión de {@code docs/en/} (read) y se lista marcado como fallback (list).
 * Los fixtures viven en src/test/resources/docs/{en,es}/zz-*.md.
 */
class MateClawDocServiceTest {

    private final MateClawDocService service = new MateClawDocService();

    @Test
    void read_falls_back_to_english_when_es_missing() {
        String body = service.read("es", "zz-fallback-only");
        assertNotNull(body);
        assertTrue(body.contains("Contenido en inglés"), "debe servir la versión en inglés");
        assertFalse(body.contains("---"), "el frontmatter debe estar pelado");
        assertFalse(body.contains("title:"), "el frontmatter debe estar pelado");
    }

    @Test
    void read_serves_es_when_slug_exists_in_es() {
        String body = service.read("es", "zz-es-only");
        assertNotNull(body);
        assertTrue(body.contains("Contenido en español"));
    }

    @Test
    void read_does_not_fall_back_for_zh_or_en() {
        // zh: sin fallback — el slug solo existe en en/, así que debe devolver null.
        assertNull(service.read("zh", "zz-fallback-only"));
        // en: ya es el idioma base.
        assertNull(service.read("en", "zz-fallback-only-missing"));
    }

    @Test
    void read_rejects_invalid_lang_or_slug() {
        assertNull(service.read(null, "zz-fallback-only"));
        assertNull(service.read("fr", "zz-fallback-only"));
        assertNull(service.read("es", "../secret"));
        assertNull(service.read("es", "no-such-slug"));
    }

    @Test
    void list_marks_es_fallback_slugs() {
        List<MateClawDocService.DocMeta> docs = service.list("es");
        MateClawDocService.DocMeta fallback = docs.stream()
                .filter(d -> "zz-fallback-only".equals(d.slug()))
                .findFirst()
                .orElse(null);
        assertNotNull(fallback, "el slug en-only debe listarse en es");
        assertTrue(fallback.fallback(), "debe marcarse como fallback");
        assertEquals("Fallback Doc EN", fallback.title(), "el título se resuelve desde el doc en");
        assertFalse(fallback.group().isBlank());

        MateClawDocService.DocMeta esOnly = docs.stream()
                .filter(d -> "zz-es-only".equals(d.slug()))
                .findFirst()
                .orElse(null);
        assertNotNull(esOnly);
        assertFalse(esOnly.fallback(), "el slug nativo de es no debe marcarse como fallback");
    }

    @Test
    void list_zh_does_not_include_en_only_slugs() {
        List<MateClawDocService.DocMeta> docs = service.list("zh");
        assertTrue(docs.stream().noneMatch(d -> "zz-fallback-only".equals(d.slug())),
                "zh no tiene fallback: el slug en-only no debe listarse");
    }
}
