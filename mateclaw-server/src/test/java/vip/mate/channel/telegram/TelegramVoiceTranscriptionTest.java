package vip.mate.channel.telegram;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vip.mate.channel.ChannelMessageRouter;
import vip.mate.channel.model.ChannelEntity;
import vip.mate.stt.SttService;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;

/**
 * AuraClaw V902: inbound Telegram voice notes are downloaded and transcribed
 * via {@link SttService} (best-effort — a failure must never break the
 * message pipeline, the legacy {@code [语音]} placeholder remains).
 */
@ExtendWith(MockitoExtension.class)
class TelegramVoiceTranscriptionTest {

    @Mock private SttService sttService;
    @Mock private ChannelMessageRouter router;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private TelegramChannelAdapter adapter() {
        return spy(new TelegramChannelAdapter(channel(), router, objectMapper, sttService, null));
    }

    private static ChannelEntity channel() {
        ChannelEntity c = new ChannelEntity();
        c.setId(1L);
        return c;
    }

    @Test
    @DisplayName("STT service not wired → null transcript, no crash")
    void noSttServiceReturnsNull() {
        TelegramChannelAdapter bare = spy(new TelegramChannelAdapter(
                channel(), router, objectMapper, null, null));

        assertThat(bare.transcribeVoiceNote("file-1")).isNull();
    }

    @Test
    @DisplayName("download returns null → no STT call, null transcript")
    void nullDownloadSkipsStt() {
        TelegramChannelAdapter adapter = adapter();
        doReturn(null).when(adapter).downloadTelegramFile("file-1");

        assertThat(adapter.transcribeVoiceNote("file-1")).isNull();
        verify(sttService, never()).transcribe(any(), any(), any(), any());
    }

    @Test
    @DisplayName("empty audio bytes → no STT call, null transcript")
    void emptyDownloadSkipsStt() {
        TelegramChannelAdapter adapter = adapter();
        doReturn(new byte[0]).when(adapter).downloadTelegramFile("file-1");

        assertThat(adapter.transcribeVoiceNote("file-1")).isNull();
        verify(sttService, never()).transcribe(any(), any(), any(), any());
    }

    @Test
    @DisplayName("successful transcription returns the text")
    void successfulTranscriptionReturnsText() {
        TelegramChannelAdapter adapter = adapter();
        byte[] audio = new byte[]{0x4F, 0x67, 0x67, 0x53}; // OggS magic
        doReturn(audio).when(adapter).downloadTelegramFile("file-1");
        doReturn(Map.of("success", true, "text", "Hola, esto es una prueba"))
                .when(sttService).transcribe(eq(audio), eq("voice.ogg"), eq("audio/ogg"), isNull());

        assertThat(adapter.transcribeVoiceNote("file-1")).isEqualTo("Hola, esto es una prueba");
    }

    @Test
    @DisplayName("provider failure → null transcript (best-effort)")
    void providerFailureReturnsNull() {
        TelegramChannelAdapter adapter = adapter();
        doReturn(new byte[]{1}).when(adapter).downloadTelegramFile("file-1");
        doReturn(Map.of("success", false, "error", "STT 端点返回 500"))
                .when(sttService).transcribe(any(), any(), any(), isNull());

        assertThat(adapter.transcribeVoiceNote("file-1")).isNull();
    }

    @Test
    @DisplayName("empty transcript text → null")
    void emptyTranscriptReturnsNull() {
        TelegramChannelAdapter adapter = adapter();
        doReturn(new byte[]{1}).when(adapter).downloadTelegramFile("file-1");
        doReturn(Map.of("success", true, "text", "   "))
                .when(sttService).transcribe(any(), any(), any(), isNull());

        assertThat(adapter.transcribeVoiceNote("file-1")).isNull();
    }

    // ------------------------------------------------------------------
    // V902: generated-file markdown links (charts) — Telegram delivery
    // ------------------------------------------------------------------

    @Test
    @DisplayName("markdown link to generated file → unwrapped to label only")
    void unwrapsMarkdownGeneratedLink() {
        String content = "Adjunto la gráfica:\n"
                + "[pie.png](http://127.0.0.1:18080/api/v1/files/generated/41041f9d-abc)\n";

        String out = TelegramChannelAdapter.unwrapGeneratedLinks(content);

        assertThat(out)
                .contains("Adjunto la gráfica:")
                .contains("pie.png")
                .doesNotContain("](")
                .doesNotContain("api/v1/files/generated");
    }

    @Test
    @DisplayName("relative generated URL in markdown link → unwrapped")
    void unwrapsRelativeGeneratedLink() {
        String content = "[diagram](/api/v1/files/generated/abc-123)";
        assertThat(TelegramChannelAdapter.unwrapGeneratedLinks(content))
                .isEqualTo("diagram");
    }

    @Test
    @DisplayName("non-generated links and plain text untouched")
    void leavesOtherLinksAlone() {
        String content = "Mira [esto](https://example.com/page) y "
                + "https://example.com/api/v1/files/generated/x raw";
        assertThat(TelegramChannelAdapter.unwrapGeneratedLinks(content))
                .isEqualTo(content);
    }
}
