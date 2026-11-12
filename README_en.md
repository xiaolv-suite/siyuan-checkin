<div align="center">

<img src="icon.png" width="96" alt="Lv Check-in Logo" />

# Lv Check-in

**A Local-First Habit Tracking, Event Countdown & Review Console for SiYuan**

Record your actions once, then track, review, and correlate them with your notes—all with verifiable, local-first data.

**Current version: 18.46.1**

[![Latest Release](https://img.shields.io/github/v/release/xiaolv-suite/siyuan-checkin?display_name=tag&sort=semver)](https://github.com/xiaolv-suite/siyuan-checkin/releases/latest) [![License](https://img.shields.io/github/license/xiaolv-suite/siyuan-checkin)](LICENSE)

[Latest Release](https://github.com/xiaolv-suite/siyuan-checkin/releases/latest) · [Release Notes](docs/releases/release-notes-18.46.1.md) · [Changelog](docs/v18.46.1-change-log.md) · [Documentation](docs/)

</div>

---

## What Problem Does It Solve?

In personal knowledge and habit management, check-in records are often isolated from the note-taking environment. Using external cloud apps risks vendor lock-in and privacy leaks, while manual tables in notes lack automated streaks, stats, and periodic reminders.

**Lv Check-in** brings the complete growth and action loop inside SiYuan:
- **Action Recording**: 5 flexible habit types to fit any tracking need;
- **AI Natural Language Draft**: Describe a habit in one sentence; configuration is inferred 100% locally with zero external network leakage;
- **Visual Motivation**: NextHero guidance, 38px tabular metrics, floating card architecture, and strict two-tone operational vs achievement semantic coloring;
- **Periodic Review**: Multi-level yearly heatmaps, cross-item trend comparisons, and guided weekly reviews;
- **Local-First Privacy**: 100% stored on your local disk with zero telemetry, zero cloud accounts, and zero tracking.

---

## Key Features

- **Five Habit Types**:
  - **Binary**: Yes/No completion (morning stretch, drink water, tidy desk);
  - **Duration**: Focus timer and minute recording (deep work, reading, workout);
  - **Count**: Cumulative tally (water glasses, pushup sets, breaks taken);
  - **Quantity**: Custom metric units (running km, vocabulary words, ml water);
  - **At-Most (Abstinence)**: Set an upper limit; 0 records means success, celebrating streak milestones without pressure.
- **AI Natural Language Draft (Local-First)**:
  - Enter natural phrases like "Morning run 30 minutes every day" or "Read 20 pages before bed"; rules are parsed into form fields in seconds;
  - Automatic boundary discrimination between habits (Checkin Item) and one-time dates (Occasion);
  - Capped at maximum 2 structured candidates for multi-modal habits to eliminate conversational fatigue;
  - Dual fallback for privacy: one-click self-contained prompt copying and deterministic offline rule inference.
- **Modern Today Action Console**:
  - **NextHero Card**: Highlights the single most important next action at the top;
  - **Two-Tone Color Semantics**: Operational controls use the theme Accent color; positive streaks and achievements exclusively use warm amber gold (+30° hue shift);
  - **Floating Micro-Surfaces**: Tinted canvas with 20px rounded floating white cards and multi-diffuse ambient shadows;
  - **Time Slots & Groups**: Morning, afternoon, and evening grouping with collapsible sections.
- **Review & Analytics Hub**:
  - **Yearly Heatmap**: Adaptive 4-level color gradients visualizing consistency throughout the year;
  - **Cross-Item Trends**: Compare trajectories of multiple habits sharing the same unit;
  - **Guided Weekly Review**: 3-step structured review (fact checking -> friction note -> next week's micro-adjustment) with Markdown export.
- **Occasions & Countdowns**:
  - Track birthdays, anniversaries, exams, medical checkups, and deadlines with solar and lunar calendar support;
  - Automatic countdown calculations, milestone badges ("100 days milestone"), and cycle progress bars;
  - In-place completion, single-instance rescheduling, and one-click conversion to ongoing check-in habits.
- **Integrations & Note Automation**:
  - **Automated Ingestion**: Seamlessly connect WeChat Read (reading duration, finishes, notes), Apple Health / Shortcuts (steps, weight), SiReader, SiPlayer, and YeGui LifeLog;
  - **Document Output**: Append check-ins to daily notes or maintain resident summary blocks in specified documents;
  - **Questionnaire Journal**: Built-in 3-minute prompts (gratitude, daily reflection) that save answers into journal blocks.
- **Ecosystem Federation & Omnisearch**:
  - **Omnisearch Bus**: Fast federated search across habits, daily log entries, and occasions with direct block linking;
  - **Automation Rules Engine**: IFTTT-style cross-plugin trigger and action execution (e.g. butler expiring items to check-in todos);
  - **AI Habit Resilience Coach**: In-depth 30-day analytics identifying weakest days with compassionate behavioral design guidance;
  - **Ecosystem Activity Stream**: Unified timeline consolidating activities across the series with one-click bedtime journal export.

---

## Installation

### Method 1: SiYuan Marketplace (Recommended)
1. Open SiYuan, navigate to **Settings** -> **Marketplace** -> **Plugins**;
2. Search for **小驴打卡** or **siyuan-checkin**;
3. Click **Install** and **Enable**.

### Method 2: Manual Offline Installation
1. Download `package.zip` from the [Releases](https://github.com/xiaolv-suite/siyuan-checkin/releases) page;
2. Extract the archive and rename the folder to `siyuan-checkin`;
3. Copy the folder to your SiYuan plugin directory:
   - Windows: `C:\Users\<username>\Documents\SiYuan\data\plugins\siyuan-checkin`
   - macOS: `~/Documents/SiYuan/data/plugins/siyuan-checkin`
   - Linux: `~/.config/siyuan/data/plugins/siyuan-checkin`
4. Restart SiYuan and enable the plugin in **Settings** -> **Plugins**.

---

## 3-Step Quick Start

### 1. Create your first habit
1. Click the Lv Check-in icon in the top bar or press `Alt + Shift + C`;
2. Click **+ New Item**, and type `Drink 2000 ml water daily` in the draft box;
3. Click **Generate Draft**; the system automatically fills in "Drink Water", Quantity type, 2000 target, and ml unit;
4. Click **Save Item** at the bottom.

### 2. Check in on the Today console
1. Return to the **Today** view;
2. Click the quick chip `+250ml` or click the primary record button to log your intake;
3. Reach the 2000ml goal, and the card instantly celebrates completion!

### 3. Review consistency and heatmaps
1. Switch to the **Review** panel;
2. Check your active streak in the **Overview** section;
3. Navigate to **Analysis** and watch your daily green square light up on the yearly heatmap!

---

## Panel Structure & Navigation

| Panel | Icon | Purpose |
| :--- | :---: | :--- |
| **Today** | ☀️ | Primary action console: NextHero card, progress rings, todo items, completed list, focus strip, and occasion banners. |
| **Review** | 📊 | Analytics and reflection: Overview (trends/weekly review/denominators), Records (historical logs, backfill, undo), and Analysis (heatmaps/comparisons). |
| **Insights** | 🔍 | Single-habit deep dive: 84-day status grid, weekly trends, habit maturity timeline, and actionable coaching tips. |
| **Occasions** | 📅 | Date countdowns and reminders: Manage anniversaries, solar/lunar events, reschedule, and convert to recurring habits. |
| **Archived** | 📦 | Inactive habit archive: Inspect historical rules, preview reactivation schedules, restore or permanently delete. |
| **Settings** | ⚙️ | Central configuration: Appearance, reminder slots, external sources, document outputs, and multi-bucket backup isolation. |

---

## Settings Reference (Defaults & Impacts)

Accessible via **More** -> **Settings**, organized into four clear sections:

### 1. Appearance & Operations
- **Theme (`appearance`)**: Follow system (`system`), light (`light`), or dark (`dark`). Default: `system`.
- **Color Palette (`themePalette`)**: Lavender (`lavender`), Ocean (`ocean`), Forest (`forest`), Sunset (`sunset`). Default: `lavender`.
- **Opening Mode (`defaultOpenMode`)**: Quick Dialog (`quick`) or Dedicated Tab (`tab`). Default: `quick`.
- **Reduced Motion (`reducedMotion`)**: Minimizes UI animation durations. Default: detects system preference.

### 2. Reminder Scheduling
- **Daily Reminders (`dailyReminderEnabled`)**: Master reminder switch. Default: enabled.
- **Reminder Slots (`reminderSlots`)**: Default is empty (one summary notification upon SiYuan startup). Can specify clock times like `09:00` or `21:00`.
- **Quiet Hours (`quietHours`)**: Default: `22:00 ~ 07:00`. Mutes notification popups during resting hours.

### 3. External Automatic Sources
- **WeChat Read (`weread`)**: Default: disabled. Ingests daily reading minutes (requires minute-unit item), finish marks, and notes. Default threshold: 30 minutes.
- **iOS Health Shortcuts (`health`)**: Default: disabled. Ingests steps (requires step-unit item) and weight (requires kg-unit item).
- **YeGui LifeLog (`yeguif`)**: Default: disabled. Reads paragraph notes and maps them to habits, supporting up to 200 mappings.

### 4. Document Output & Data Protection
- **Daily Note Report (`diaryReport`)**: Default: disabled. Appends summary of completed items to today's daily note on demand.
- **Resident Summary Block (`summaryResident`)**: Default: disabled. Keeps an updated check-in summary in a specific block.
- **Master JSON Backup (`backup`)**: Exports the core master store (items, events, tombstones) for portable migration.
- **Multi-bucket Backup Envelope (`backupEnvelope`)**: Exports full versioned snapshot including occasions, preferences, templates, and history.

---

## Keyboard Shortcuts

| Shortcut | Action | Context |
| :--- | :--- | :--- |
| `Alt + Shift + C` | Toggle Lv Check-in main window | Global |
| `Alt + 1` ~ `Alt + 9` | Quick record items #1 to #9 in today list | Today panel |
| `J` / `K` | Move focus down / up across habit cards | Today panel |
| `Enter` | Trigger primary record action on focused card | Habit cards |
| `Esc` | Clear search, dismiss dropdown, or close dialog | Inputs & Modals |

---

## Frequently Asked Questions (FAQ)

### Q: Can I undo an accidental check-in?
**A: Yes, anytime.**
Immediately after recording on a Today card, an **Undo** button appears. You can also visit **Review** -> **Records**, find the log entry, and click the delete button. A tombstone is automatically written to ensure streaks and metrics roll back accurately.

### Q: How do I migrate my data to a new computer?
**A: Use the built-in backup exporter.**
All plugin data resides in SiYuan's `data/storage/petal/siyuan-checkin/` folder.
- For core habits and check-in logs: go to **Settings** -> **Data & export** -> **JSON Backup**, and import on your new computer.
- For complete restoration (including custom templates, occasions, and settings): export a **Multi-bucket Backup Envelope** and import it on the new machine.

### Q: Does AI natural language drafting send my notes to the cloud?
**A: Absolutely not.**
Lv Check-in adheres strictly to local-first privacy:
- The default AI draft generator runs entirely offline using deterministic rule inference with **zero network requests and zero fees**;
- Even when using **Copy Prompt** for external LLMs, the plugin only bundles the one sentence typed in the input box—**never sending note bodies, historical check-ins, or API keys**.

---

## 📝 Recent Updates

### v18.46.1 (Latest)

- **SiYuan 3.8.10+ Native Adaptations**: Right-click embedded habit and anchor rows to invoke SiYuan's native document tree context menu (`showDocTreeNativeMenu`), automatically resolving notebook lineage.
- **Accessibility & Keyboard Parity**: Block anchor reload button supports Enter/Space keyboard activation; launchpad popover navigation yields during IME composition (ECO-015 contract); desktop hover affordances added for summary rows and energy options.
- **Mobile & Motion Polish**: Mobile 5-tab bottom navigation labels truncate cleanly on narrow viewports; editor actions bar clears iOS safe area inset; programmatic scrolling respects OS `prefers-reduced-motion` settings; viewport scroll listeners converted to passive.
- **Engineering Reliability**: Comprehensive clipboard write failure handling; dialog header z-index self-healing.

<details>
<summary>View Previous Release Highlights (18.46.0 and earlier)</summary>

### v18.46.0

Occasions 2.0/2.1 revamp with 60% card height reduction to 126px, 7 semantic categories with top capsule filters, automated native `- [ ]` task block maintenance with Task Horizon v3.3.6 bi-directional reconciliation, ecosystem-wide Omnisearch, cross-plugin IFTTT automation, and habit resilience coaching.

</details>

---

## Storage & Privacy Guarantee

- **Storage Location**:
  All files are kept strictly on your local filesystem under `data/storage/petal/siyuan-checkin/`:
  - `store.json`: Core master store (habits, immutable event logs, deletion tombstones);
  - `occasions.json`: Countdowns, anniversaries, and reminders;
  - `view-preferences.json`: UI and display preferences;
  - `reminders.json`: Reminder actions and state ledger;
  - `ai-draft-history.json`: Sanitized AI draft envelopes (capped at 20 entries with 7-day TTL).
- **Zero Telemetry**:
  100% open-source with zero analytics SDKs, trackers, or telemetry. Outbound network communication only occurs when you explicitly enable an official integration (such as WeChat Read).

---

## Compatibility & License

- **Minimum SiYuan Version**: `>= 3.8.4`
- **Supported Platforms**: Windows, macOS, Linux desktop, plus Android and iOS WebViews.
- **License**: [MIT License](LICENSE) · Free to use, adapt, and share. Your data belongs entirely to you.
