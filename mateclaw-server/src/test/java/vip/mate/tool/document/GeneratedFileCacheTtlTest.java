package vip.mate.tool.document;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The artifact lifetime is a deployment setting
 * ({@code mateclaw.generated-file.ttl}, env {@code MATECLAW_GENERATED_FILE_TTL}),
 * not the 7-day constant it used to be: regenerating a deliverable costs the
 * customer a full model run, so keeping files for a year is the default and
 * operators shorten it per commercial plan.
 *
 * <p>These tests pin the three behaviours that make the knob safe:
 * the default is long, {@code 0} really means "never", and raising the TTL
 * extends artifacts that are still alive instead of leaving them to die on the
 * old schedule.
 */
class GeneratedFileCacheTtlTest {

    @TempDir
    Path dir;

    private static final byte[] BYTES = "report".getBytes(StandardCharsets.UTF_8);

    private List<Path> metas() throws IOException {
        try (Stream<Path> files = Files.list(dir)) {
            return files.filter(p -> p.getFileName().toString().endsWith(".meta")).toList();
        }
    }

    @Test
    @DisplayName("default lifetime is a year, not a week")
    void defaultTtlIsLong() {
        GeneratedFileCache cache = new GeneratedFileCache(dir);

        assertEquals(GeneratedFileCache.DEFAULT_TTL, cache.ttl());
        assertTrue(cache.ttl().toDays() >= 365, "deliverables must outlive a quarterly cycle");
        assertFalse(cache.neverExpires());

        String id = cache.put(BYTES, "informe.pdf", "application/pdf");
        GeneratedFileCache.Entry entry = cache.get(id).orElseThrow();
        long remainingDays = Duration.ofMillis(entry.expireAt() - System.currentTimeMillis()).toDays();
        assertTrue(remainingDays >= 360, "a fresh entry should live ~a year, was " + remainingDays + "d");
    }

    @Test
    @DisplayName("ttl=0 disables expiration entirely")
    void zeroTtlNeverExpires() {
        GeneratedFileCache cache = new GeneratedFileCache(dir);
        cache.setTtl(Duration.ZERO);

        assertTrue(cache.neverExpires());
        String id = cache.put(BYTES, "contrato.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        GeneratedFileCache.Entry entry = cache.get(id).orElseThrow();
        assertEquals(Long.MAX_VALUE, entry.expireAt());
        assertFalse(entry.expired());
        // …and a fresh instance reading the meta line keeps it alive too.
        GeneratedFileCache reopened = new GeneratedFileCache(dir);
        reopened.setTtl(Duration.ZERO);
        assertTrue(reopened.get(id).isPresent());
    }

    @Test
    @DisplayName("an expired entry stays gone (bytes already swept are not resurrected)")
    void expiredEntriesAreNotResurrected() throws IOException {
        GeneratedFileCache shortLived = new GeneratedFileCache(dir);
        shortLived.setTtl(Duration.ofDays(1));
        String id = shortLived.put(BYTES, "viejo.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        // Age the entry past its expiry, exactly as the sweep would find it.
        Path meta = dir.resolve(id + ".meta");
        String stale = Files.readString(meta).replaceFirst("^\\d+", "1");
        Files.writeString(meta, stale);
        Files.writeString(dir.resolve("unrelated.meta"), "1\tapplication/pdf\tbm90LWEtcGRm\t\t\t");

        GeneratedFileCache afterUpgrade = new GeneratedFileCache(dir);
        afterUpgrade.setTtl(Duration.ofDays(365));
        assertEquals(0, afterUpgrade.extendLiveEntries(), "expired entries must be left alone");
        assertTrue(afterUpgrade.get(id).isEmpty(), "an expired id must not resolve");
    }

    @Test
    @DisplayName("raising the TTL extends the artifacts that are still alive, and stays idempotent")
    void raisingTtlExtendsLiveEntries() {
        GeneratedFileCache before = new GeneratedFileCache(dir);
        before.setTtl(Duration.ofDays(7));
        String live = before.put(BYTES, "informe.pdf", "application/pdf");
        long oldExpiry = before.get(live).orElseThrow().expireAt();

        GeneratedFileCache after = new GeneratedFileCache(dir);
        after.setTtl(Duration.ofDays(365));
        assertEquals(1, after.extendLiveEntries(), "the live artifact should be extended");

        long newExpiry = after.get(live).orElseThrow().expireAt();
        assertTrue(newExpiry > oldExpiry, "expiry must move forward");
        long days = Duration.ofMillis(newExpiry - System.currentTimeMillis()).toDays();
        assertTrue(days >= 360, "extended entry should now live ~a year, was " + days + "d");

        // Restarting again (or running the sweep) must be a no-op.
        assertEquals(0, after.extendLiveEntries());
        GeneratedFileCache third = new GeneratedFileCache(dir);
        third.setTtl(Duration.ofDays(365));
        assertEquals(0, third.extendLiveEntries());
    }

    @Test
    @DisplayName("a lower TTL never shortens what is already stored")
    void loweringTtlDoesNotShorten() {
        GeneratedFileCache generous = new GeneratedFileCache(dir);
        generous.setTtl(Duration.ofDays(365));
        String id = generous.put(BYTES, "informe.pdf", "application/pdf");
        long expiry = generous.get(id).orElseThrow().expireAt();

        GeneratedFileCache stricter = new GeneratedFileCache(dir);
        stricter.setTtl(Duration.ofDays(30));
        assertEquals(0, stricter.extendLiveEntries());
        assertEquals(expiry, stricter.get(id).orElseThrow().expireAt(),
                "shrinking the configured TTL must not cut existing lifetimes");
    }
}
