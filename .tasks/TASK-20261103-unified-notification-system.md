# [TASK-20261103-unified-notification-system] 小驴打卡 · 全生态去中心化统一通知系统接入任务

- **任务状态**: `completed`
- **目标插件**: `小驴打卡 (siyuan-checkin)`
- **仓库路径**: `D:/思源插件/小驴打卡`
- **生态标准核源文件**: `D:思源插件小驴快门siyuan-quickgatedocslv-notice-kit.ts`
- **标准协议**: Epoch 7 · 去中心化自协商 (Protocol v1.0.0)

---

## 一、 背景与设计目标

为了终结小驴全系列插件各自弹窗导致的“Toast 瀑布刷屏”、“报错无法回溯”、“通知过频打扰”等痛点，小驴生态已制定并落地了去中心化统一通知套件：
1. **绝对去中心化自协商**：零强依赖任何单一插件，谁先启动谁当 Coordinator，高版本自动热替换，卸载时平滑交棒，无孤儿 DOM；
2. **四级渐进降噪**：
   - `inline`（原位微动效）：复制/收藏等操作坚决不弹窗，直接在按钮上微弹反馈；
   - `capsule`（瞬时微胶囊）：常规简短提示，2.5s 自然淡出，余光可感知；
   - `card`（交互卡片）：重点到期提醒，支持【稍后提醒 15m/1h】、【今日免打扰】与操作跳转；
   - `silent`（静默入库）：后台自动保存/同步，全程零弹窗，仅进历史记录。
3. **全端自适应**：桌面端右下角 3D 毛玻璃悬浮卡片；手机端（<=640px）自适应为顶部灵动微条，避让刘海屏并支持上滑划走；
4. **同类消息自动计数折叠**：3 秒内高频消息自动变为 `×2`、`×3`，绝不刷屏。

---

## 二、 本插件专门改造重点

1. **已有资产**：已在 `src/render/lv-notice-kit.ts` 就绪。
2. **每日提醒改造**：在 `src/render/reminder-delivery.ts` 中，将后台悬浮提醒逻辑对接到 `lvNotify.card`，支持“15分钟后再提醒”和“今日免打扰”。
3. **日常反馈降噪**：打卡成功、撤销等瞬时反馈升级为 `lvNotify.capsule`；原位点击操作使用 `lvNotify.inline`；高频批量导入自动折叠。

---

## 三、 推荐落地实施步骤 (3步平滑改造)

### 步骤 1：引入标准核
复制标准核心文件到本插件源码目录：
```bash
cp "D:/思源插件/小驴快门/siyuan-quickgate/docs/lv-notice-kit.ts" "D:/思源插件/小驴打卡/src/libs/lv-notice-kit.ts"
```
*(若打卡已有则直接使用)*

### 步骤 2：生命周期注册与交棒
在插件主类 `onload` 中注册，在 `onunload` 中注销：
```typescript
import { lvNotify } from "./libs/lv-notice-kit";

// onload 结尾：
this.noticeHubCleaner = lvNotify.registerPlugin("siyuan-checkin");

// onunload 开头：
this.noticeHubCleaner?.();
this.noticeHubCleaner = undefined;
```

### 步骤 3：统一出口智能拦截（无需改动全量业务代码）
在公共通知包装器（如 `showMessage`）中接入智能分流：
```typescript
function showMessage(message: string, timeout = 3000, type: "info" | "error" = "info") {
    if (type === "error") {
        lvNotify.card({
            source: "小驴打卡",
            title: "小驴打卡提示",
            message,
            level: "error",
            duration: Math.max(timeout, 6000),
        });
    } else {
        lvNotify.capsule({
            source: "小驴打卡",
            message,
            duration: timeout,
        });
    }
}
```
对于复制、收藏等特定高频前台操作，逐步替换为 `lvNotify.inline(btnElement, "已复制")`。

---

## 四、 质量门禁与验收标准 (Quality Gate)

1. **类型检查**：运行 `pnpm run check` 或 `tsc --noEmit`，确保 0 TS 错误；
2. **测试门禁**：运行 `pnpm test`（或对应测试脚本），确保全量单测 100% 通过；
3. **打包构建**：运行 `pnpm run build`，确保生产构建正常；
4. **本地 Git 规范**：严格执行**仅本地 commit**（Conventional Commit，如 `feat(notice): integrate ecosystem unified notice kit`），**绝不执行 git push**（GitHub 冻结保护）。
5. **任务状态回写**：完成后将本文档首部的 `- **任务状态**: `pending`` 改为 `completed`。
