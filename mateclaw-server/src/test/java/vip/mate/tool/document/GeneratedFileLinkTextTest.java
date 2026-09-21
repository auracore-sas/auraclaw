package vip.mate.tool.document;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pins what the MODEL is told about a generated artifact, because that wording is
 * what ends up in the user's answer.
 *
 * <p>Reported from a real session: the assistant replied with a correct markdown
 * image, saw nothing rendered, and then speculated in the chat about
 * `localhost`, about the user "being on the wrong machine" and about the platform
 * having "broken the file endpoint". None of that was true — the file was alive
 * and the renderer was at fault. These assertions keep the tool output honest:
 * images come back already written as markdown images, and the host is
 * explicitly a non-topic.
 */
class GeneratedFileLinkTextTest {

    @TempDir
    Path dir;

    @Test
    @DisplayName("image entry points hand the artifact back as a markdown IMAGE")
    void imageResultsUseImageMarkdown() {
        GeneratedFileCache cache = new GeneratedFileCache(dir);
        byte[] bytes = "png".getBytes(StandardCharsets.UTF_8);

        String zh = GeneratedFileLink.imageZh(bytes, "chart.png", "image/png", cache, "图片", null);
        String en = GeneratedFileLink.imageEn(bytes, "chart.png", "image/png", cache, "Image", null);

        assertTrue(zh.contains("![chart.png]("), zh);
        assertTrue(en.contains("![chart.png]("), en);
        // The picture is what the user should see, not a download link.
        assertTrue(en.contains("renders it inline"), en);
        // Both languages must forbid the two things that broke the real session:
        // wrapping the URL (so the renderer/linkifier cannot see it) and
        // speculating about the host.
        assertTrue(en.contains("do **not** comment on its host"), en);
        assertTrue(en.contains("code block"), en);
        assertTrue(zh.contains("主机名"), zh);
        assertTrue(zh.contains("代码块"), zh);
    }

    @Test
    @DisplayName("document entry points keep the link form and also rule out host talk")
    void documentResultsStayLinks() {
        GeneratedFileCache cache = new GeneratedFileCache(dir);
        byte[] bytes = "doc".getBytes(StandardCharsets.UTF_8);

        String en = GeneratedFileLink.resultEn(bytes, "informe.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                cache, "Document", 1, null);

        assertTrue(en.contains("[informe.docx]("), en);
        assertFalse(en.contains("![informe.docx]("), en);
        assertTrue(en.contains("localhost is irrelevant"), en);
    }

    @Test
    @DisplayName("the artifact lifetime reported to the model follows the configured TTL")
    void lifetimeComesFromTheCache() {
        GeneratedFileCache cache = new GeneratedFileCache(dir);
        byte[] bytes = "png".getBytes(StandardCharsets.UTF_8);

        String fromDefault = GeneratedFileLink.imageEn(bytes, "a.png", "image/png", cache, "Image", null);
        assertTrue(fromDefault.contains("valid for 365 days"), fromDefault);

        cache.setTtl(java.time.Duration.ZERO);
        String forever = GeneratedFileLink.imageEn(bytes, "b.png", "image/png", cache, "Image", null);
        assertTrue(forever.contains("valid indefinitely"), forever);
    }
}
