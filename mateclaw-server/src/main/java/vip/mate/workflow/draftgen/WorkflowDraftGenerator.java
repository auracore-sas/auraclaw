package vip.mate.workflow.draftgen;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.stereotype.Service;
import vip.mate.agent.model.AgentEntity;
import vip.mate.agent.repository.AgentMapper;
import vip.mate.channel.model.ChannelEntity;
import vip.mate.channel.repository.ChannelMapper;
import vip.mate.llm.chatmodel.ProviderChatModelFactory;
import vip.mate.llm.model.ModelConfigEntity;
import vip.mate.llm.service.ModelConfigService;
import vip.mate.workflow.compiler.PublishContext;
import vip.mate.workflow.compiler.WorkflowAclPort;
import vip.mate.workflow.compiler.WorkflowCompiler;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Natural-language → workflow draft generator.
 *
 * <p>Composes a system prompt + workspace-scoped context (available
 * digital employees + channels) + the user description, dispatches to
 * the workspace's default chat model, parses the JSON response, and
 * runs {@link WorkflowCompiler} against it without persisting. The
 * compile pass is "preview-only" — auto-publish is explicitly
 * forbidden in the system prompt and we don't insert any rows here.
 *
 * <p>The generator is also the shared core called by the
 * {@code workflow_draft_generate} agent tool, so a chat user can ask
 * an agent "把每周一汇总销售这件事做成 workflow" and the agent gets back
 * the same draft shape.
 *
 * <p>Failures are surfaced rather than swallowed: if the model returns
 * non-JSON or the JSON doesn't carry a {@code steps} array, the
 * generator throws so the controller / tool returns a clear error
 * instead of a silently-broken draft.
 */
@Slf4j
@Service
public class WorkflowDraftGenerator {

    /** System prompt — the contract the LLM must honor. Embedded as a
     *  text block so the file is the canonical version (no resource
     *  loading, no separate prompt-management infra in v0). */
    static final String SYSTEM_PROMPT = """
            Eres el generador de borradores de flujos de trabajo de AuraClaw. Tu tarea es convertir el proceso de negocio que el usuario describe en lenguaje natural a un borrador de workflow JSON v0 según el RFC-29 de AuraClaw.

            Solo emites JSON: nada de Markdown, explicaciones ni bloques de código.

            # Formato de salida

            Debes emitir un JSON object con esta estructura:

            {
              "schemaVersion": "1.0",
              "name": "...",
              "description": "...",
              "metadata": {
                "generatedFrom": "natural_language",
                "confidence": 0.0,
                "warnings": [],
                "missingFields": []
              },
              "triggerDrafts": [],
              "steps": []
            }

            # Los 7 modos soportados en v0

            sequential — lo ejecuta un empleado; requiere agentId/agentName + promptTemplate. outputContentType solo puede ser text o json.
            fan_out — al menos 2 fan_out consecutivos seguidos de un collect; cada rama requiere agentId/agentName + promptTemplate.
            collect — sin agentId, agentName ni promptTemplate; solo puede ir después de un grupo fan_out.
            conditional — mode.expression obligatorio, usa un subconjunto de sintaxis Pebble.
              · Comparaciones: == != < <= > >=
              · Lógica: debes usar las palabras and / or / not; prohibido && / || / !
              · Ejemplo (una condición): {{ outputs.x.approved == true }}
              · Ejemplo (varias condiciones): {{ outputs.finance.flag == true or outputs.ops.flag == true or outputs.customer.flag == true }}
              · Ejemplo (negación): {{ not outputs.x.skip }}
              agentId/agentName + promptTemplate obligatorios.
            await_approval — approvalKind + approverChannels[] + approvalMessage obligatorios; timeoutSecs opcional; sin agentId / agentName / promptTemplate.
            dispatch_channel — channels[] + targets{} + content obligatorios; sin agentId / agentName / promptTemplate.
            write_memory — employeeId + file + mergeStrategy(append/replace_section/upsert_kv/overwrite) + content obligatorios; sin agentId / agentName / promptTemplate.

            # No soportado

            No generes loop / invoke_skill / subflow. No generes triggers agent_lifecycle / content_match.
            Ante bucles, reintentos hasta el éxito, invocación de skills o anidamiento complejo, usa los pasos lineales más cercanos y anota en metadata.warnings que requiere confirmación humana.

            # Triggers (triggerDrafts)

            Solo se permiten patternType: cron / channel_message / workflow_completion / webhook.
            triggerDrafts van con enabled=false por defecto; nunca los actives automáticamente.

            # Nombres

            workflow.name en inglés kebab-case (daily-sales-summary).
            step.name y outputVar siempre en inglés snake_case (collect_sales_data / sales_summary). Se usan como identificadores en expresiones Pebble: un guion se interpreta como resta y rompe el workflow en runtime. Nunca uses guiones en step.name ni outputVar.
            description en el idioma del usuario.

            # Referencias entre pasos (producidos de pasos anteriores en promptTemplate / dispatch content / write_memory content / expression)

            Para referenciar la salida de un paso anterior, escribe solo {{ outputs.<outputVar> }} — <outputVar> debe ser el campo outputVar declarado por un paso anterior, nunca un step.name.
            Cuando outputContentType sea json puedes acceder a subcampos: {{ outputs.<outputVar>.<field> }}; si es text usa directamente {{ outputs.<outputVar> }}, sin subcampos.
            Correcto: el outputVar del paso anterior es news_data → el paso siguiente escribe {{ outputs.news_data }}.
            Incorrecto: {{ outputs.search-competitor-news.news_data }} — usa step.name y además guiones; fallará en runtime.

            # Campos placeholder

            Usa placeholders cuando no encuentres IDs/canales/empleados reales que coincidan:
            - agentName: "TODO_*_AGENT"
            - employeeId: "TODO_EMPLOYEE_ID"
            - channels[*]: "TODO_SELECT_CHANNEL"
            - targets["TODO_SELECT_CHANNEL"]: "TODO_TARGET_ID"
            - sourceWorkflowId: "TODO_WORKFLOW_ID"
            Explica cada TODO en metadata.missingFields.
            Nunca inventes agentId / channelType / IDs de grupo inexistentes.

            # Valores por defecto

            approvalKind: uno de manager / finance / manual / legal / oncall.
            approverChannels: por defecto ["web"], salvo que el usuario mencione canales IM de empresa.
            mergeStrategy: por defecto "append".
            schemaVersion: siempre "1.0".

            # Calidad

            Usa solo campos v0; sin comentarios; sin trailing comma; sin Markdown; no actives triggers automáticamente; no publiques automáticamente.
            """;

    private final ProviderChatModelFactory chatModelFactory;
    private final ModelConfigService modelConfigService;
    private final RetryTemplate retryTemplate;
    private final AgentMapper agentMapper;
    private final ChannelMapper channelMapper;
    private final ObjectMapper objectMapper;
    private final WorkflowCompiler compiler;
    private final WorkflowAclPort aclPort;
    private final WorkflowDraftTemplateLibrary templateLibrary;

    public WorkflowDraftGenerator(ProviderChatModelFactory chatModelFactory,
                                  ModelConfigService modelConfigService,
                                  RetryTemplate retryTemplate,
                                  AgentMapper agentMapper,
                                  ChannelMapper channelMapper,
                                  ObjectMapper objectMapper,
                                  WorkflowCompiler compiler,
                                  WorkflowAclPort aclPort,
                                  WorkflowDraftTemplateLibrary templateLibrary) {
        this.chatModelFactory = chatModelFactory;
        this.modelConfigService = modelConfigService;
        this.retryTemplate = retryTemplate;
        this.agentMapper = agentMapper;
        this.channelMapper = channelMapper;
        this.objectMapper = objectMapper;
        this.compiler = compiler;
        this.aclPort = aclPort;
        this.templateLibrary = templateLibrary;
    }

    public GeneratedWorkflowDraft generate(String description, long workspaceId) {
        if (description == null || description.isBlank()) {
            throw new IllegalArgumentException("description must not be empty");
        }

        // --- 1. workspace context ---------------------------------------
        String contextPrompt = buildContextPrompt(workspaceId);

        // --- 2. resolve runtime model ----------------------------------
        ModelConfigEntity model = modelConfigService.getDefaultModel();
        if (model == null) {
            throw new IllegalStateException(
                    "No default chat model configured; cannot generate workflow draft");
        }
        ChatModel chatModel = chatModelFactory.buildFor(model, retryTemplate);
        ChatClient client = ChatClient.create(chatModel);

        // --- 3. call the model -----------------------------------------
        String raw;
        try {
            raw = client.prompt()
                    .system(SYSTEM_PROMPT + "\n\n" + contextPrompt)
                    .user(description)
                    .call()
                    .content();
        } catch (Exception e) {
            // Log the full cause chain — the controller / agent tool only
            // surface getMessage(), so without this a provider-side failure
            // (auth, NPE in the chat client, ...) leaves no stack trace.
            log.error("Workflow draft generator chat call failed", e);
            throw new IllegalStateException(
                    "Workflow draft generator chat call failed: " + e.getMessage(), e);
        }
        if (raw == null || raw.isBlank()) {
            throw new IllegalStateException("Workflow draft generator returned empty content");
        }

        // --- 4. parse + validate shape ---------------------------------
        JsonNode root = parseStrict(raw);
        if (!root.has("steps") || !root.get("steps").isArray()) {
            throw new IllegalStateException(
                    "Generated draft has no steps[] array; raw output: " + truncate(raw));
        }

        // --- 5. extract fields -----------------------------------------
        String name = root.path("name").asText("");
        String userDescription = root.path("description").asText("");
        Double confidence = root.path("metadata").path("confidence").isNumber()
                ? root.path("metadata").path("confidence").asDouble() : null;

        List<String> warnings = readStringArray(root, "metadata", "warnings");
        List<String> missingFields = readStringArray(root, "metadata", "missingFields");

        // The runtime only consumes the steps part of the draft — strip
        // everything else into a clean {steps:[...]} shape.
        Map<String, Object> draftRoot = new LinkedHashMap<>();
        draftRoot.put("steps", objectMapper.convertValue(root.get("steps"),
                new TypeReference<List<Map<String, Object>>>() {}));
        String draftJson;
        try {
            draftJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(draftRoot);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to re-serialize generated steps: " + e.getMessage(), e);
        }

        // --- 6. trigger drafts -----------------------------------------
        // patternType allowlist mirrors what TriggerService accepts at
        // create time. The generator prompt forbids agent_lifecycle and
        // content_match; we filter defensively here too because models
        // occasionally hallucinate trigger types under low confidence,
        // and we don't want a future UI / tool that calls /draft/generate
        // and trusts the response to silently re-introduce dropped types.
        java.util.Set<String> allowedPatternTypes = java.util.Set.of(
                "cron", "channel_message", "workflow_completion", "webhook");
        List<Map<String, Object>> triggerDrafts = new ArrayList<>();
        if (root.has("triggerDrafts") && root.get("triggerDrafts").isArray()) {
            List<Map<String, Object>> candidates = objectMapper.convertValue(root.get("triggerDrafts"),
                    new TypeReference<List<Map<String, Object>>>() {});
            int dropped = 0;
            for (Map<String, Object> td : candidates) {
                String pt = td.get("patternType") instanceof String s ? s : null;
                if (pt == null || !allowedPatternTypes.contains(pt)) {
                    dropped++;
                    continue;
                }
                // Belt-and-suspenders: never trust the LLM to honor enabled=false.
                td.put("enabled", false);
                triggerDrafts.add(td);
            }
            if (dropped > 0) {
                warnings = appendWarning(warnings,
                        "dropped " + dropped + " unsupported triggerDraft entr" + (dropped == 1 ? "y" : "ies")
                                + " (allowed: " + String.join(", ", allowedPatternTypes) + ")");
            }
        }

        // --- 7. compile preview ---------------------------------------
        boolean compileOk;
        List<vip.mate.workflow.compiler.CompileError> compileErrors;
        try {
            // PublishContext is (workspaceId, publisherId).
            WorkflowCompiler.Result result = compiler.compile(draftJson,
                    new PublishContext(workspaceId, 0L), aclPort);
            compileOk = result.ok();
            compileErrors = compileOk ? List.of() : result.errors();
        } catch (Exception e) {
            // Compile preview failures are not fatal — the operator can
            // still edit the draft. We surface them as warnings.
            log.warn("[WorkflowDraftGenerator] preview compile failed: {}", e.getMessage());
            compileOk = false;
            compileErrors = List.of();
            warnings = appendWarning(warnings, "preview compile threw: " + e.getMessage());
        }

        return new GeneratedWorkflowDraft(
                name == null || name.isBlank() ? "untitled-workflow" : name,
                userDescription,
                draftJson,
                triggerDrafts,
                warnings,
                missingFields,
                confidence,
                compileOk,
                compileErrors);
    }

    /** Compose the workspace-scoped context prompt: agent + channel
     *  inventory the model can pick from. Agents are filtered to enabled
     *  rows; channels likewise. The model is told to prefer real ids
     *  over TODOs but never to fabricate. */
    private String buildContextPrompt(long workspaceId) {
        List<AgentEntity> agents = agentMapper.selectList(new LambdaQueryWrapper<AgentEntity>()
                .eq(AgentEntity::getWorkspaceId, workspaceId)
                .eq(AgentEntity::getEnabled, true));
        List<ChannelEntity> channels = channelMapper.selectList(new LambdaQueryWrapper<ChannelEntity>()
                .eq(ChannelEntity::getWorkspaceId, workspaceId)
                .eq(ChannelEntity::getEnabled, true));

        StringBuilder sb = new StringBuilder();
        sb.append("# Empleados digitales disponibles en este workspace\n[");
        boolean first = true;
        for (AgentEntity a : agents) {
            if (!first) sb.append(",");
            first = false;
            sb.append("{\"agentId\":").append(a.getId())
              .append(",\"name\":\"").append(escape(a.getName()))
              .append("\",\"description\":\"")
              .append(escape(a.getDescription() == null ? "" : a.getDescription()))
              .append("\"}");
        }
        sb.append("]\n\n# Canales disponibles en este workspace\n[");
        first = true;
        for (ChannelEntity c : channels) {
            if (!first) sb.append(",");
            first = false;
            sb.append("{\"channelType\":\"").append(escape(c.getChannelType()))
              .append("\",\"name\":\"").append(escape(c.getName()))
              .append("\"}");
        }
        sb.append("]\n\nUsa estos agentId y channelType reales. Los IDs inexistentes deben usar placeholder TODO_*; no inventes.\n");

        // Few-shot exemplars from the template library — the LLM stays
        // closer to canonical shapes when it has 2-3 concrete examples
        // in the system prompt.
        sb.append("\n# Ejemplos de plantilla (referencia, no es necesario copiarlos)\n");
        for (WorkflowDraftTemplate t : templateLibrary.all()) {
            sb.append("## ").append(t.id()).append(" — ").append(t.label()).append("\n");
            sb.append(t.description()).append("\n");
            sb.append("draft: ").append(t.draftJson()).append("\n");
            if (t.triggerDraftsJson() != null && !"[]".equals(t.triggerDraftsJson())) {
                sb.append("triggerDrafts: ").append(t.triggerDraftsJson()).append("\n");
            }
        }
        return sb.toString();
    }

    private JsonNode parseStrict(String raw) {
        // Some models still wrap the JSON in a ```json fence even when
        // the prompt says "no Markdown". Strip the fences before parsing
        // so we don't reject otherwise-valid output.
        String cleaned = raw.trim();
        if (cleaned.startsWith("```")) {
            int firstNl = cleaned.indexOf('\n');
            if (firstNl > 0) cleaned = cleaned.substring(firstNl + 1);
            int closeFence = cleaned.lastIndexOf("```");
            if (closeFence > 0) cleaned = cleaned.substring(0, closeFence);
            cleaned = cleaned.trim();
        }
        try {
            return objectMapper.readTree(cleaned);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Workflow draft generator returned non-JSON: " + e.getMessage()
                            + " — raw: " + truncate(raw), e);
        }
    }

    private List<String> readStringArray(JsonNode root, String... path) {
        JsonNode node = root;
        for (String p : path) node = node.path(p);
        if (!node.isArray()) return List.of();
        List<String> out = new ArrayList<>(node.size());
        for (JsonNode item : node) {
            if (item.isTextual()) out.add(item.asText());
        }
        return out;
    }

    private static List<String> appendWarning(List<String> existing, String msg) {
        List<String> next = new ArrayList<>(existing == null ? List.of() : existing);
        next.add(msg);
        return next;
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", " ").replace("\r", " ");
    }

    private static String truncate(String s) {
        if (s == null) return "";
        return s.length() <= 400 ? s : s.substring(0, 400) + "…";
    }
}
