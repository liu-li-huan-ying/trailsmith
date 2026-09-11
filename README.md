# TrailSmith（浏览匠）

浏览器扩展（Chrome / Edge，Manifest V3）。

> **Tab Trail（浏览血缘记录器）** + **Copy Smith（复制净化层）**
> 不替你整理，只帮你把来路记清楚、把复制弄干净。纯本地、零配置、不上传。

## 功能

- **Tab Trail**：自动记录每个标签页生命周期（创建/跳转/切换/关闭），基于 `openerTabId` 构建浏览血缘树，Popup 中可回溯。搜索起点（Google/Bing/百度/…）会自动标记，方便看出「这句话是我从哪儿搜出来的」。
- **Copy Smith**：从任意网页 `Ctrl+C` 时自动清洗剪贴板。`Ctrl+Shift+C` 强制原始复制。

### 净化规则

| ID | 名称 | 说明 |
|----|------|------|
| R001 | 清理模板噪声 | 移除「关注我们 / 扫码关注 / 展开剩余」等页面模板文案 |
| R002 | 中文引号统一 | 英文直引号 → 中文弯引号 |
| R003 | 软换行修复 | 合并句中被打断的换行 |
| R004 | 代码块保护 | 命中 `<pre>` / `<code>` 时只压缩空行 |
| R005 | 空行压缩 | 3+ 连续换行 → 1 个空行 |

全部规则可在设置页逐条开关，`rules[].enabled` 是唯一事实源。

## 当前状态

- 版本：`v0.1.2`
- 已实现：MV3 工程骨架、Tab Trail 采集与血缘树、Copy Smith R001–R005、Popup 与 Options 界面（浅色/深色双主题）。
- **已通过端到端实测**：用无头 Edge + CDP 把扩展真实装进浏览器跑通全链路（开标签 / 开子标签 / 关标签 / 构造复制），28 项断言全绿；引用完整性 44 条全命中。详见 `PLAN.md` 第十五节。
- 隐私过滤覆盖：私有 IP / localhost、非网页协议（`chrome-extension:` / `about:` / `file:`）、登录类参数、支付类域名、隐身窗口、自定义黑名单。
- 待补：Side Panel（v0.2）、粘贴守卫（v0.3）、商店上架材料。
- 计划书见 `PLAN.md`（含三轮对抗式可行性自审 + v0.1.1 界面重做 + v0.1.2 缺陷修复记录）。

## 开发加载

1. `chrome://extensions` → 开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择本目录
3. 固定扩展后点击图标打开 Popup；右键扩展 → 选项 进入设置页

## 结构

```
manifest.json
icons/        16/32/48/128 图标（SVG 为源，PNG 由无头 Edge 栅格化）
background/   service-worker / tab-tracker / storage-manager / lock(串行锁)
content/      copy-cleaner（注入页面）
lib/          theme(设计令牌) / constants / time-utils / search-engine-parser / privacy-filter / tree-builder
popup/        Popup 页面、指标带与血缘树渲染
options/      设置页
```

## 已验证

| 工具 | 作用 |
|------|------|
| `checkrefs` | 校验 manifest / HTML / JS 里所有相对引用真实存在 |
| `e2e` | 无头 Edge + CDP 端到端：血缘树、父链、关闭结算、隐私过滤、Popup 渲染、Copy Smith 净化 |

## 界面

近单色 + 发丝线 + 排版驱动的设计语言，令牌集中在 `lib/theme.css`，Popup 与 Options 共用，跟随系统浅色/深色自动切换。详见 `PLAN.md` 第 5.3 节。
