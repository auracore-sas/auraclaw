package vip.mate.channel;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vip.mate.workspace.conversation.model.MessageContentPart;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AuraClaw V902: prompt building for inbound voice notes. An audio part with
 * a caption (already transcribed) must NOT be presented as an unprocessed
 * file — otherwise the LLM hallucinates that it cannot access the .ogg and
 * answers "no transcription available" despite the transcript being present.
 */
class TelegramPromptPartsTest {

    private final ChannelMessageRouter router =
            new ChannelMessageRouter(null, null, null, null, null, null,
                    null, null, new ObjectMapper(), null, null, null, null);

    @Test
    @DisplayName("voice note transcribed (caption) → prompt says auto-transcribed + transcript text")
    void transcribedAudioRendersTranscriptNotFile() {
        MessageContentPart audio = MessageContentPart.audio("file-1", "voice.ogg");
        audio.setCaption("Hola, revisa este audio, por favor.");
        MessageContentPart transcript = MessageContentPart.text("Hola, revisa este audio, por favor.");

        String prompt = router.buildPromptFromParts(
                "fallback", List.of(audio, transcript), "voice");

        assertThat(prompt)
                .contains("[用户通过语音输入，请用简短口语化的方式回复]")
                .contains("[用户发送了音频，已自动转录（文本如下）]")
                .contains("Hola, revisa este audio, por favor.")
                .doesNotContain("[用户发送了音频: voice.ogg]");
    }

    @Test
    @DisplayName("voice note NOT transcribed (no caption) → legacy placeholder remains")
    void untranscribedAudioKeepsLegacyPlaceholder() {
        MessageContentPart audio = MessageContentPart.audio("file-1", "voice.ogg");

        String prompt = router.buildPromptFromParts("fallback", List.of(audio), "voice");

        assertThat(prompt).contains("[用户发送了音频: voice.ogg]");
    }

    @Test
    @DisplayName("plain text message → unchanged")
    void plainTextMessageUnchanged() {
        String prompt = router.buildPromptFromParts(
                "Hola", List.of(MessageContentPart.text("Hola")), "text");

        assertThat(prompt).isEqualTo("Hola");
    }
}
