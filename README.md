# TrailSmith（浏览匠）

浏览器扩展（Chrome / Edge，Manifest V3）。

> **Tab Trail（浏览血缘记录器）** + **Copy Smith（复制净化层）**
> 不替你整理，只帮你把来路记清楚、把复制弄干净。纯本地、零配置、不上传。

## 功能

- **Tab Trail**：自动记录每个标签页生命周期（创建/跳转/切换/关闭），基于 `openerTabId` 构建浏览血缘树，Popup 中可回溯。
- **Copy Smith**：从任意网页 `Ctrl+C` 时自动清洗剪贴板（去噪声、引号统一、软换行修复、代码块保护、空行压缩）。`Ctrl+Shift+C` 强制原始复制。

## 当前状态

- 版本：`v0.1.0`（MVF）
- 已实现：MV3 工程骨架、Tab Trail 采集与血缘树（Popup 渲染）、Copy Smith R001–R005 净化、Options 设置页。
- 待补：Side Panel（v0.2）、粘贴守卫（v0.3）、真实浏览器内加载验证。
- 计划书见 `PLAN.md`（v0.1 修订版，含两轮对抗式可行性自审）。

## 开发加载

1. `chrome://extensions` → 开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择本目录
3. 固定扩展后点击图标打开 Popup；右键扩展 → 选项 进入设置页

## 结构

```
manifest.json
background/   service-worker / tab-tracker / storage-manager
content/      copy-cleaner（注入页面）
lib/          constants / time-utils / search-engine-parser / privacy-filter / tree-builder
popup/        Popup 页面与树渲染
options/      设置页
```

详见 `PLAN.md`（v0.1 修订版计划书）。
