package vip.mate.llm.model;

import lombok.Data;

/**
 * Body of {@code PUT /api/v1/models/{providerId}/models/usage-scope} (V900, Auracore).
 */
@Data
public class UpdateModelUsageScopeRequest {

    /** Model identifier within the provider, i.e. {@code mate_model_config.model_name}. */
    private String modelId;

    /**
     * Usage scope, JSON array of lowercase use names, e.g. {@code ["chat"]},
     * {@code ["wiki"]} or {@code ["chat","wiki"]}. {@code null} clears the scope
     * (legacy behaviour: chat-usable). A scope without {@code "chat"} dedicates
     * the model to internal jobs — normal chat never selects it.
     */
    private String usageScope;
}
