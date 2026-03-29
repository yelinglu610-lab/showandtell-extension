# ShowAndTell Chrome Extension — 产品需求文档

版本：v2.3 | 日期：2026-03-29  
仓库：https://github.com/yelinglu610-lab/showandtell-extension

---

## 一、产品概述

ShowAndTell 是一个 Chrome 扩展，注入任意网页，提供演示工具栏。适用于录屏讲解、在线演示、教学标注场景。点击插件图标即可激活，无需配置。

### 核心功能
| 功能 | 描述 |
|------|------|
| 工具栏 | 可拖动的悬浮操作栏，支持收起/展开 |
| 摄像头 | 悬浮摄像框，可拖动/缩放/变形 |
| 麦克风 | 独立开关，显示状态 |
| 激光笔 | 在页面上绘制激光轨迹 |
| 录制 | 录制屏幕+音频，导出 webm |

---

## 二、工具栏详细规格

### 2.1 视觉设计
- 背景：`rgba(12,12,12,0.93)` + `backdrop-filter: blur(24px)`
- 边框：`1px solid rgba(255,255,255,0.1)`，圆角 `30px`
- 阴影：`0 2px 0 1px rgba(0,0,0,.5), 0 16px 48px rgba(0,0,0,.6)`
- 内边距：`6px 10px`，按钮间距 `2px`
- z-index：`2147483647`（最高层）

### 2.2 按钮布局（从左到右）
```
[📷摄像头] [···形状] [🎙麦克风] | [🖱鼠标] [🔦激光笔] [🎨颜色] | [🔴录制] [00:00] | [∧收起] [✕关闭]
```
- 分隔线：`1px solid rgba(255,255,255,0.08)`，高 `20px`
- 按钮高度：`38px`，圆角 `12px`
- 按钮 hover：`rgba(255,255,255,0.09)`
- 激活状态：`rgba(255,214,0,0.18)` + `outline: 1.5px solid rgba(255,214,0,0.55)`

### 2.3 初始位置
- 底部居中，距底 `24px`
- 用变量 `barLeft / barTop` 管理像素位置，初始化时用 `requestAnimationFrame` 等待 DOM 渲染后读取真实宽高计算居中坐标
- 不使用 `transform: translateX(-50%)`，避免拖动时坐标系冲突

### 2.4 拖动行为
**触发**：鼠标按下工具栏**空白区域**（非按钮、非 input）

**mousedown 时**：
1. 记录偏移 `barOff = { x: e.clientX - barLeft, y: e.clientY - barTop }`（直接用变量，不读 DOM）
2. 设置 `transition: none`（零延迟跟手）
3. cursor → `grabbing`

**mousemove 时**：
- `barLeft = e.clientX - barOff.x`，`barTop = e.clientY - barOff.y`
- 直接设置 `bar.style.left / top`，完全跟手，无任何节流

**mouseup 时**：
- 停在当前位置，**不吸边**
- 恢复 `transition: ""`
- cursor → `grab`

### 2.5 收起行为
**点 ∧ 按钮**：
1. 工具栏向右滑出：`transition: transform 0.22s ease, opacity 0.18s` → `translateX(120%)` + `opacity: 0`
2. 230ms 后：`display: none`，清除 transform/transition
3. 右边缘出现「ShowAndTell」竖排标签（收起条）

**收起条样式**：
- 固定在右边缘，`bottom: 80px`
- 左侧圆角（12px），右侧无圆角贴屏幕边缘，右边框去掉
- 背景同工具栏，左侧阴影
- 内容：`◀` 箭头 + 竖排「ShowAndTell」文字
- cursor: pointer

### 2.6 展开行为
**点收起条**：
1. 隐藏收起条
2. `display: flex` + `visibility: hidden` 先测量工具栏真实宽高
3. 计算底部居中坐标，设置 `barLeft / barTop`
4. 从右侧滑入：`translateX(120%)` → `none`，`cubic-bezier(.34,1.3,.64,1)` 弹簧效果，260ms
5. 清除 transition，恢复正常状态

### 2.7 关闭行为
**点 ✕**：
- 工具栏、收起条、摄像框全部 `display: none`
- 停止激光（清除 canvas，取消 rAF）
- 停止摄像头（停止所有 track）
- 停止录制（如正在录制）
- 关闭颜色面板、形状菜单
- `shown = false`
- 再次点插件图标 → `window.__SAT__.toggle()` → `showAll()`

---

## 三、摄像头模块

### 3.1 开关逻辑
- 点「摄像头」按钮：关闭 → 开启，开启 → 关闭
- 开启：调用 `getUserMedia({video: true})`（无分辨率约束，启动更快）
- 关闭：停止所有 video track，隐藏摄像框

### 3.2 状态视觉
- **关闭**：图标 `opacity: 0.35` + `filter: grayscale(1)`，无高亮
- **开启**：图标正常亮度，按钮黄色背景 + outline 高亮

### 3.3 摄像框视觉
- 默认尺寸：`200×150px`
- 默认位置：右侧距边 24px，顶部 80px
- 默认形状：圆角 20px
- 边框：`box-shadow: 0 0 0 3px #fff, 0 8px 32px rgba(0,0,0,0.4)`
- 视频：水平镜像（`transform: scaleX(-1)`），`object-fit: cover`
- z-index：`2147483644`

### 3.4 摄像框拖动
- 用变量 `camPos` 管理位置，不读 DOM
- mousedown：记录 `dragOffset = { x: e.clientX - camPos.x, y: e.clientY - camPos.y }`
- mousemove：更新 `camPos`，用 `requestAnimationFrame` 节流渲染
- mouseup：释放，cursor → `grab`
- 右下角 24×24 透明区域为 resize handle，mousedown 时不触发拖动

### 3.5 摄像框缩放
**右下角 resize handle 拖动**：
- 记录起始鼠标位置和尺寸，mousemove 时计算增量
- 限制：w: 80–700px，h: 60–600px
- rAF 节流渲染

**滚轮缩放**：
- 步长 ×1.05 / ×0.95（更顺滑）
- 宽高同步缩放，rAF 节流
- 限制：w: 80–700px，h: 60–600px

### 3.6 形状切换
- 点「···」按钮弹出菜单
- 三个选项：圆角（border-radius: 20px）/ 圆形（50%）/ 方形（6px）
- **圆形模式**：`updateBubble` 里取 `min(w, h)` 保持正圆，不修改 `camSize` 变量
- 当前选中项黄色高亮
- 点其他区域关闭菜单

---

## 四、麦克风模块

### 4.1 状态
- **关闭**（默认）：SVG 图标 `opacity: 0.3` + `filter: grayscale(1)`，无高亮
- **开启**：图标正常亮度，按钮黄色高亮
- 开启：调用 `getUserMedia({audio: true})`
- 关闭：停止所有 audio track

### 4.2 与录制的关系
- 此开关管理独立的预览 stream
- 录制时在 `startRec` 内单独申请麦克风，不依赖此开关状态

---

## 五、激光笔模块

### 5.1 模式
- **鼠标模式**（默认，鼠标按钮高亮）：
  - canvas `pointer-events: none`（鼠标穿透，页面可正常点击交互）
  - `document.body.style.cursor = ""`（恢复页面默认光标）
  - 停止 rAF，清除 canvas
- **激光笔模式**（激光笔按钮高亮）：
  - canvas `pointer-events: all`
  - `lc.style.cursor = "crosshair"`，`document.body.style.cursor = "crosshair"`
  - 启动 rAF 绘制循环

### 5.2 绘制逻辑
**数据结构**：`trail = [{x, y, t}]`

**rAF 循环**（每帧）：
1. 清除 canvas
2. 过滤 700ms 以前的点
3. 逐段绘制轨迹线：
   - `lineWidth = laserW × 1.5`，`lineCap: round`
   - `globalAlpha = 1 - (now - point.t) / 700`（时间渐隐）
4. 最后一个点绘制光晕圆：半径 `laserW × 3`，同色填充

### 5.3 颜色面板
- 点「颜色」按钮弹出（fixed，工具栏上方 bottom: 78px）
- 8 色：`#FF3B30 #FF9500 #FFD600 #34C759 #007AFF #5856D6 #fff #111`
- hover 放大 scale(1.2)，选中项白色边框
- 粗细滑块：2–14px，accent-color: #FFD600
- 点面板外区域关闭

---

## 六、录制模块

### 6.1 开始录制
1. 调用 `getDisplayMedia({video: {frameRate: 30}, audio: true})`
2. 额外尝试 `getUserMedia({audio: true})` 获取麦克风音频
3. 合并所有 track 为 MediaStream
4. 创建 `MediaRecorder`，mimeType: `video/webm;codecs=vp9`
5. 开始计时（setInterval 每秒 +1）
6. 录制按钮变「停止」（红色加深，⏹图标），计时器变红
7. 失败 → `console.error`，不弹 alert

### 6.2 停止录制
- 触发：点「停止」按钮 / 用户在系统层停止共享（`onended`）
- 停止所有 track，`recorder.stop()`
- 计时器归零，按钮恢复
- 弹出导出面板

### 6.3 导出面板
- 居中弹层，暗色背景 + blur
- 显示：录制时长 + 文件大小（MB）
- 「下载录制文件」→ blob URL → `<a>` 下载 `.webm`，3s 后释放 URL
- 「关闭」→ 移除面板，丢弃 blob

---

## 七、键盘快捷键

| 键 | 功能 | 条件 |
|----|------|------|
| L | 切换激光笔模式 | 工具栏显示中，焦点不在输入框 |
| M | 切换鼠标模式 | 同上 |
| C | 开关摄像头 | 同上 |
| R | 开始/停止录制 | 同上 |
| Esc | 关闭工具栏 | 同上 |

---

## 八、注入机制

### 8.1 激活
1. 用户点击 Chrome 工具栏图标
2. `background.js` 的 `chrome.action.onClicked` 触发
3. `insertCSS`（content.css）+ `executeScript`（content.js）
4. content.js IIFE 运行，检查 `window.__SAT__`：
   - 存在 → 调用 `toggle()`（切换显示/隐藏）
   - 不存在 → 初始化所有 DOM 和事件

### 8.2 跨标签页自动注入
- `chrome.tabs.onActivated` 监听标签页切换
- 切换到新标签页时自动注入（chrome:// 等受限页面静默跳过）
- `window.__SAT__` 守卫防止重复初始化

### 8.3 限制
- 不支持 `chrome://` 页面
- 不支持 `chrome-extension://` 页面

---

## 九、文件结构

```
showandtell-extension/
├── manifest.json        # MV3，v2.2.0，permissions: activeTab/scripting/tabs
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background.js    # service worker：onClicked 注入 + onActivated 跨标签注入
│   ├── content.js       # 主逻辑：工具栏+摄像框+激光+录制
│   ├── content.css      # 样式隔离
│   └── toolbar.js       # 备用（未使用）
├── toolbar.html         # 备用（未使用）
├── test/
│   └── smoke.js         # 控制台冒烟测试
└── PRD.md               # 本文档
```

---

## 十、已知限制

| 项目 | 说明 |
|------|------|
| Twemoji 图标 | 依赖 CDN，离线环境图标空白 |
| 录制格式 | 仅 webm，无 mp4 转码（CSP 限制） |
| 颜色/形状面板位置 | 固定 bottom:78px，工具栏拖到顶部时可能被遮挡 |
| 圆形缩放 | 滚轮/拖拽缩放时圆形保持正圆，但 camSize 内部 w/h 可能不同步 |
