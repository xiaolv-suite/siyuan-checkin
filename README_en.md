<div align="center">

<img src="icon.png" width="96" alt="Lv Check-in Logo" />

# Lv Check-in

**A Local-First Habit, Check-in & Review Workspace for SiYuan**

Record your actions once, then track, review, and correlate them with your notes—all with verifiable, local-first data.

**Current Version: 18.41.0**

[![Latest Release](https://img.shields.io/github/v/release/ai68298100/siyuan-checkin?display_name=tag&sort=semver)](https://github.com/ai68298100/siyuan-checkin/releases/latest) [![License](https://img.shields.io/github/license/ai68298100/siyuan-checkin)](LICENSE)

[Latest Release](https://github.com/ai68298100/siyuan-checkin/releases/latest) · [Documentation](docs/README.md) · [Issue Tracker](https://github.com/ai68298100/siyuan-checkin/issues)

</div>

## Key Features

- **Local-First & Zero Telemetry**: All check-in events, item rules, and preferences are stored exclusively on your device via SiYuan's storage API. No external cloud sync or accounts required.
- **Flexible Habit Types**: Supports Binary completion, Count, Duration (minutes/hours), Custom Measurement Units, and Abstinence/At-Most goals.
- **Review & Bento Insights**: Day, Week, Month, and Custom range summaries, 4-theme yearly heatmaps, Sigmoid habit saturation curves, and energy flow cross-analysis.
- **Seamless Note Integration**: Append check-ins to daily notes in standard LifeLog format, bidirectional block deletion on undo, and automatic SiYuan 3.8.8+ Database Block Collection attributes.
- **Ecosystem Federation**: Out-of-the-box integration with Task Horizon, WeChat Read, SiReader, SiPlayer, Health Shortcuts, and Raikiri modules.

## Installation & Compatibility

- **Minimum Required SiYuan Version**: `v3.8.4` (verified on `v3.8.8+`).
- **Platforms**: Desktop (Windows, macOS, Linux), Mobile (Android, iOS), Browser WebViews.

### From SiYuan Bazaar
1. Open SiYuan **Settings → Bazaar → Plugins**.
2. Search for `小驴打卡` or `Lv Check-in` and click **Download & Install**.
3. Reload or enable the plugin from top bar or command palette.

## 30-Second Quick Start

1. Go to **New** tab, select a built-in template or enter habit name, type, target, and schedule.
2. Click **Save** and return to **Today**. Click the habit card to check in immediately, or use quick-step increments.
3. Switch to **Review** tab to view your daily streaks, calendar rhythms, and multi-dimensional analysis.

## Available Surfaces

- **Desktop Tab**: Open via Command Palette `Open Lv Check-in Tab` or configure as default view in Settings.
- **Dock Panel**: Accessible from left/bottom dock for quick side-by-side check-ins.
- **Quick Dialog**: Lightweight popup for distraction-free check-ins without leaving your current note.
- **Mobile Optimized**: Single-column responsive layout, touch-friendly 44px targets, safe area protection, and haptic feedback.

## Data Safety & Privacy

- Core check-ins and review features run 100% locally with zero cloud dependencies.
- Export options include JSON Master Backup, Multi-Bucket BackupEnvelope (v1), RFC 4180 CSV, Markdown Reports, Loop Habit Tracker, and Obsidian Habit Tracker 21.
- Sensitive fields (notes, photos, tokens) are audited before export, and diagnostic details are automatically redacted.

## License

[MIT](LICENSE)
