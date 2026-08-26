package vip.mate.workspace.conversation;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vip.mate.workspace.conversation.model.ConversationEntity;
import vip.mate.workspace.conversation.model.MessageEntity;
import vip.mate.workspace.conversation.repository.ConversationMapper;
import vip.mate.workspace.conversation.repository.MessageMapper;
import vip.mate.workspace.conversation.vo.TokenUsageSummaryVO;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AuraClaw V902: el resumen de Token Usage de un miembro normal debe acotarse
 * a sus propias conversaciones (mismo patrón que el Panel). Admin (username
 * null) mantiene el comportamiento global original.
 */
@ExtendWith(MockitoExtension.class)
class TokenUsageServiceUserScopedTest {

    @Mock private MessageMapper messageMapper;
    @Mock private ConversationMapper conversationMapper;

    private TokenUsageService service;

    @BeforeAll
    static void initLambdaCache() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""),
                ConversationEntity.class);
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""),
                MessageEntity.class);
    }

    @BeforeEach
    void setUp() {
        // Mocks inyectados después de instanciar la clase → construir en @BeforeEach.
        service = new TokenUsageService(messageMapper, conversationMapper);
    }

    private String sqlOf(LambdaQueryWrapper<?> wrapper) {
        String sql = wrapper.getSqlSegment();
        if (sql == null) sql = "";
        StringBuilder sb = new StringBuilder(sql);
        wrapper.getParamNameValuePairs().forEach((k, v) -> sb.append(' ').append(k).append('=').append(v));
        return sb.toString();
    }

    private static ConversationEntity conv(String id) {
        ConversationEntity c = new ConversationEntity();
        c.setConversationId(id);
        return c;
    }

    @Test
    @DisplayName("username → mensajes filtrados por sus conversaciones (IN)")
    void usernameScopesMessagesToOwnConversations() {
        when(conversationMapper.selectList(any())).thenReturn(
                List.of(conv("telegram:1:2"), conv("conv_abc")));
        when(messageMapper.selectList(any())).thenReturn(List.of());

        service.getSummary(null, null, null, null, "alice");

        ArgumentCaptor<LambdaQueryWrapper<MessageEntity>> captor =
                ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(messageMapper).selectList(captor.capture());
        String sql = sqlOf(captor.getValue());
        assertThat(sql).contains("conversation_id IN").contains("telegram:1:2").contains("conv_abc");
    }

    @Test
    @DisplayName("usuario sin conversaciones → resumen vacío sin tocar mensajes")
    void noConversationsYieldsEmptySummary() {
        when(conversationMapper.selectList(any())).thenReturn(List.of());

        TokenUsageSummaryVO vo = service.getSummary(null, null, null, null, "ghost");

        assertThat(vo.getTotalMessages()).isZero();
        assertThat(vo.getTotalPromptTokens()).isZero();
        verify(messageMapper, never()).selectList(any());
    }

    @Test
    @DisplayName("username null (admin) → consulta global sin filtro de conversaciones")
    void nullUsernameKeepsGlobalScope() {
        when(messageMapper.selectList(any())).thenReturn(List.of());

        service.getSummary(null, null, null, null, null);

        verify(conversationMapper, never()).selectList(any());
        ArgumentCaptor<LambdaQueryWrapper<MessageEntity>> captor =
                ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(messageMapper).selectList(captor.capture());
        assertThat(sqlOf(captor.getValue())).doesNotContain("conversation_id");
    }
}
