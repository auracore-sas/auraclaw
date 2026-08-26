package vip.mate.workspace.conversation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import vip.mate.agent.repository.AgentMapper;
import vip.mate.workspace.conversation.model.ConversationEntity;
import vip.mate.workspace.conversation.repository.ConversationMapper;
import vip.mate.workspace.conversation.repository.MessageMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AuraClaw V901: individual channels. Pin the owner semantics of
 * {@code getOrCreateSharedConversation}: a non-blank {@code ownerUsername}
 * (individual channel) creates the conversation owned by that AuraClaw user
 * and keeps it sticky on every inbound message; NULL / blank preserves the
 * upstream shared behaviour ({@code system}-owned, visible to every
 * workspace member).
 */
@ExtendWith(MockitoExtension.class)
class ConversationServiceChannelOwnerTest {

    @Mock private ConversationMapper conversationMapper;
    @Mock private MessageMapper messageMapper;
    @Mock private AgentMapper agentMapper;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks private ConversationService service;

    private static final String TELEGRAM_CONV = "telegram:2092623667826462721:1989192375";

    // ------------------------------------------------------------------
    // 1. Insert-time ownership
    // ------------------------------------------------------------------

    @Test
    @DisplayName("new conversation on an individual channel → owned by the channel owner")
    void newConvOnIndividualChannelIsOwnedByOwner() {
        when(conversationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        service.getOrCreateSharedConversation(
                TELEGRAM_CONV, 42L, 1L, null, null, "alice");

        ArgumentCaptor<ConversationEntity> inserted = ArgumentCaptor.forClass(ConversationEntity.class);
        verify(conversationMapper).insert(inserted.capture());
        assertThat(inserted.getValue().getUsername()).isEqualTo("alice");
        assertThat(inserted.getValue().getWorkspaceId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("new conversation on a shared channel → system-owned (upstream legacy)")
    void newConvOnSharedChannelStaysSystemOwned() {
        when(conversationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        service.getOrCreateSharedConversation(
                TELEGRAM_CONV, 42L, 1L, null, null, null);

        ArgumentCaptor<ConversationEntity> inserted = ArgumentCaptor.forClass(ConversationEntity.class);
        verify(conversationMapper).insert(inserted.capture());
        assertThat(inserted.getValue().getUsername()).isEqualTo("system");
    }

    @Test
    @DisplayName("blank ownerUsername behaves like NULL (shared channel)")
    void blankOwnerBehavesLikeNull() {
        when(conversationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        service.getOrCreateSharedConversation(
                TELEGRAM_CONV, 42L, 1L, null, null, "   ");

        ArgumentCaptor<ConversationEntity> inserted = ArgumentCaptor.forClass(ConversationEntity.class);
        verify(conversationMapper).insert(inserted.capture());
        assertThat(inserted.getValue().getUsername()).isEqualTo("system");
    }

    // ------------------------------------------------------------------
    // 2. Sticky owner on existing rows (owner-correction block)
    // ------------------------------------------------------------------

    @Test
    @DisplayName("existing system-owned conversation + owner on channel → corrected to owner")
    void existingSystemConvCorrectedToChannelOwner() {
        ConversationEntity legacy = conversation("system");
        when(conversationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(legacy);

        service.getOrCreateSharedConversation(
                TELEGRAM_CONV, 42L, 1L, null, null, "alice");

        assertThat(legacy.getUsername()).isEqualTo("alice");
        // Owner-correction path persists the change.
        verify(conversationMapper).updateById(legacy);
    }

    @Test
    @DisplayName("existing owner-owned conversation + same owner → sticky, no spurious update")
    void existingOwnerConvStaysStickyWithoutUpdate() {
        ConversationEntity owned = conversation("alice");
        when(conversationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(owned);

        service.getOrCreateSharedConversation(
                TELEGRAM_CONV, 42L, 1L, null, null, "alice");

        assertThat(owned.getUsername()).isEqualTo("alice");
        verify(conversationMapper, never()).updateById(any(ConversationEntity.class));
    }

    @Test
    @DisplayName("existing owner-owned conversation + message without owner (channel became shared) → reverts to system")
    void existingOwnerConvRevertsWhenChannelBecomesShared() {
        ConversationEntity owned = conversation("alice");
        when(conversationMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(owned);

        service.getOrCreateSharedConversation(
                TELEGRAM_CONV, 42L, 1L, null, null, null);

        assertThat(owned.getUsername()).isEqualTo("system");
        verify(conversationMapper).updateById(owned);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static ConversationEntity conversation(String username) {
        ConversationEntity c = new ConversationEntity();
        c.setConversationId(TELEGRAM_CONV);
        c.setAgentId(42L);
        c.setUsername(username);
        c.setWorkspaceId(1L);
        return c;
    }
}
