package vip.mate.llm.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 模型配置实体
 */
@Data
@TableName("mate_model_config")
public class ModelConfigEntity {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String name;

    private String provider;

    private String modelName;

    private String description;

    private Double temperature;

    private Integer maxTokens;

    /** 模型最大输入 token 数（上下文窗口），0 或 null 表示使用全局默认 */
    private Integer maxInputTokens;

    /**
     * RFC-03 Lane B1 — per-model HTTP read timeout (seconds).
     *
     * <p>Null / zero / negative → fall back to the global default of 180s
     * (existing behavior, see {@code AnthropicChatModelBuilder.applyHttpTimeouts}
     * and the corresponding helper in {@code AgentGraphBuilder}). A positive
     * value overrides for this specific model.
     *
     * <p>Use cases: {@code o1-pro} / Claude thinking-mode / large-prompt
     * generation calls that legitimately exceed 3 min, where the default
     * raises false-positive timeouts; conversely {@code haiku}-class models
     * that p99 well under 30s, where a tighter timeout fails fast.
     */
    private Integer requestTimeoutSeconds;

    private Double topP;

    private Boolean enableSearch;

    private String searchStrategy;

    private Boolean builtin;

    private Boolean enabled;

    private Boolean isDefault;

    /**
     * 模型类型：chat（默认，LLM 对话） / embedding（文本向量化）
     * <p>
     * 参考 Dify 的 ModelType 抽象：允许同一 Provider 下同时管理 chat 和 embedding 两类模型，
     * API Key 共用（存于 mate_model_provider）。
     */
    private String modelType;

    /**
     * Declared modalities the chat model can natively consume, JSON array of lowercase
     * names, e.g. {@code ["vision","video","audio"]}. {@code null} or blank → defer to
     * {@link vip.mate.llm.service.ModelCapabilityService} built-in heuristics.
     */
    private String modalities;

    /**
     * Usage scope for this model, JSON array of lowercase use names, e.g.
     * {@code ["chat"]}, {@code ["wiki"]} or {@code ["chat","wiki"]}.
     * <p>
     * {@code null} / blank → legacy behaviour: the model is chat-usable.
     * When {@code "chat"} is absent from the array the model is dedicated to
     * internal jobs (wiki digestion, …): it can still be referenced by job id
     * (e.g. {@code wikiDefaultModelId}) but is never offered as a normal chat
     * model (agent default / failover / conversation pin).
     */
    private String usageScope;

    /**
     * Transient, API-facing flag computed by {@code ModelConfigService}: {@code true}
     * when the model may be used for normal chat. Lets the UI badge dedicated models
     * while still listing them (e.g. the wiki picker). Never persisted.
     */
    @TableField(exist = false)
    private Boolean chatEligible;

    /**
     * Transient, request-scoped flag set by {@link vip.mate.llm.service.ModelConfigService#listByType}
     * when a modality filter is supplied: {@code true} when this row's declared or
     * heuristically-resolved capabilities cover the requested modality. Lets the
     * sidecar selector list every enabled chat model while still highlighting the
     * ones already known to support the modality. Never persisted.
     */
    @TableField(exist = false)
    private Boolean modalityCapable;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    private Integer deleted;
}
