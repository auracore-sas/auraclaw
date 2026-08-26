package vip.mate.workspace.conversation.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vip.mate.auth.model.UserEntity;
import vip.mate.auth.service.AuthService;
import vip.mate.common.result.R;
import vip.mate.workspace.conversation.TokenUsageService;
import vip.mate.workspace.conversation.vo.TokenUsageSummaryVO;
import vip.mate.workspace.core.annotation.RequireWorkspaceRole;

import java.time.LocalDate;

/**
 * Token Usage 统计接口
 *
 * @author MateClaw Team
 */
@Tag(name = "Token Usage 统计")
@RestController
@RequestMapping("/api/v1/token-usage")
@RequiredArgsConstructor
public class TokenUsageController {

    private final TokenUsageService tokenUsageService;
    private final AuthService authService;

    /**
     * AuraClaw (V902): mismo criterio que el Panel — admin global ve el
     * global; cualquier otro usuario ve solo su propio consumo.
     */
    private String effectiveUsername(Authentication auth) {
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            return null;
        }
        UserEntity u = authService.findByUsername(auth.getName());
        if (u != null && "admin".equalsIgnoreCase(u.getRole())) {
            return null;
        }
        return auth.getName();
    }

    @Operation(summary = "获取 Token 使用统计")
    @GetMapping
    @RequireWorkspaceRole("member")
    public R<TokenUsageSummaryVO> getSummary(
            Authentication auth,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate,
            @RequestParam(required = false) String modelName,
            @RequestParam(required = false) String providerId) {
        return R.ok(tokenUsageService.getSummary(
                startDate, endDate, modelName, providerId, effectiveUsername(auth)));
    }
}
