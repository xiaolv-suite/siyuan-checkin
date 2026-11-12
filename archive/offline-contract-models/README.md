# 离线契约评估模型归档（2026-10-31）

这里存放 25 个从 `src/features/` 移出的模块和 26 个对应测试。它们在移出时**运行时零引用**（没有任何生产代码 import），只被各自的测试调用，Webpack 也会把它们摇树剔除。

移出原因见 [`docs/DIRECTION-2026-10-31.md`](../../docs/DIRECTION-2026-10-31.md)：它们让类型检查、测试链和阅读成本变大，却不影响任何用户可见行为。

- `src-features/`：原 `src/features/*.ts`，内容未改。其中的相对 import（如 `../occasions`、`./lifelog-timeline`）指向移出时的 `src/` 结构，不再参与编译。
- `tests/`：原 `tests/*.test.cjs`，内容未改；已从 `package.json` 测试脚本中摘除，路径按原位置写死，不能在这里直接运行。

需要恢复某个模型时：把文件移回 `src/features/` 与 `tests/`，把测试加回 `package.json`，并在接入真实 UI 前先确认它解决的是用户可感知的问题。

未归档的例外：`src/features/tombstone-lifecycle.ts` 虽然也没有被运行时引用，但它的测试是 `model.ts` 中 `pruneEventTombstones`（外部来源墓碑保活）唯一的行为测试，因此保留原位。
