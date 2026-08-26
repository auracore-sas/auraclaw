package vip.mate.llm.chatmodel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.openai.api.OpenAiApi;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

/**
 * Verification of {@link OpenAiRequestRewriter#translateMaxTokensForGpt5}.
 *
 * <p>OpenAI's gpt-5* reasoning family rejects {@code max_tokens} on the
 * {@code /v1/chat/completions} path with a 400 ({@code Unsupported parameter:
 * 'max_tokens' is not supported with this model. Use 'max_completion_tokens'
 * instead.}). Most call paths honor this via {@code ModelFamily.suppressMaxTokens()}
 * in the options builder, but per-node option overrides (e.g.
 * {@code ReasoningNode.buildChatOptions}) can still attach {@code max_tokens}.
 * This rewriter is the central safety net that translates the field on the final
 * outbound request so a gpt-5* model never ships {@code max_tokens}.
 */
class TranslateMaxTokensForGpt5Test {

    /**
     * Build a request with the given model and max token fields set via the
     * record canonical constructor — everything else null (mirrors
     * {@code ReasoningEffortSanitizerTest}).
     */
    private static OpenAiApi.ChatCompletionRequest request(String model, Integer maxTokens, Integer maxCompletionTokens) {
        return new OpenAiApi.ChatCompletionRequest(
                List.of(),          // messages
                model,              // model
                null,               // store
                null,               // metadata
                null,               // frequencyPenalty
                null,               // logitBias
                null,               // logprobs
                null,               // topLogprobs
                maxTokens,          // maxTokens
                maxCompletionTokens,// maxCompletionTokens
                null,               // n
                null,               // outputModalities
                null,               // audioParameters
                null,               // presencePenalty
                null,               // responseFormat
                null,               // seed
                null,               // serviceTier
                null,               // stop
                null,               // stream
                null,               // streamOptions
                null,               // temperature
                null,               // topP
                null,               // tools
                null,               // toolChoice
                null,               // parallelToolCalls
                null,               // user
                null,               // reasoningEffort
                null,               // webSearchOptions
                null,               // verbosity
                null,               // promptCacheKey
                null,               // safetyIdentifier
                null                // extraBody
        );
    }

    @Test
    @DisplayName("gpt-5* with max_tokens: translate to max_completion_tokens, null out max_tokens")
    void gpt5_translatesMaxTokens() {
        OpenAiApi.ChatCompletionRequest req = request("gpt-5-mini", 4096, null);
        OpenAiApi.ChatCompletionRequest out = OpenAiRequestRewriter.translateMaxTokensForGpt5(req);

        assertNull(out.maxTokens(), "gpt-5 must not carry max_tokens");
        assertEquals(4096, out.maxCompletionTokens(), "max_tokens value should move to max_completion_tokens");
        assertEquals("gpt-5-mini", out.model(), "model name preserved");
    }

    @Test
    @DisplayName("gpt-5* with both fields: keep existing max_completion_tokens, drop max_tokens")
    void gpt5_prefersExistingMaxCompletionTokens() {
        OpenAiApi.ChatCompletionRequest req = request("gpt-5", 8192, 2048);
        OpenAiApi.ChatCompletionRequest out = OpenAiRequestRewriter.translateMaxTokensForGpt5(req);

        assertNull(out.maxTokens());
        assertEquals(2048, out.maxCompletionTokens(),
                "existing max_completion_tokens wins over max_tokens");
    }

    @Test
    @DisplayName("gpt-5* without max_tokens: no-op, same instance returned")
    void gpt5_noMaxTokens_noop() {
        OpenAiApi.ChatCompletionRequest req = request("gpt-5-mini", null, 4096);
        assertSame(req, OpenAiRequestRewriter.translateMaxTokensForGpt5(req),
                "should not rebuild when max_tokens is already absent");
    }

    @Test
    @DisplayName("Non-gpt-5 model: max_tokens left untouched")
    void nonGpt5_untouched() {
        OpenAiApi.ChatCompletionRequest req = request("gpt-4o", 4096, null);
        assertSame(req, OpenAiRequestRewriter.translateMaxTokensForGpt5(req),
                "gpt-4o keeps max_tokens (STANDARD family)");
    }

    @Test
    @DisplayName("deepseek (non-gpt-5) with max_tokens: left untouched")
    void deepseek_untouched() {
        OpenAiApi.ChatCompletionRequest req = request("deepseek-chat", 4096, null);
        assertSame(req, OpenAiRequestRewriter.translateMaxTokensForGpt5(req));
    }

    @Test
    @DisplayName("gpt-5 model with null request fields can be rebuilt safely")
    void gpt5_skeleton_rebuilds() {
        OpenAiApi.ChatCompletionRequest req = request("gpt-5", null, null);
        OpenAiApi.ChatCompletionRequest out = OpenAiRequestRewriter.translateMaxTokensForGpt5(req);
        assertEquals("gpt-5", out.model());
        assertNull(out.maxTokens());
        assertNull(out.maxCompletionTokens());
    }
}
