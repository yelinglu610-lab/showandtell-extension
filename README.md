# ShowAndTell Chrome Extension

🌐 **落地页**：https://aifin.xiaohongshu.com/rfphecda/aiworkbench/query/query_dashboard?dashboardId=550D7D8E04EC0ECC60215B780EE590CC

> 激光笔 · 摄像头 · 录制 · 悬浮工具栏  
> 注入任意网页，点图标即用，无需配置

---

## 文件说明

```
showandtell-extension/
│
├── manifest.json          # 扩展入口 — MV3 配置，声明权限/图标/service worker
│
├── icons/                 # 扩展图标
│   ├── icon16.png         #   Chrome 工具栏小图标
│   ├── icon48.png         #   扩展管理页中图标
│   └── icon128.png        #   Chrome 商店大图标
│
├── src/
│   ├── background.js      # Service Worker — 监听图标点击，注入 content script；监听标签页切换自动注入
│   ├── content.js         # 核心逻辑 — 工具栏、激光笔、摄像框、麦克风、录制，全部 DOM 操作在此
│   ├── content.css        # 样式隔离 — 防止页面 CSS 污染工具栏
│   └── toolbar.js         # 备用（当前未使用）
│
├── toolbar.html           # 备用（当前未使用）
├── popup.html             # 备用（当前未使用）
├── popup.js               # 备用（当前未使用）
│
├── test/
│   └── smoke.js           # 冒烟测试 — 在 Chrome 控制台粘贴运行，验证所有模块
│
└── PRD.md                 # 产品需求文档 — 完整交互逻辑、视觉规格、已知限制
```

---

## 功能一览

| 功能 | 说明 |
|------|------|
| 🖱 鼠标模式 | 默认模式，鼠标正常操作页面 |
| 🔦 激光笔 | 在页面上画激光轨迹，700ms 渐隐，支持颜色和粗细调节 |
| 📷 摄像头 | 悬浮摄像框，可拖动、滚轮缩放、形状切换（圆角/圆形/方形） |
| 🎙 麦克风 | 独立开关，图标灰色=关闭，黄色高亮=开启 |
| 🔴 录制 | 录制屏幕+音频，停止后下载 `.webm` |
| ∧ 收起 | 工具栏向右滑出，右边缘出现「ShowAndTell」标签，点击展开 |
| ✕ 关闭 | 隐藏工具栏和所有覆盖层 |

---

## 安装方法

1. 克隆仓库到本地：
   ```bash
   git clone https://github.com/yelinglu610-lab/showandtell-extension.git
   ```
2. 打开 Chrome → `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点「加载已解压的扩展程序」→ 选择本仓库目录
5. 工具栏出现 ShowAndTell 图标，点击激活

---

## 使用方法

1. 打开任意网页
2. 点击 Chrome 工具栏的 ShowAndTell 图标
3. 页面底部出现悬浮工具栏
4. 切换标签页会自动注入，无需重复点击

### 快捷键

| 键 | 功能 |
|----|------|
| `L` | 切换激光笔 |
| `M` | 切换鼠标模式 |
| `C` | 开关摄像头 |
| `R` | 开始/停止录制 |
| `Esc` | 关闭工具栏 |

---

## 开发

```bash
# 修改代码后，chrome://extensions/ 点刷新按钮即可热更新
# content.js 改动需要刷新目标网页
```

详细交互规格见 [PRD.md](./PRD.md)
