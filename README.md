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

- 版本：`v0.1.1`
- 已实现：MV3 工程骨架、Tab Trail 采集与血缘树、Copy Smith R001–R005、Popup 与 Options 界面（浅色/深色双主题）。
- 待补：Side Panel（v0.2）、粘贴守卫（v0.3）、真实浏览器内加载验证。
- 计划书见 `PLAN.md`（含三轮对抗式可行性自审 + v0.1.1 界面重做记录）。

## 开发加载

1. `chrome://extensions` → 开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择本目录
3. 固定扩展后点击图标打开 Popup；右键扩展 → 选项 进入设置页

## 结构

```
manifest.json
background/   service-worker / tab-tracker / storage-manager
content/      copy-cleaner（注入页面）
lib/          theme(设计令牌) / constants / time-utils / search-engine-parser / privacy-filter / tree-builder
popup/        Popup 页面、指标带与血缘树渲染
options/      设置页
```

## 界面

近单色 + 发丝线 + 排版驱动的设计语言，令牌集中在 `lib/theme.css`，Popup 与 Options 共用，跟随系统浅色/深色自动切换。详见 `PLAN.md` 第 5.3 节。
