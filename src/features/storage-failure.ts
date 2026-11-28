// @ts-check
import {sanitizeDiagnosticDetail} from "./diagnostics";

export type StorageFailureKind =
    | "readonly"
    | "quota-exceeded"
    | "auth-failed"
    | "timeout"
    | "unavailable"
    | "unknown";

export interface ClassifiedStorageFailure {
    kind: StorageFailureKind;
    messageKey: string;
    recoverable: boolean;
    sanitizedDetail: string;
}

/**
 * T-1869 存储错误分类器：
 * 区分只读工作区、磁盘配额超限、认证失效、通信超时、宿主不可用及未知错误；
 * 确保前端给用户清晰可执行的自愈引导，杜绝晦涩代码泄漏。
 */
export function classifyStorageFailure(error: unknown): ClassifiedStorageFailure {
    const raw = error instanceof Error
        ? error.message
        : typeof error === "string"
            ? error
            : error && typeof error === "object" && "msg" in error && typeof (error as {msg?: unknown}).msg === "string"
                ? String((error as {msg: string}).msg)
                : "";
    const lower = raw.toLowerCase();

    if (/readonly|read-only|read only|只读/.test(lower)) {
        return {
            kind: "readonly",
            messageKey: "storage.errReadonly",
            recoverable: false,
            sanitizedDetail: sanitizeDiagnosticDetail(raw),
        };
    }

    if (/enospc|disk full|quota exceeded|quota_exceeded|storage full|no space|空间不足|配额不足/.test(lower)) {
        return {
            kind: "quota-exceeded",
            messageKey: "storage.errQuotaExceeded",
            recoverable: true,
            sanitizedDetail: sanitizeDiagnosticDetail(raw),
        };
    }

    if (/unauthorized|\b401\b|token invalid|token expired|auth failed|forbidden|\b403\b|未授权|认证失败/.test(lower)) {
        return {
            kind: "auth-failed",
            messageKey: "storage.errAuthFailed",
            recoverable: false,
            sanitizedDetail: sanitizeDiagnosticDetail(raw),
        };
    }

    if (/timeout|timed out|etimedout|超时/.test(lower)) {
        return {
            kind: "timeout",
            messageKey: "storage.errTimeout",
            recoverable: true,
            sanitizedDetail: sanitizeDiagnosticDetail(raw),
        };
    }

    if (/econnrefused|network error|failed to fetch|fetch failed|unavailable|connection refused|无法连接|网络异常/.test(lower)) {
        return {
            kind: "unavailable",
            messageKey: "storage.errUnavailable",
            recoverable: true,
            sanitizedDetail: sanitizeDiagnosticDetail(raw),
        };
    }

    return {
        kind: "unknown",
        messageKey: "msg.saveFail",
        recoverable: true,
        sanitizedDetail: sanitizeDiagnosticDetail(raw),
    };
}
