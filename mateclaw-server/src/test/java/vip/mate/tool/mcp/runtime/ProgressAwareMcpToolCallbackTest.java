package vip.mate.tool.mcp.runtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.spec.McpSchema;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.DefaultToolDefinition;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.metadata.ToolMetadata;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * White-box tests for {@link ProgressAwareMcpToolCallback}.
 *
 * <p>Covers the two code paths:
 * <ol>
 *   <li>progressToken present in ToolContext → direct McpSyncClient.callTool() with injected meta</li>
 *   <li>progressToken absent → delegates to inner callback (backward-compatible)</li>
 * </ol>
 */
class ProgressAwareMcpToolCallbackTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ToolCallback delegate;
    private McpSyncClient mcpClient;
    private ProgressAwareMcpToolCallback wrapper;

    @BeforeEach
    void setUp() {
        delegate = mock(ToolCallback.class);
        mcpClient = mock(McpSyncClient.class);
        when(delegate.getToolDefinition()).thenReturn(
                DefaultToolDefinition.builder().name("search").description("desc").inputSchema("{}").build());
        when(delegate.getToolMetadata()).thenReturn(ToolMetadata.builder().build());
        wrapper = new ProgressAwareMcpToolCallback(delegate, mcpClient, "search", MAPPER);
    }

    @Test
    @DisplayName("getToolDefinition delegates to inner callback")
    void delegatesGetToolDefinition() {
        assertEquals("search", wrapper.getToolDefinition().name());
        verify(delegate).getToolDefinition();
    }

    @Test
    @DisplayName("getToolMetadata delegates to inner callback")
    void delegatesGetToolMetadata() {
        assertNotNull(wrapper.getToolMetadata());
        verify(delegate).getToolMetadata();
    }

    @Test
    @DisplayName("call(toolInput) without ToolContext delegates to inner")
    void callWithoutToolContextDelegates() {
        when(delegate.call("{}")).thenReturn("result");
        assertEquals("result", wrapper.call("{}"));
        verify(delegate).call("{}");
        verifyNoInteractions(mcpClient);
    }

    @Test
    @DisplayName("call with ToolContext but without progressToken delegates to inner")
    void callWithoutProgressTokenDelegates() {
        ToolContext ctx = new ToolContext(Map.of());
        when(delegate.call("{}", ctx)).thenReturn("delegated");
        assertEquals("delegated", wrapper.call("{}", ctx));
        verify(delegate).call("{}", ctx);
        verifyNoInteractions(mcpClient);
    }

    @Test
    @DisplayName("call with null ToolContext delegates to inner")
    void callWithNullToolContextDelegates() {
        when(delegate.call("{}", null)).thenReturn("null_ctx");
        assertEquals("null_ctx", wrapper.call("{}", (ToolContext) null));
        verify(delegate).call("{}", (ToolContext) null);
        verifyNoInteractions(mcpClient);
    }

    @Test
    @DisplayName("call with progressToken in ToolContext calls McpSyncClient directly with meta injected")
    void callWithProgressTokenUsesMcpClient() {
        ToolContext ctx = new ToolContext(Map.of(
                ProgressAwareMcpToolCallback.MCP_PROGRESS_TOKEN_KEY, "pt-uuid-123"));
        McpSchema.TextContent textContent = new McpSchema.TextContent("mcp result");
        McpSchema.CallToolResult result = new McpSchema.CallToolResult(List.of(textContent), false);
        when(mcpClient.callTool(any())).thenReturn(result);

        String output = wrapper.call("{\"q\":\"hello\"}", ctx);

        assertEquals("mcp result", output);
        verify(mcpClient).callTool(any(McpSchema.CallToolRequest.class));
        verify(delegate, never()).call(any(), any());
    }

    @Test
    @DisplayName("progressToken present but blank → delegates (edge case)")
    void blankProgressTokenDelegates() {
        ToolContext ctx = new ToolContext(Map.of(
                ProgressAwareMcpToolCallback.MCP_PROGRESS_TOKEN_KEY, "   "));
        when(delegate.call("{}", ctx)).thenReturn("fallback");
        assertEquals("fallback", wrapper.call("{}", ctx));
        verify(delegate).call("{}", ctx);
        verifyNoInteractions(mcpClient);
    }

    @Test
    @DisplayName("McpSyncClient throws → falls back to delegate")
    void mcpClientThrowsFallsBackToDelegate() {
        ToolContext ctx = new ToolContext(Map.of(
                ProgressAwareMcpToolCallback.MCP_PROGRESS_TOKEN_KEY, "tok"));
        when(mcpClient.callTool(any())).thenThrow(new RuntimeException("connection lost"));
        when(delegate.call(eq("{}"), any(ToolContext.class))).thenReturn("fallback result");

        String output = wrapper.call("{}", ctx);

        assertEquals("fallback result", output);
        verify(mcpClient).callTool(any());
        verify(delegate).call(eq("{}"), any());
    }

    @Test
    @DisplayName("callTool succeeds with multi-text content concatenated")
    void multiTextContentConcatenated() {
        ToolContext ctx = new ToolContext(Map.of(
                ProgressAwareMcpToolCallback.MCP_PROGRESS_TOKEN_KEY, "tok"));
        McpSchema.CallToolResult result = new McpSchema.CallToolResult(List.of(
                new McpSchema.TextContent("part1"),
                new McpSchema.TextContent("part2")), false);
        when(mcpClient.callTool(any())).thenReturn(result);

        assertEquals("part1part2", wrapper.call("{}", ctx));
    }

    @Test
    @DisplayName("getDelegate returns inner callback (for ReturnDirect / IdentityForward detection)")
    void getDelegateReturnsInner() {
        assertSame(delegate, wrapper.getDelegate());
    }

    @Test
    @DisplayName("parseArguments handles null input")
    void parseArgumentsHandlesNull() {
        ToolContext ctx = new ToolContext(Map.of(
                ProgressAwareMcpToolCallback.MCP_PROGRESS_TOKEN_KEY, "tok"));
        when(mcpClient.callTool(any())).thenReturn(
                new McpSchema.CallToolResult(List.of(new McpSchema.TextContent("ok")), false));
        assertEquals("ok", wrapper.call(null, ctx));
    }

    @Test
    @DisplayName("parseArguments handles blank input")
    void parseArgumentsHandlesBlank() {
        ToolContext ctx = new ToolContext(Map.of(
                ProgressAwareMcpToolCallback.MCP_PROGRESS_TOKEN_KEY, "tok"));
        when(mcpClient.callTool(any())).thenReturn(
                new McpSchema.CallToolResult(List.of(new McpSchema.TextContent("ok")), false));
        assertEquals("ok", wrapper.call("   ", ctx));
    }

    // ── structuredContent (PowerFin-style servers: summary in content, payload in data) ──

    private String callWithStructuredContent(McpSchema.CallToolResult result) {
        ToolContext ctx = new ToolContext(Map.of(
                ProgressAwareMcpToolCallback.MCP_PROGRESS_TOKEN_KEY, "tok"));
        when(mcpClient.callTool(any())).thenReturn(result);
        return wrapper.call("{}", ctx);
    }

    @Test
    @DisplayName("structuredContent is appended when content carries only a summary")
    void structuredContentAppended() {
        McpSchema.CallToolResult result = new McpSchema.CallToolResult(
                List.of(new McpSchema.TextContent("6 factura(s) encontrada(s) con estado(s): 002, 005")),
                false,
                Map.of("count", 6, "invoices", List.of(
                        Map.of("code", "001-021-000009335", "balance", "2616.25"),
                        Map.of("code", "001-021-000009340", "balance", "101.50"))),
                Map.of());

        String out = callWithStructuredContent(result);

        assertTrue(out.contains("6 factura(s) encontrada(s) con estado(s): 002, 005"),
                "summary text must be preserved: " + out);
        assertTrue(out.contains("[Detalle estructurado]"), "structured payload must be appended: " + out);
        assertTrue(out.contains("001-021-000009335"), "invoice details must be visible to the LLM: " + out);
        assertTrue(out.contains("001-021-000009340"));
    }

    @Test
    @DisplayName("structuredContent without text content still produces JSON output")
    void structuredContentWithoutTextContent() {
        McpSchema.CallToolResult result = new McpSchema.CallToolResult(
                List.of(), false,
                Map.of("count", 1, "invoices", List.of(Map.of("code", "X"))),
                Map.of());

        String out = callWithStructuredContent(result);

        assertTrue(out.contains("[Detalle estructurado]"), "must emit structured payload even with empty content: " + out);
        assertTrue(out.contains("\"code\":\"X\"") || out.contains("\"code\" : \"X\"")
                || out.contains("\"code\" :\"X\"") || out.contains("X"), "detail must be present: " + out);
    }

    @Test
    @DisplayName("no structuredContent → output unchanged (backward compatible)")
    void noStructuredContentUnchanged() {
        McpSchema.CallToolResult result = new McpSchema.CallToolResult(
                List.of(new McpSchema.TextContent("plain result")), false, null, Map.of());

        assertEquals("plain result", callWithStructuredContent(result));
    }

    @Test
    @DisplayName("structuredContent already embedded in text is not duplicated")
    void structuredContentAlreadyInTextNotDuplicated() {
        String summary = "{\"count\":1,\"invoices\":[{\"code\":\"ABC\"}]}";
        McpSchema.CallToolResult result = new McpSchema.CallToolResult(
                List.of(new McpSchema.TextContent(summary)),
                false,
                Map.of("count", 1, "invoices", List.of(Map.of("code", "ABC"))),
                Map.of());

        String out = callWithStructuredContent(result);

        assertEquals(summary, out, "payload already in the text must not be appended again");
    }

    @Test
    @DisplayName("structuredContent null → falls back to delegate path semantics (empty content)")
    void nullResultReturnsEmpty() {
        ToolContext ctx = new ToolContext(Map.of(
                ProgressAwareMcpToolCallback.MCP_PROGRESS_TOKEN_KEY, "tok"));
        when(mcpClient.callTool(any())).thenReturn(null);
        assertEquals("", wrapper.call("{}", ctx));
    }
}
