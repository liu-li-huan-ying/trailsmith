# TrailSmith 项目计划书（v0.1 修订版）

> **项目名称**：TrailSmith（浏览匠）
> **项目类型**：浏览器扩展（Chrome / Edge，Manifest V3）
> **版本目标**：v0.1 MVF（Minimum Viable Feature）
> **文档状态**：已通过可行性自审（v0.1 修订版）
> **最后更新**：2026-09-10
> **修订说明**：相较初版，已修正 3 处技术误区、落实必改清单、按评审结论重排里程碑。详见文末「修订摘要」与「自检清单」。

---

## 一、项目概述

### 1.1 一句话定义

> TrailSmith = **Tab Trail（标签页血缘记录器）** + **Copy Smith（复制净化层）**
> 不替你整理，只帮你**把来路记清楚、把复制弄干净**。

### 1.2 核心价值主张

| 维度 | 说明 |
|------|------|
| **用户痛点** | ① 关掉 30 个标签页后忘了自己在干什么；② 从网页复制的文字充满垃圾噪声 |
| **现有方案缺陷** | OneTab / Toby 只做收纳，不做溯源；复制粘贴需要手动清理 |
| **差异化** | 不 AI、不上传、不云同步——纯本地、零配置、装了就离不开 |
| **目标用户** | 研究者、产品经理、开发者、重度信息消费者 |

### 1.3 设计哲学

- **记录而不分析**：不做智能总结，只做忠实回溯
- **本地优先**：所有数据存 `chrome.storage.local`，不上传任何服务器
- **零打扰**：后台静默运行，只在用户主动打开 Popup 时呈现
- **规则透明**：净化规则用户可见、可编辑、可关闭

---

## 二、功能范围（MVF）

### 2.1 模块 A：Tab Trail（浏览血缘记录器）

#### 2.1.1 功能描述

自动记录每个标签页的完整生命周期，构建"浏览血缘树"。用户关闭标签页后，可以在 Popup / Side Panel 中回溯自己的浏览路径。

**记录粒度说明（v0.1）**：Tab Trail 是 **tab 级**记录——一个标签页从创建到关闭记一条 TrailRecord，期间在标签内跳转多个 URL 只记录最新 URL/标题（在 `tabs.onUpdated` 时刷新）。不做 navigation 级全量记录。这是有意为之的范围边界，见「Known Limitations」。

#### 2.1.2 采集字段

| 字段名 | 类型 | 来源 API | 说明 |
|--------|------|----------|------|
| `tabId` | string (UUID) | 自建 | 内部唯一标识（不用 Chrome 原生 tabId，避免复用冲突） |
| `url` | string | `chrome.tabs` / `tabs.onUpdated` | 页面最终 URL（onUpdated 时刷新） |
| `title` | string | `chrome.tabs` / `tabs.onUpdated` | 页面标题（onUpdated 时刷新） |
| `domain` | string | URL 解析 | 一级域名，用于聚合分析 |
| `referrerUrl` | string \| null | **由 `openerTabId` 解析出父标签页 URL** | 见 2.1.3；**`webNavigation` 不暴露 referrer，本版不使用** |
| `parentTabID` | string \| null | `tabs.Tab.openerTabId` | 父标签页 ID（`-1` 表示无父，即独立打开） |
| `searchQuery` | string \| null | URL 参数解析 | 当前页为搜索结果页时提取的关键词 |
| `searchEngine` | string \| null | URL 规则匹配 | google / bing / baidu / duckduckgo 等 |
| `openedAt` | number (timestamp) | `tabs.onCreated` | 标签页创建时间 |
| `closedAt` | number (timestamp) \| null | `tabs.onRemoved` | 标签页关闭时间（`null` = 仍在打开） |
| `activeDuration` | number (ms) | `tabs.onActivated` 累加 | 实际停留时长（**持久化累计，见 4.1**） |
| `switchCount` | number | `tabs.onActivated` 计数 | 切走/切回次数 |
| `windowId` | number | `chrome.windows` | 所属窗口（支持多窗口） |

#### 2.1.3 血缘关系与 referrer 的可靠来源

> **关键修正**：初版把 `referrerUrl` 标为来自 `webNavigation`，但 `webNavigation` 事件 `details` 中**并不包含 referrer 字段**（只有 `transitionType`、`parentFrameId` 等）。本版改为：
> - **父子关系**：完全依赖 `tabs.Tab.openerTabId`（用户从某标签 ctrl+点击 / 链接新开标签时由浏览器填充）。这是浏览器原生、可靠、零额外权限的来源。
> - **referrerUrl**：记录时，由 `openerTabId` 查到父 TrailRecord 的 `url` 写入。对"在 Google 搜 X → 点开知乎"这类点击链，能完整复现血缘树（见 2.1.4 示例），**无需 `webRequest`**。
> - 手动在地址栏输入新标签、或从书签打开：`openerTabId === -1`，无父节点，树中出现独立根。这是预期行为。
- **解析实现要点**：每条记录持久化存储自身的 `chromeTabId`（Chrome 原生 tabId）。新建标签时，用事件的 `openerTabId`（也是原生 tabId）反查「拥有相同 `chromeTabId` 且 `closedAt === null` 的 TrailRecord」，取其内部 `id` 作为 `parentId`（限定未关闭记录，避免 tabId 复用命中旧记录）。这样即便 SW 被回收，映射也不依赖内存状态，可直接从 `storage.local` 查出。

#### 2.1.4 搜索词提取规则

| 搜索引擎 | URL 模式 | 提取参数 |
|----------|----------|----------|
| Google | `https://www.google.com/search?q=...` | `q` |
| Bing | `https://www.bing.com/search?q=...` | `q` |
| Baidu | `https://www.baidu.com/s?wd=...` | `wd` |
| DuckDuckGo | `duckduckgo.com/?q=...` | `q` |
| 知乎搜索 | `https://www.zhihu.com/search?q=...` | `q` |
| GitHub 搜索 | `https://github.com/search?q=...` | `q` |

> 仅对**当前页自身 URL**做解析。搜索结果页自身成为血缘树的根节点，其下游子页通过 `openerTabId` 挂接。

#### 2.1.5 血缘树构建逻辑

```
遍历所有 trail 记录 → 按 parentTabId 建立父子关系 → 按 openedAt 排序 → 输出树形结构
```

**示例输出**：

```
Google（搜索"注意力训练"）
├── 知乎回答：《如何系统训练注意力？》
│   ├── arXiv 论文 PDF：《Attention Mechanisms in Deep Learning》
│   │   └── 淘宝：注意力训练卡片（同款书）
│   └── B站视频：《10分钟注意力训练指南》
└── 豆瓣：《深度工作》书评
    └── 微信读书：《深度工作》在线阅读
```

> 注：示例中「Google」节点由其自身搜索 URL 解析出 `searchEngine=google` + `searchQuery=注意力训练`；「知乎/arXiv/B站」等子节点通过 `openerTabId` 指向 Google 标签。无需任何 referrer 嗅探。

#### 2.1.6 隐私过滤

以下页面**不记录**或**脱敏处理**：

| 规则 | 处理方式 |
|------|----------|
| URL 匹配私有 IP / localhost | 跳过 |
| URL 包含 `password` / `login` / `auth` | 只记录域名，URL 参数清空 |
| 银行 / 支付类域名（支付宝、微信支付等） | 跳过 |
| `incognito` 隐身窗口 | 默认跳过（可配置开启） |
| 用户自定义黑名单域名 | 跳过 |

---

### 2.2 模块 B：Copy Smith（复制净化层）

#### 2.2.1 功能描述

在用户从任意网页执行 `Ctrl+C` / 右键复制时，自动对剪贴板内容进行清洗和格式化，无需用户手动操作。

> **范围确认（v0.1）**：Copy Smith 的主战场是**网页正文复制**。Chrome 内置 PDF 查看器（`chrome-extension://…`）不会注入 content script，故「从内置 PDF 查看器复制」不在 v0.1 支持范围，见「Known Limitations」。

#### 2.2.2 净化规则（v0.1）

| 规则 ID | 名称 | 默认状态 | 实现方式 |
|---------|------|----------|----------|
| `R001` | 移除常见模板噪声 | ✅ 开 | 正则匹配 + DOM 文本分析 |
| `R002` | 中文引号统一 | ✅ 开 | `"..."` → `"..."` |
| `R003` | 软换行修复（通用） | ✅ 开 | 检测行尾非句末、下行首小写/中文的断行并合并为空格（**原为"PDF 换行修复"，改为通用规则，覆盖网页复制中的软换行**） |
| `R004` | 代码块缩进保留 | ✅ 开 | 检测 `<pre>` / `<code>` 上下文 |
| `R005` | 多余空行压缩 | ✅ 开 | 3+ 连续换行 → 2 个换行 |
| `R006` | Markdown 化（实验性） | ❌ 关 | 标题/列表自动转 Markdown |
| `R007` | 表格结构保留 | ❌ 关 | 复制表格时保留 TS 格式 |

#### 2.2.3 噪声模式库（R001）

```javascript
// 默认内置模式，用户可增删
const DEFAULT_NOISE_PATTERNS = [
  /关注我们.*?\n/g,
  /展开剩余\d+条?/g,
  /版权所有.*?\n/g,
  /转载请注明.*?\n/g,
  /点击上方.*?关注/g,
  /扫码.*?公众号/g,
  /广告\s*$/g,
  /^\s*[\d]+\s*评论\s*$/gm,
  /分享到.*?(?=\n|$)/g,
  // ... 可扩展
];
```

#### 2.2.4 软换行修复算法（R003，通用）

> **重定义**：移除「PDF 特有」前提，改为对任意复制文本生效。

```
输入：从网页复制的原始文本
检测：
  - 行尾不是句号 / 问号 / 感叹号 / 冒号等句末标点
  - 下一行首字符是小写字母或中文（非新段落起手的大写/数字/项目符号）
处理：
  - 将此类换行替换为空格
  - 保留段落间的空行
```

#### 2.2.5 技术实现要点（已修正）

- **Content Script** 注入所有页面（manifest `content_scripts`，`run_at: document_idle`）
- 监听 `document.addEventListener('copy', ...)`
- 在 `clipboardData.setData()` 之前修改数据：`event.clipboardData.setData('text/plain', cleaned); event.preventDefault();`
- **不使用 MutationObserver**：`copy` 事件由浏览器在用户触发复制时派发，与 DOM 是否变化无关，Observer 对捕获复制毫无帮助（初版此处为误解，已删除）
- 选区 DOM 上下文（是否在 `<pre>/<code>` 内）通过 `window.getSelection().anchorNode` 判断，用于 R004 代码块缩进保留

#### 2.2.6 冲突处理

| 场景 | 策略 |
|------|------|
| 用户按 `Ctrl+Shift+C`（强制原始复制） | 跳过净化（复制时检测 modifier 状态） |
| 用户在输入框 / `contenteditable` 内复制（非网页正文） | 跳过净化（选区锚点在 input/textarea/contenteditable 内则跳过） |
| 检测到复制内容为纯代码（>80% 行是代码） | 只保留缩进，不做文本清洗 |

---

## 三、技术架构

### 3.1 项目结构

```
trailsmith/
├── manifest.json                    # MV3 配置
├── background/
│   ├── service-worker.js            # 后台入口
│   ├── tab-tracker.js               # Tab Trail 采集逻辑（含 lastActive 持久化）
│   ├── storage-manager.js           # chrome.storage 封装（含容量监控/清理）
│   └── rule-engine.js               # Copy Smith 规则引擎（后台部分，可选）
├── content/
│   ├── copy-cleaner.js              # Copy Smith 核心（注入页面）
│   └── content.css                  # 页面内样式（如有）
├── popup/
│   ├── popup.html                   # Popup 页面
│   ├── popup.js                     # Popup 逻辑
│   ├── trail-tree.js                # 树状图渲染
│   └── popup.css
├── side-panel/                      # v0.2 预留，v0.1 不实现
│   ├── panel.html
│   └── panel.js
├── options/
│   ├── options.html                 # 设置页
│   ├── options.js                   # 规则编辑、黑名单管理
│   └── options.css
├── lib/
│   ├── tree-builder.js              # 血缘树构建算法
│   ├── search-engine-parser.js      # 搜索引擎 URL 解析
│   ├── privacy-filter.js            # 隐私过滤规则
│   ├── time-utils.js                # 时间格式化
│   └── constants.js                 # 全局常量
├── icons/
└── README.md
```

### 3.2 Manifest V3 配置（关键字段，已修正权限）

```json
{
  "manifest_version": 3,
  "name": "TrailSmith",
  "version": "0.1.0",
  "description": "Tab Trail + Copy Smith — 浏览血缘记录 + 复制净化",
  "permissions": [
    "tabs",
    "storage"
  ],
  "optional_permissions": [
    "sidePanel"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/copy-cleaner.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": "icons/icon-128.png"
  },
  "options_page": "options/options.html"
}
```

> **权限变更说明**：
> - 移除 `webNavigation`：本版血缘完全基于 `openerTabId` + `tabs.onUpdated`，不再需要该权限，减小审核面。
> - 未引入 `webRequest` / `scripting`：Referrer 与 PDF 注入均不依赖，保持最小权限。
> - `host_permissions: <all_urls>` 保留：Copy Smith 需在任意网页注入 content script 做复制净化，这是功能必需；在商店审核中需说明"仅用于本地剪贴板清洗，不收集数据"。

### 3.3 数据模型

#### 3.3.1 Trail 记录

```typescript
interface TrailRecord {
  id: string;              // UUID（内部唯一标识）
  chromeTabId: number;     // Chrome 原生 tabId，用于解析 openerTabId → parentId
  url: string;             // 页面 URL（onUpdated 时刷新）
  title: string;           // 页面标题（onUpdated 时刷新）
  domain: string;          // 一级域名
  referrerUrl: string | null;  // 由 openerTabId 解析出的父标签页 URL
  parentId: string | null; // 父 TrailRecord.id（openerTabId 映射；-1 → null）
  searchQuery: string | null;
  searchEngine: string | null;
  openedAt: number;        // timestamp
  closedAt: number | null; // null = 仍在打开
  activeDuration: number;  // 毫秒（持久化累计）
  switchCount: number;
  windowId: number;
}
```

#### 3.3.2 净化规则配置

```typescript
interface CleanRule {
  id: string;
  name: string;
  enabled: boolean;
  pattern?: string;        // 正则字符串（用户自定义时用 new RegExp 重建，需校验合法性）
  flags?: string;
  description: string;
  builtin: boolean;        // true = 内置，不可删除
}

interface CopySmithConfig {
  enabled: boolean;
  rules: CleanRule[];
  preserveCodeBlocks: boolean;
  normalizeQuotes: boolean;
  fixSoftLineBreaks: boolean;   // 原 fixPdfLineBreaks
  skipInputFields: boolean;
  hotkeyBypass: string;    // 默认 "Ctrl+Shift+C"
}
```

#### 3.3.3 存储方案

| 数据类型 | 存储位置 | 清理策略 |
|----------|----------|----------|
| Trail 记录 | `chrome.storage.local` | 默认保留 7 天，可配置（1天 / 7天 / 30天 / 永久）；**清理时排除 `closedAt === null`（仍在打开）的记录** |
| Copy Smith 配置 | `chrome.storage.sync` | 永久（支持多设备同步配置） |
| 规则自定义 | `chrome.storage.sync` | 永久 |

**存储上限注意**：`chrome.storage.local` 上限约 **10MB**（Chrome/Edge MV3；Firefox 约 5MB，但本版不支持）。需做容量管理和自动清理：
- 写入前用 `chrome.storage.local.getBytesInUse()` 监控占用；
- 接近上限时优先清理最旧记录，并可在 Popup 提示用户调整保留期；
- 单条记录仅存文本字段（无截图/无 DOM 快照），7 天数据远低于 3MB。

---

## 四、关键流程

### 4.1 Tab Trail 采集流程

```
┌──────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│ tabs.onCreated  │────▶│  创建 TrailRecord         │────▶│ storage.local │
└──────────────┘     │  - 生成 UUID              │     └──────────────┘
                     │  - 解析 openerTabId→parentId│
                     │  - 当前页是搜索结果页则解析 searchQuery │
                     └──────────────────────────┘

┌──────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│ tabs.onUpdated  │────▶│  刷新 url / title        │────▶│ storage.local │
│ (status=complete)│    │  （同标签内跳转时更新）    │     └──────────────┘
└──────────────┘     └──────────────────────────┘

┌──────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│ tabs.onRemoved  │────▶│  更新 closedAt           │────▶│ storage.local │
└──────────────┘     │  - 结算最后一段停留时长    │     └──────────────┘
                     └──────────────────────────┘

┌────────────────┐     ┌──────────────────────────────────────┐
│ tabs.onActivated  │────▶│  维护"每标签最后活跃时间"映射（持久化）  │
└────────────────┘     │  - 上一个 active 标签:                  │
                       │      activeDuration += (now - lastActive)│
                       │  - 当前标签:                             │
                       │      switchCount++                       │
                       │      lastActive = now                    │
                       │  - 映射写入 storage.local（SW 无状态）    │
                       └──────────────────────────────────────┘
```

> **Service Worker 无状态处理（必改项已落实）**：MV3 的 SW 随时可能被休眠/唤醒，不能依赖内存状态。实现要点：
> - 持久化两个状态：`lastActiveMap`（trailId → 上次活跃时间戳）与 `currentActiveTabId`（当前活跃标签的 trailId），均存 `storage.local`，SW 启动时水合；
> - 每次 `onActivated(newTab)`：若 `currentActiveTabId` 存在且 ≠ newTab，则 `lastActiveMap[prev] += now - lastActiveMap[prev]`；再置 `lastActiveMap[newTab] = now`、`currentActiveTabId = newTab`；一次性写回；
> - 标签关闭（`onRemoved`）时结算该标签最后一段时长，并从映射中清除；
> - 父标签解析（见 2.1.3）仅匹配 `closedAt === null` 的记录，避免 Chrome 复用 tabId 命中已关闭旧记录；
> 这样即便 SW 在两次激活之间被回收，时长累计与血缘解析都不依赖内存状态。

### 4.2 Copy Smith 净化流程

```
用户 Ctrl+C
    │
    ▼
copy 事件触发
    │
    ▼
[是否跳过？] ── 是（输入框/contenteditable/快捷键绕过/黑名单域名）──▶ 原样复制
    │ 否
    ▼
[提取选中文本 + 选区 DOM 信息（是否 <pre>/<code>）]
    │
    ▼
[规则引擎串行执行]
    ├── R001: 移除噪声模式
    ├── R002: 引号统一
    ├── R003: 软换行修复
    ├── R004: 代码块缩进保留
    ├── R005: 空行压缩
    └── ...
    │
    ▼
[写入 clipboardData + preventDefault]
    │
    ▼
[可选：popup badge / toast "已净化 ×× 处"]
```

### 4.3 实现注意事项（v0.1 易踩坑点，M2/M4 落地时对照）

- **`onUpdated` 必须加守卫**：该事件在多阶段导航中会频繁触发，仅当 `changeInfo.status === 'complete'` 且 `url`/`title` 实际变化时才写 storage，避免无谓写入与死循环。
- **黑名单需跨模块共享**：Options 的黑名单域名应同时作用于 Tab Trail（不记录）与 Copy Smith（不净化），存储为同一份配置，两处读取。
- **tree-builder 需防环**：父链解析若因异常（如 tabId 复用竞态）出现环，构建时必须用 visited set 截断，避免 Popup 渲染死循环。
- **首屏活跃标签需播种**：SW 首次启动 / 安装后，主动 `tabs.query({active:true})` 播种 `currentActiveTabId` 与各标签 `lastActive`，否则首个被切走的标签时长会从 0 计或被吞。
- **keepAlive 非必需**：每个事件原子化处理并立即写 storage，无需常驻保活；仅当单事件处理链过长（如超大数据写入）才考虑 `chrome.alarms` 心跳。
- **初始活跃标签的 `copy` 监听时机**：content script `run_at: document_idle` 已足够；若发现极早期复制丢失，可改 `document_start` 并在 `DOMContentLoaded` 后挂监听。

---

## 五、Popup / Side Panel UI 设计

### 5.1 Popup 布局（默认 360×600）

```
┌─────────────────────────────────────┐
│  🧭 TrailSmith              [⚙️设置] │
├─────────────────────────────────────┤
│  📊 今日概览                         │
│  活跃标签: 23 条   浏览链: 5 条       │
│  复制净化: 12 次                      │
├─────────────────────────────────────┤
│  🌳 最近浏览血缘                     │
│                                     │
│  🔍 Google: "注意力训练"             │
│   ├── 知乎：《如何系统训练注意力》     │
│   │   ├── arXiv: Attention...        │
│   │   └── B站：10分钟训练指南         │
│   └── 豆瓣：《深度工作》书评          │
│                                     │
│  🔍 Baidu: "react 性能优化"          │
│   ├── GitHub: react-window           │
│   └── 掘金：前端性能优化实践          │
│                                     │
├─────────────────────────────────────┤
│  [查看完整树 →]  [导出 JSON]         │
└─────────────────────────────────────┘
```

### 5.2 交互设计

| 交互 | 行为 |
|------|------|
| 点击树节点 | 在新 Tab 中重新打开该 URL |
| 右键节点 | 显示菜单：复制 URL / 删除记录 / 标记为重要 |
| 搜索框 | 按关键词/域名/时间过滤 |
| 时间范围切换 | 今天 / 昨天 / 最近 7 天 / 全部 |

---

## 六、Side Panel 完整视图（v0.2 预览）

> v0.1 以 Popup 为主要展示入口；v0.2 起提供 Side Panel，承载更大画布的浏览分析。此处仅做架构预留，不影响 v0.1 交付。

### 6.1 架构定位

```
┌─────────────────────────────────────────┐
│  TrailSmith Side Panel（v0.2+）         │
│  ┌───────────────────────────────────┐  │
│  │  📊 今日浏览摘要                  │  │
│  │  [切换：树状图 / 时间轴 / 列表]    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
             │ 读取 chrome.storage.local
             ▼
┌─────────────────────────────────────────┐
│  TrailSmith 插件（后台常驻）             │
│  • Tab Trail 采集                        │
│  • Copy Smith 净化                       │
│  • 数据写入 chrome.storage.local         │
└─────────────────────────────────────────┘
```

### 6.2 与 Popup 的关系

| 入口 | 定位 | 说明 |
|------|------|------|
| **Popup** | v0.1 主入口 | 轻量、快速查看、360×600 |
| **Side Panel** | v0.2+ 增强入口 | 大画布、多视图、详细操作 |

v0.1 只需在 Manifest 中预留 `sidePanel` 可选权限，无需实现完整面板。

---

## 七、开发里程碑（有序清单，不含时间安排）

> 按你的要求，本版**不排周数、不计入商店审核排队时间**，仅以"开发顺序 + 验收标准"表达。AI 辅助开发节奏自定。

| 阶段 | 交付物 | 验收标准 |
|------|--------|----------|
| **M1：项目脚手架** | MV3 工程骨架 + 构建配置 | 能加载到 Chrome 开发者模式 |
| **M2：Tab Trail 采集** | `tab-tracker.js` + 数据存储 + `lastActive` 持久化 | 能完整记录 50+ Tab 的生命周期，停留时长累计准确（SW 回收后不丢） |
| **M3：树状图渲染** | Popup + `trail-tree.js` | 能正确展示 3 层以上血缘树（基于 openerTabId） |
| **M4：Copy Smith 净化** | `copy-cleaner.js` + 默认规则（R001–R005） | 在 10 个主流网站测试通过，软换行修复生效 |
| **M5：设置页 + 规则编辑** | Options Page | 用户可增删规则（正则合法性校验）、管理黑名单 |
| **M6：隐私过滤 + 数据清理** | `privacy-filter.js` + 自动清理 | 敏感页面不记录；过期数据自动清理且排除未关闭标签 |

---

## 八、后续迭代方向（v0.2+）

| 版本 | 功能 | 说明 |
|------|------|------|
| v0.2 | Side Panel 完整视图 | 替代 Popup，支持更大画布 |
| v0.2 | 时间轴模式 | 除了树状图，增加时间线视图 |
| v0.3 | 粘贴守卫（原计划功能二） | 检测粘贴内容中的密钥/环境变量 |
| v0.3 | 导出功能增强 | Markdown / JSON / Obsidian 格式 |
| v0.4 | 网页时间切片（原计划功能三） | DOM 摘要定时采集 + diff 展示 |
| v0.5 | 规则市场 | 用户分享净化规则（纯本地导入导出） |
| 待定 | 内置 PDF 查看器复制净化 | 需 `chrome.scripting.executeScript` 主动注入，详见 Known Limitations |

---

## 九、验收标准（Definition of Done）

### 9.1 v0.1 必须达成

- [ ] 安装后无需任何配置即可开始记录
- [ ] 打开 10 个有层级关系的 Tab（通过链接新开），Popup 中正确展示血缘树
- [ ] 关闭所有 Tab 后，Popup 中仍可回溯完整路径
- [ ] 从 5 个不同网站复制文本，净化结果符合预期（含软换行修复）
- [ ] 隐私过滤生效（登录页、支付页不记录）
- [ ] SW 多次休眠/唤醒后功能正常、无内存泄漏；停留时长累计准确（含首屏播种与 `currentActiveTabId` 持久化）
- [ ] 存储占用 < 3MB（7 天数据）；清理逻辑不误删仍在打开的标签

### 9.2 不应做的事（Non-Goals）

- ❌ 不接入任何 AI / LLM API
- ❌ 不做云同步 / 账号系统
- ❌ 不上传任何用户数据
- ❌ 不做"智能推荐"
- ❌ 不支持 Firefox / Safari（v1.0 后再考虑）

---

## 十、附录

### A. 权限说明（面向用户）

| 权限 | 用途 | 数据去向 |
|------|------|----------|
| `tabs` | 记录 Tab 的创建/关闭/切换/更新 | 仅本地 |
| `storage` | 保存记录和配置（local + sync） | 仅本地 |
| `<all_urls>` (host) | Copy Smith 需要在所有页面注入净化逻辑 | 不收集，仅本地剪贴板清洗 |

> 相较初版，已移除 `webNavigation` 权限（血缘改由 `openerTabId` 实现）。

### B. 竞品对比

| 产品 | 核心功能 | 缺什么 |
|------|----------|--------|
| OneTab | 标签收纳 | 不记录来源关系 |
| Toby | 可视化标签管理 | 不记录浏览路径 |
| The Great Suspender | 标签休眠 | 不记录历史 |
| Copy as Markdown | 复制格式化 | 只做 Markdown，不做噪声清理 |
| 手动复制粘贴 | 啥都干 | 累 |

**TrailSmith 的独特定位**：既记录"你怎么来的"，又帮你"把拿到的弄干净"——两个动作之间天然连贯。

---

## 十一、Known Limitations（v0.1 明确边界）

| 限制 | 说明 |
|------|------|
| **Tab 级而非 Navigation 级** | 同一标签内多次跳转只记录最新 URL/标题；不记录中间每一步导航 |
| **内置 PDF 查看器不净化** | Chrome 内置 PDF 查看器（`chrome-extension://`）不注入 content script，从中复制不触发净化；网页内嵌 PDF / PDF.js 站点正常。R003 改为通用软换行修复以覆盖网页场景 |
| **手动/书签打开无父链** | `openerTabId === -1` 时不建立父子关系，成为独立根节点 |
| **仅 Chrome / Edge（MV3）** | 不支持 Firefox / Safari |
| **隐身窗口默认跳过** | 需用户在设置中手动开启 |

---

## 十二、修订摘要（v0.1 修订版 vs 初版）

| # | 初版问题 | 修订动作 |
|---|----------|----------|
| 1 | `referrerUrl` 来源标为 `webNavigation`，但该 API 不暴露 referrer | 改为基于 `openerTabId` 解析父标签 URL；移除 `webNavigation` 权限 |
| 2 | R003「PDF 换行修复」依赖 content script，但内置 PDF 查看器不注入，反而抓不到 | R003 改为通用「软换行修复」，覆盖网页复制；内置 PDF 查看器列入 Known Limitations |
| 3 | 「用 MutationObserver 确保动态页面捕获 copy」是误解 | 删除该表述；copy 事件本身与 DOM 变更无关 |
| 4 | SW 无状态导致 `activeDuration` 累计易丢 | 新增 `lastActive` 映射持久化方案（4.1） |
| 5 | 7 天清理可能误删仍在打开的标签 | 清理时排除 `closedAt === null` |
| 6 | 未说明记录粒度 | 明确为 tab 级（2.1.1 / Known Limitations） |
| 7 | 里程碑绑定周数并计入商店审核 | 改为有序清单，不含时间安排与审核排队 |

---

## 十三、自检清单（可行性自审通过判据）

- [x] **referrer 误区已修正**：血缘完全由 `openerTabId` 驱动，不依赖任何不暴露 referrer 的 API
- [x] **PDF 盲区已诚实处理**：R003 去 PDF 特化，内置查看器列入 Known Limitations
- [x] **MutationObserver 误解已删除**
- [x] **SW 无状态陷阱已给方案**：`lastActive` 持久化
- [x] **清理边界已修正**：排除未关闭标签
- [x] **权限最小化**：移除 `webNavigation`，未引入 `webRequest`/`scripting`
- [x] **排期幻觉已去除**：无周数、无商店审核承诺
- [x] **示例血缘树可由 openerTabId 真实复现**：已验证逻辑自洽

### 十三（续）：第二轮自审修正（挑刺方回马枪）

- [x] **父标签解析限定 `closedAt === null`**：规避 Chrome tabId 复用命中已关闭旧记录
- [x] **`activeDuration` 补齐 `currentActiveTabId` 持久化指针**：否则 SW 回收后不知该给谁结算时长
- [x] **4.1 与 2.1.4 矛盾已消除**：删除"继承搜索上下文"，改为仅当前页自身解析 searchQuery
- [x] **storage.local 上限更正为 ~10MB**（初版误写 5MB）
- [x] **补 4.3 易踩坑点**：onUpdated 守卫、黑名单跨模块共享、tree 防环、首屏播种、keepAlive 非必需
- [x] **DoD 措辞对齐 MV3**："连续运行"改为"SW 反复休眠/唤醒后正常"
