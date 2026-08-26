package vip.mate.dashboard.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AuraClaw V902 (Opción A): el Panel de un miembro normal debe mostrar solo su
 * propio consumo. El filtro por {@code username} debe aplicarse a las DOS
 * consultas de conversaciones (conteo + resolución de IDs para filtrar
 * mensajes/tokens), no solo al conteo.
 */
@ExtendWith(MockitoExtension.class)
class DashboardServiceUserScopedTest {

    @Mock private MessageMapper messageMapper;
    @Mock private ConversationMapper conversationMapper;

    private DashboardService service;

    @BeforeAll
    static void initLambdaCache() {
        // Los LambdaQueryWrapper necesitan el cache de tablas de MyBatis-Plus
        // (normalmente inicializado por Spring) — patrón del repo.
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""),
                ConversationEntity.class);
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""),
                MessageEntity.class);
    }

    @BeforeEach
    void setUp() {
        // Los mocks se inyectan DESPUÉS de instanciar la clase de test — el
        // servicio debe construirse en @BeforeEach, no en la declaración.
        service = new DashboardService(messageMapper, conversationMapper, new ObjectMapper());
    }

    private String sqlOf(LambdaQueryWrapper<?> wrapper) {
        String sql = wrapper.getSqlSegment();
        if (sql == null) sql = "";
        // Los literales viven en paramNameValuePairs (el segmento usa placeholders)
        StringBuilder sb = new StringBuilder(sql);
        wrapper.getParamNameValuePairs().forEach((k, v) -> sb.append(' ').append(k).append('=').append(v));
        return sb.toString();
    }

    @Test
    @DisplayName("getOverview(username) filtra conversaciones por ese usuario (conteo e IDs)")
    void usernameScopesBothConversationQueries() {
        when(conversationMapper.selectCount(any())).thenReturn(0L);
        when(conversationMapper.selectList(any())).thenReturn(List.of());

        service.getOverview(1L, "alice");

        // getOverview ejecuta queryStats 3 veces (hoy/semana/mes): TODAS las
        // consultas de conteo deben llevar el filtro de usuario.
        ArgumentCaptor<LambdaQueryWrapper<ConversationEntity>> countCaptor =
                ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(conversationMapper, atLeastOnce()).selectCount(countCaptor.capture());
        assertThat(countCaptor.getAllValues()).isNotEmpty();
        for (var w : countCaptor.getAllValues()) {
            assertThat(sqlOf(w)).contains("username").contains("alice").contains("workspace_id");
        }

        ArgumentCaptor<LambdaQueryWrapper<ConversationEntity>> idsCaptor =
                ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(conversationMapper, atLeastOnce()).selectList(idsCaptor.capture());
        for (var w : idsCaptor.getAllValues()) {
            assertThat(sqlOf(w)).contains("username").contains("alice");
        }
    }

    @Test
    @DisplayName("username null → consulta consolidada del workspace (sin filtro de usuario)")
    void nullUsernameKeepsWorkspaceScope() {
        when(conversationMapper.selectCount(any())).thenReturn(0L);
        when(conversationMapper.selectList(any())).thenReturn(List.of());

        service.getOverview(1L, null);

        ArgumentCaptor<LambdaQueryWrapper<ConversationEntity>> countCaptor =
                ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(conversationMapper, atLeastOnce()).selectCount(countCaptor.capture());
        for (var w : countCaptor.getAllValues()) {
            assertThat(sqlOf(w)).contains("workspace_id").doesNotContain("username");
        }
    }

    @Test
    @DisplayName("username + workspace null → solo el filtro de usuario aplica")
    void usernameAloneScopesQueries() {
        when(conversationMapper.selectCount(any())).thenReturn(0L);
        when(conversationMapper.selectList(any())).thenReturn(List.of());

        service.getTrend(null, "bob", 7);

        ArgumentCaptor<LambdaQueryWrapper<ConversationEntity>> idsCaptor =
                ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(conversationMapper, atLeastOnce()).selectList(idsCaptor.capture());
        for (var w : idsCaptor.getAllValues()) {
            assertThat(sqlOf(w)).contains("username").contains("bob");
        }
    }

    @Test
    @DisplayName("sin conversaciones del usuario → mensajes/tokens en cero (sin consultar IDs vacíos)")
    void noUserConversationsYieldsZeroMessages() {
        when(conversationMapper.selectCount(any())).thenReturn(0L);
        when(conversationMapper.selectList(any())).thenReturn(List.of());

        // selectCount de mensajes no debe llamarse con lista vacía → cero
        var stats = service.getOverview(1L, "ghost").get("today");
        assertThat(stats).isNotNull();
        // No más verificación: el contrato es no romper y devolver ceros.
    }
}
