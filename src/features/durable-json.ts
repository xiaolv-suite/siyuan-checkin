/** Raw kernel IO: a successful Plugin.loadData/saveData promise is not disk evidence. */
export type JsonRead<T = unknown> = {kind: "present"; value: T} | {kind: "missing"};
export class JsonFileError extends Error {
    constructor(message: string, public outcome: "not-sent" | "unknown" = "not-sent") { super(message); }
}
export function createDurableJsonIO(request: typeof fetch = fetch) {
    const validate = (path: string) => {
        if (!/^\/data\/storage\/petal\/(siyuan-speed-switch|siyuan-checkin)\/[A-Za-z0-9._/-]+$/.test(path) || path.includes("..")) throw new JsonFileError("invalid-private-path");
    };
    const read = async <T = unknown>(path: string): Promise<JsonRead<T>> => {
        validate(path);
        let response: Response;
        try { response = await request("/api/file/getFile", {method: "POST", cache: "no-store", headers: {"Content-Type": "application/json"}, body: JSON.stringify({path})}); }
        catch { throw new JsonFileError("file-read-unavailable"); }
        if (response.status === 404) return {kind: "missing"};
        if (!response.ok) throw new JsonFileError("file-read-http-" + response.status);
        let value: T;
        try { value = JSON.parse(await response.text()) as T; } catch { throw new JsonFileError("file-json-invalid"); }
        if (value && typeof value === "object" && typeof (value as any).code === "number" && (value as any).code !== 0) throw new JsonFileError("file-read-kernel-error");
        return {kind: "present", value};
    };
    const write = async (path: string, value: unknown): Promise<void> => {
        validate(path);
        const text = JSON.stringify(value);
        if (typeof text !== "string") throw new JsonFileError("file-value-invalid");
        const form = new FormData();
        form.append("path", path); form.append("isDir", "false");
        form.append("file", new Blob([text], {type: "application/json"}), path.split("/").pop()!);
        try {
            const response = await request("/api/file/putFile", {method: "POST", body: form});
            if (!response.ok || (await response.json())?.code !== 0) throw new Error("file-write-rejected");
            const disk = await read(path);
            if (disk.kind !== "present" || JSON.stringify(disk.value) !== text) throw new Error("file-readback-mismatch");
        } catch { throw new JsonFileError("file-write-not-confirmed", "unknown"); }
    };
    return {read, write};
}
