package vip.mate.tool.document;

import org.springframework.ai.chat.model.ToolContext;
import org.springframework.lang.Nullable;

/**
 * Stash freshly-rendered bytes into the {@link GeneratedFileCache} and format
 * the markdown link the tool returns to the LLM.
 *
 * <p>Two locales are exposed because mateclaw's existing convention has the
 * inline render tools speak Chinese and the file-driven render tools speak
 * English. Each variant tells the model to echo the URL verbatim — neither
 * stripping nor inventing a host — because the URL may already be absolute
 * (when {@code mateclaw.server.public-base-url} is set or a request host is
 * resolvable) and models otherwise tamper with it when echoing it back.
 */
public final class GeneratedFileLink {

    private GeneratedFileLink() {}

    /**
     * Chinese-language tool result for inline render entry points
     * ({@code renderDocx} / {@code renderXlsx} / {@code renderPptx}).
     *
     * @param typeLabel "文档" / "工作簿" / "演示文稿"
     */
    public static String resultZh(byte[] bytes, String displayName, String mimeType,
                                  GeneratedFileCache cache, String typeLabel,
                                  @Nullable ToolContext ctx) {
        String url = stash(bytes, displayName, mimeType, cache, ctx);
        String validity = cache.neverExpires() ? "永久有效" : cache.ttl().toDays() + " 天内有效";
        return typeLabel + "已生成：[" + displayName + "](" + url + ")（链接 " + validity + "）。\n"
                + "重要：回答用户时**必须**使用上述 markdown 链接格式 [" + displayName + "](" + url + ")，"
                + "保持链接地址**原样照抄**，**不要**用反引号包裹，**不要**增删任何域名或 http(s):// 前缀，"
                + "也**不要**评论链接里的主机名（是不是 localhost 与本功能无关，平台自己会解析并交给用户）。";
    }

    /**
     * Chinese-language tool result for IMAGE entry points ({@code render_html_image},
     * {@code capture_screenshot}).
     *
     * <p>Differs from {@link #resultZh} in one decisive way: the artifact is handed
     * back already written as a markdown IMAGE, so a model that simply echoes the
     * block gets an inline picture in the web chat instead of a download link (and
     * the IM scrubbers still see the URL).
     */
    public static String imageZh(byte[] bytes, String displayName, String mimeType,
                                 GeneratedFileCache cache, String typeLabel,
                                 @Nullable ToolContext ctx) {
        String url = stash(bytes, displayName, mimeType, cache, ctx);
        String validity = cache.neverExpires() ? "永久有效" : cache.ttl().toDays() + " 天内有效";
        return typeLabel + "已生成：![" + displayName + "](" + url + ")（链接 " + validity + "）。\n"
                + "重要：回答用户时**必须**使用上述 markdown 图片格式 ![" + displayName + "](" + url + ")，"
                + "平台会在对话里直接显示这张图片。地址**原样照抄**，**不要**用反引号或代码块包裹，"
                + "**不要**增删域名或 http(s):// 前缀，也**不要**评论主机名（是不是 localhost 与本功能无关）。";
    }

    /** English counterpart of {@link #imageZh} for image entry points. */
    public static String imageEn(byte[] bytes, String displayName, String mimeType,
                                 GeneratedFileCache cache, String typeLabel,
                                 @Nullable ToolContext ctx) {
        String url = stash(bytes, displayName, mimeType, cache, ctx);
        String validity = cache.neverExpires()
                ? " (link valid indefinitely).\n"
                : " (link valid for " + cache.ttl().toDays() + " days).\n";
        return typeLabel + " generated: ![" + displayName + "](" + url + ")" + validity
                + "IMPORTANT: when replying to the user use that markdown IMAGE form !["
                + displayName + "](" + url + ") — the chat renders it inline. Copy the URL verbatim: "
                + "do **not** wrap it in backticks or a code block, do **not** add or remove any host "
                + "or http(s):// prefix, and do **not** comment on its host (the platform serves the "
                + "file and renders it for the user, whether or not that host says localhost).";
    }

    /**
     * English-language tool result for file-driven render entry points
     * ({@code renderDocxFromFile} / {@code renderDocxFromFiles} / etc.).
     *
     * @param typeLabel       "Document" / "Workbook" / "Presentation"
     * @param sourceFileCount number of source markdown files combined into the
     *                        artifact; values {@code > 1} produce a "from N files"
     *                        prefix, {@code 1} produces the plain "generated" prefix
     */
    public static String resultEn(byte[] bytes, String displayName, String mimeType,
                                  GeneratedFileCache cache, String typeLabel,
                                  int sourceFileCount, @Nullable ToolContext ctx) {
        String url = stash(bytes, displayName, mimeType, cache, ctx);
        String prefix = sourceFileCount > 1
                ? typeLabel + " generated from " + sourceFileCount + " files"
                : typeLabel + " generated";
        String validity = cache.neverExpires()
                ? " (link valid indefinitely).\n"
                : " (link valid for " + cache.ttl().toDays() + " days).\n";
        return prefix + ": [" + displayName + "](" + url + ")" + validity
                + "IMPORTANT: when replying to the user you **must** keep the markdown link form ["
                + displayName + "](" + url + ") above. Copy the URL verbatim — do **not** wrap it "
                + "in backticks, do **not** add or remove any https://, http:// or domain, and do "
                + "**not** comment on the host in it (whether it says localhost is irrelevant: this "
                + "platform serves the file and resolves it for the user's browser).";
    }

    private static String stash(byte[] bytes, String displayName, String mimeType,
                                GeneratedFileCache cache, @Nullable ToolContext ctx) {
        String id = cache.put(bytes, displayName, mimeType, ctx);
        return cache.downloadUrl(id, ctx);
    }
}
