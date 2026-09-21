package vip.mate.tool.document;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.TestingAuthenticationToken;
import vip.mate.auth.model.UserEntity;
import vip.mate.auth.service.AuthService;
import vip.mate.workspace.core.service.WorkspaceService;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GeneratedFileControllerTest {

    @Test
    @DisplayName("download is forbidden when current workspace does not match file workspace")
    void forbiddenWhenWorkspaceDoesNotMatch(@TempDir Path dir) {
        GeneratedFileCache cache = new GeneratedFileCache(dir);
        String id = cache.put("secret".getBytes(StandardCharsets.UTF_8), "b.txt", "text/plain",
                new GeneratedFileCache.Owner(20L, 30L, "conv-b"));
        AuthService authService = mock(AuthService.class);
        WorkspaceService workspaceService = mock(WorkspaceService.class);
        when(authService.findByUsername("alice")).thenReturn(user(30L, "user"));

        GeneratedFileController controller = new GeneratedFileController(cache, authService, workspaceService);
        ResponseEntity<?> response = controller.download(id, 10L,
                new TestingAuthenticationToken("alice", "pw"));

        assertEquals(403, response.getStatusCode().value());
    }

    @Test
    @DisplayName("download succeeds when current workspace matches and user can view it")
    void allowedWhenWorkspaceMatches(@TempDir Path dir) {
        GeneratedFileCache cache = new GeneratedFileCache(dir);
        String id = cache.put("ok".getBytes(StandardCharsets.UTF_8), "b.txt", "text/plain",
                new GeneratedFileCache.Owner(20L, 30L, "conv-b"));
        AuthService authService = mock(AuthService.class);
        WorkspaceService workspaceService = mock(WorkspaceService.class);
        when(authService.findByUsername("alice")).thenReturn(user(30L, "user"));
        when(workspaceService.hasPermissionCached(20L, 30L, "viewer")).thenReturn(true);

        GeneratedFileController controller = new GeneratedFileController(cache, authService, workspaceService);
        ResponseEntity<?> response = controller.download(id, 20L,
                new TestingAuthenticationToken("alice", "pw"));

        assertEquals(200, response.getStatusCode().value());
    }

    @Test
    @DisplayName("an SVG is served sandboxed so a script inside it cannot run with our origin")
    void svgIsSandboxed(@TempDir Path dir) {
        GeneratedFileCache cache = new GeneratedFileCache(dir);
        String svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>";
        String id = cache.put(svg.getBytes(StandardCharsets.UTF_8), "chart.svg", "image/svg+xml",
                new GeneratedFileCache.Owner(20L, 30L, "conv-b"));
        GeneratedFileController controller = controller(cache);

        ResponseEntity<?> response = controller.download(id, 20L,
                new TestingAuthenticationToken("alice", "pw"));

        assertEquals(200, response.getStatusCode().value());
        assertEquals("sandbox", response.getHeaders().getFirst("Content-Security-Policy"));
        assertEquals("nosniff", response.getHeaders().getFirst("X-Content-Type-Options"));
        // Still inline, so the chat's authenticated loader can display it.
        assertTrue(String.valueOf(response.getHeaders().getFirst("Content-Disposition")).startsWith("inline"));
    }

    @Test
    @DisplayName("raster images stay inline without a sandbox (an <img> cannot execute anything)")
    void rasterImagesAreNotSandboxed(@TempDir Path dir) {
        GeneratedFileCache cache = new GeneratedFileCache(dir);
        String id = cache.put(new byte[]{1, 2, 3}, "chart.png", "image/png",
                new GeneratedFileCache.Owner(20L, 30L, "conv-b"));
        GeneratedFileController controller = controller(cache);

        ResponseEntity<?> response = controller.download(id, 20L,
                new TestingAuthenticationToken("alice", "pw"));

        assertEquals(200, response.getStatusCode().value());
        assertNull(response.getHeaders().getFirst("Content-Security-Policy"));
        assertTrue(String.valueOf(response.getHeaders().getFirst("Content-Disposition")).startsWith("inline"));
    }

    /** Controller wired to a stub auth/workspace pair for the happy path. */
    private static GeneratedFileController controller(GeneratedFileCache cache) {
        AuthService authService = mock(AuthService.class);
        WorkspaceService workspaceService = mock(WorkspaceService.class);
        when(authService.findByUsername("alice")).thenReturn(user(30L, "user"));
        when(workspaceService.hasPermissionCached(20L, 30L, "viewer")).thenReturn(true);
        return new GeneratedFileController(cache, authService, workspaceService);
    }

    private static UserEntity user(Long id, String role) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername("alice");
        user.setRole(role);
        user.setEnabled(true);
        return user;
    }
}
