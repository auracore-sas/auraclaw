package vip.mate.dashboard.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vip.mate.auth.model.UserEntity;
import vip.mate.auth.service.AuthService;
import vip.mate.common.result.R;
import vip.mate.cron.model.CronJobEntity;
import vip.mate.cron.repository.CronJobMapper;
import vip.mate.dashboard.model.CronJobRunEntity;
import vip.mate.dashboard.service.CronJobRunService;
import vip.mate.dashboard.service.DashboardService;
import vip.mate.exception.MateClawException;
import vip.mate.workspace.core.annotation.RequireGlobalAdmin;
import vip.mate.workspace.core.annotation.RequireWorkspaceRole;

import java.util.List;
import java.util.Map;

/**
 * Dashboard 统计接口
 *
 * @author MateClaw Team
 */
@Tag(name = "Dashboard")
@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final CronJobRunService cronJobRunService;
    private final CronJobMapper cronJobMapper;
    private final AuthService authService;

    /**
     * AuraClaw (V902): un miembro normal ve SOLO su propio consumo; el admin
     * global (o quien no pueda resolverse como admin) ve el consolidado del
     * workspace. Mismo criterio global-admin que {@code isConversationOwner}.
     */
    private String effectiveUsername(Authentication auth) {
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            return null;
        }
        UserEntity u = authService.findByUsername(auth.getName());
        if (u != null && "admin".equalsIgnoreCase(u.getRole())) {
            return null; // admin global → consolidado
        }
        return auth.getName();
    }

    @Operation(summary = "获取概览统计")
    @GetMapping("/overview")
    @RequireWorkspaceRole("member")
    public R<Map<String, Object>> overview(
            Authentication auth,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {
        return R.ok(dashboardService.getOverview(workspaceId, effectiveUsername(auth)));
    }

    @Operation(summary = "获取日用量趋势")
    @GetMapping("/trend")
    @RequireWorkspaceRole("member")
    public R<List<Map<String, Object>>> trend(
            Authentication auth,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            @RequestParam(defaultValue = "30") int days) {
        return R.ok(dashboardService.getTrend(workspaceId, effectiveUsername(auth), Math.min(days, 90)));
    }

    @Operation(summary = "获取 CronJob 执行历史")
    @GetMapping("/cron-runs/{cronJobId}")
    @RequireGlobalAdmin
    public R<List<CronJobRunEntity>> cronJobRuns(
            @PathVariable Long cronJobId,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            @RequestParam(defaultValue = "20") int limit) {
        // Verify the cron job belongs to the caller's workspace. Checked
        // against the job's own workspace_id so agent-less system jobs
        // (e.g. wiki_process) verify the same way as agent-bound jobs.
        CronJobEntity job = cronJobMapper.selectById(cronJobId);
        if (job != null && job.getWorkspaceId() != null) {
            long wsId = workspaceId != null ? workspaceId : 1L;
            if (!job.getWorkspaceId().equals(wsId)) {
                throw new MateClawException("err.common.wrong_workspace", 403, "资源不属于当前工作区");
            }
        }
        return R.ok(cronJobRunService.listByJobId(cronJobId, Math.min(limit, 100)));
    }

    @Operation(summary = "获取最近执行记录（当前 workspace 关联的 CronJob）")
    @GetMapping("/cron-runs")
    @RequireGlobalAdmin
    public R<List<CronJobRunEntity>> recentRuns(
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            @RequestParam(defaultValue = "20") int limit) {
        long wsId = workspaceId != null ? workspaceId : 1L;
        return R.ok(cronJobRunService.listRecentByWorkspace(wsId, Math.min(limit, 100)));
    }
}
