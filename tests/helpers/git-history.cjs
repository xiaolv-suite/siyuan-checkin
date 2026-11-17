const cp = require("node:child_process");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

/**
 * 读取历史提交中的源码（供红证对照断言使用）。
 * 在 release-main 等孤儿单提交公开快照分支下，历史提交不在 git 对象库中，返回 null 以便安全跳过。
 */
function tryGitShow(spec) {
    try {
        const colonIdx = spec.indexOf(":");
        const commit = colonIdx >= 0 ? spec.slice(0, colonIdx) : spec;
        cp.execSync(`git cat-file -e ${commit}^{commit}`, { cwd: REPO_ROOT, stdio: "ignore" });
        return cp.execSync(`git show ${spec}`, { cwd: REPO_ROOT, encoding: "utf8" });
    } catch {
        return null;
    }
}

module.exports = { tryGitShow };
