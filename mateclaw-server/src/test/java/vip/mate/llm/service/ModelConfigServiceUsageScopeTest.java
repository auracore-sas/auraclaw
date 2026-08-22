package vip.mate.llm.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;
import vip.mate.llm.model.ModelConfigEntity;
import vip.mate.llm.repository.ModelConfigMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * V900 (Auracore): model {@code usage_scope} — a model scoped to internal jobs
 * (e.g. {@code ["wiki"]}) must never surface as a normal chat model, while a
 * multi-purpose scope ({@code ["chat","wiki"]}) stays chat-usable.
 */
@ExtendWith(MockitoExtension.class)
class ModelConfigServiceUsageScopeTest {

    @Mock
    private ModelConfigMapper modelConfigMapper;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private ModelProviderService modelProviderService;

    @InjectMocks
    private ModelConfigService service;

    @BeforeEach
    void injectLazyDep() {
        ReflectionTestUtils.setField(service, "modelProviderService", modelProviderService);
    }

    private static ModelConfigEntity chatModel(String provider, String modelName, String usageScope) {
        ModelConfigEntity m = new ModelConfigEntity();
        m.setProvider(provider);
        m.setModelName(modelName);
        m.setEnabled(true);
        m.setModelType("chat");
        m.setUsageScope(usageScope);
        return m;
    }

    // ── isChatUsable contract ──────────────────────────────────────────────────

    @Test
    @DisplayName("null / blank usage scope stays chat-usable (legacy)")
    void nullUsageIsChatUsable() {
        assertTrue(ModelConfigService.isChatUsable(chatModel("p", "m", null)));
        assertTrue(ModelConfigService.isChatUsable(chatModel("p", "m", "")));
        assertTrue(ModelConfigService.isChatUsable(chatModel("p", "m", "  ")));
    }

    @Test
    @DisplayName("scope containing chat stays chat-usable")
    void chatScopeIsChatUsable() {
        assertTrue(ModelConfigService.isChatUsable(chatModel("p", "m", "[\"chat\"]")));
        assertTrue(ModelConfigService.isChatUsable(chatModel("p", "m", "[\"chat\",\"wiki\"]")));
        assertTrue(ModelConfigService.isChatUsable(chatModel("p", "m", "[\"wiki\",\"chat\"]")));
    }

    @Test
    @DisplayName("internal-job-only scope is not chat-usable")
    void wikiOnlyScopeIsNotChatUsable() {
        assertFalse(ModelConfigService.isChatUsable(chatModel("p", "m", "[\"wiki\"]")));
        assertFalse(ModelConfigService.isChatUsable(chatModel("p", "m", "[\"wiki\",\"skill\"]")));
    }

    @Test
    @DisplayName("embedding typed model is never chat-usable")
    void embeddingTypeIsNotChatUsable() {
        ModelConfigEntity emb = chatModel("p", "m", null);
        emb.setModelType("embedding");
        assertFalse(ModelConfigService.isChatUsable(emb));
    }

    @Test
    @DisplayName("unparseable scope degrades to chat-usable (fail open)")
    void unparseableScopeFailsOpen() {
        assertTrue(ModelConfigService.isChatUsable(chatModel("p", "m", "not-json")));
        assertTrue(ModelConfigService.isChatUsable(chatModel("p", "m", "[broken")));
    }

    // ── resolveModel: named lookup must skip internal-job models ───────────────

    @Test
    @DisplayName("named wiki-only model does not resolve as chat — falls back to default")
    void wikiOnlyNamedModelFallsBackToDefault() {
        ModelConfigEntity wikiOnly = chatModel("wiki-llm", "expensive", "[\"wiki\"]");
        ModelConfigEntity defaultModel = chatModel("dashscope", "qwen-plus", null);
        // 1st: name lookup returns the wiki-only model → must be rejected.
        // 2nd: default flag lookup returns the chat default.
        when(modelConfigMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(wikiOnly)
                .thenReturn(defaultModel);
        when(modelProviderService.isProviderEnabledAndConfigured("dashscope")).thenReturn(true);

        ModelConfigEntity result = service.resolveModel("expensive");

        assertNotNull(result);
        assertEquals("qwen-plus", result.getModelName());
        assertEquals("dashscope", result.getProvider());
    }

    @Test
    @DisplayName("multi-purpose [chat,wiki] named model still resolves for chat")
    void multiPurposeNamedModelResolves() {
        ModelConfigEntity hybrid = chatModel("wiki-llm", "expensive", "[\"chat\",\"wiki\"]");
        when(modelConfigMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(hybrid);

        ModelConfigEntity result = service.resolveModel("expensive");

        assertNotNull(result);
        assertEquals("expensive", result.getModelName());
        // getDefaultModel must not be reached.
        verify(modelProviderService, never()).isProviderEnabledAndConfigured(any());
    }

    // ── listEnabledModels: chat candidates exclude internal-job models ─────────

    @Test
    @DisplayName("listEnabledModels excludes wiki-only models but keeps hybrid ones")
    void listEnabledModelsExcludesWikiOnly() {
        ModelConfigEntity wikiOnly = chatModel("wiki-llm", "expensive", "[\"wiki\"]");
        ModelConfigEntity hybrid = chatModel("wiki-llm", "hybrid", "[\"chat\",\"wiki\"]");
        ModelConfigEntity plain = chatModel("dashscope", "qwen-plus", null);
        when(modelConfigMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(wikiOnly, hybrid, plain));

        List<ModelConfigEntity> result = service.listEnabledModels();

        assertEquals(2, result.size());
        assertTrue(result.stream().anyMatch(m -> "hybrid".equals(m.getModelName())));
        assertTrue(result.stream().anyMatch(m -> "qwen-plus".equals(m.getModelName())));
        assertFalse(result.stream().anyMatch(m -> "expensive".equals(m.getModelName())));
    }

    // ── getDefaultModel: a default flagged on a wiki-only model is skipped ─────

    @Test
    @DisplayName("getDefaultModel skips a default flag sitting on a wiki-only model")
    void defaultFlagOnWikiOnlyModelIsSkipped() {
        ModelConfigEntity wikiOnlyDefault = chatModel("wiki-llm", "expensive", "[\"wiki\"]");
        wikiOnlyDefault.setIsDefault(true);
        ModelConfigEntity fallbackChat = chatModel("dashscope", "qwen-plus", null);
        // 1st selectOne: default-flag lookup → wiki-only model (rejected).
        // 2nd: candidates selectList → [wikiOnlyDefault, fallbackChat].
        when(modelConfigMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(wikiOnlyDefault);
        when(modelConfigMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(wikiOnlyDefault, fallbackChat));
        when(modelProviderService.isProviderEnabledAndConfigured("dashscope")).thenReturn(true);

        ModelConfigEntity result = service.getDefaultModel();

        assertNotNull(result);
        assertEquals("qwen-plus", result.getModelName());
        verify(modelProviderService, never()).isProviderEnabledAndConfigured("wiki-llm");
    }

    // ── getDefaultModelByProvider / getPrimaryChatModelByProvider ──────────────

    @Test
    @DisplayName("getDefaultModelByProvider rejects a wiki-only default row")
    void providerDefaultRejectsWikiOnly() {
        ModelConfigEntity wikiOnlyDefault = chatModel("wiki-llm", "expensive", "[\"wiki\"]");
        wikiOnlyDefault.setIsDefault(true);
        when(modelConfigMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(wikiOnlyDefault);

        assertNull(service.getDefaultModelByProvider("wiki-llm"));
    }

    @Test
    @DisplayName("getPrimaryChatModelByProvider falls back past a wiki-only model")
    void primaryChatModelSkipsWikiOnly() {
        ModelConfigEntity wikiOnly = chatModel("wiki-llm", "expensive", "[\"wiki\"]");
        ModelConfigEntity cheap = chatModel("wiki-llm", "cheap", null);
        // 1st: getDefaultModelByProvider selectOne → wiki-only default (rejected → null).
        // 2nd: earliest enabled chat selectOne → the cheap model.
        when(modelConfigMapper.selectOne(any(LambdaQueryWrapper.class)))
                .thenReturn(wikiOnly)
                .thenReturn(cheap);

        ModelConfigEntity result = service.getPrimaryChatModelByProvider("wiki-llm");

        assertNotNull(result);
        assertEquals("cheap", result.getModelName());
        verify(modelConfigMapper, times(2)).selectOne(any());
    }

    // ── listByType: chat rows are annotated with chatEligible ──────────────────

    @Test
    @DisplayName("listByType(chat) annotates chatEligible without dropping rows")
    void listByTypeAnnotatesChatEligible() {
        ModelConfigEntity wikiOnly = chatModel("wiki-llm", "expensive", "[\"wiki\"]");
        ModelConfigEntity plain = chatModel("dashscope", "qwen-plus", null);
        when(modelConfigMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(wikiOnly, plain));

        List<ModelConfigEntity> result = service.listByType("chat");

        assertEquals(2, result.size());
        ModelConfigEntity wikiRow = result.stream().filter(m -> "expensive".equals(m.getModelName())).findFirst().orElseThrow();
        ModelConfigEntity plainRow = result.stream().filter(m -> "qwen-plus".equals(m.getModelName())).findFirst().orElseThrow();
        assertFalse(Boolean.TRUE.equals(wikiRow.getChatEligible()));
        assertTrue(Boolean.TRUE.equals(plainRow.getChatEligible()));
    }
}
