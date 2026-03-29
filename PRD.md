# ShowAndTell Chrome Extension — 产品需求文档

版本：v2.2 | 日期：2026-03-29  
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
- 底部居中：`bottom: 24px; left: 50%; transform: translateX(-50%)`
- 页面加载后 1 帧内转为像素坐标（`left/top px`），消除 transform，为拖动做准备

### 2.4 拖动行为（核心）
**触发**：鼠标按下工具栏**空白区域**（非按钮、非 input）

**mousedown 时**：
1. 从 DOM `getBoundingClientRect()` 读取当前真实位置
2. 立即设置 `left/top` 为像素值，清除 `bottom/transform`
3. 设置 `transition: none`（禁止任何过渡，保证零延迟）
4. 记录偏移量 `barOff = { x: e.clientX - r.left, y: e.clientY - r.top }`
5. 设置 cursor 为 `grabbing`

**mousemove 时**：
- 直接设置 `left = e.clientX - barOff.x`，`top = e.clientY - barOff.y`
- 不做任何额外处理，完全跟手

**mouseup 时**：
1. 停在当前位置，不吸边，不弹动
2. 恢复 `transition: ""`
3. 阴影轻弹（box-shadow 变大再恢复，200ms）
4. 计算当前位置：工具栏中心 Y < 视口高度/2 → `barAnchored = "top"`，否则 `"bottom"`

### 2.5 收起行为
**点 ∧ 按钮**：
1. 读取当前 `barAnchored`（上/下）
2. 无动画瞬间将工具栏移到对应边（top: 16px 或 bottom 边）
3. 启动 `transition: transform 0.2s ease, opacity 0.18s`
4. 执行 `translateY(-120%)` 或 `translateY(120%)` + `opacity: 0`
5. 200ms 后：`display: none`，清除 transform/transition
6. 显示收起条（位置：与工具栏水平对齐，同侧边缘 16px）
   - 上半屏：收起条在顶部，箭头朝上（∧）
   - 下半屏：收起条在底部，箭头朝下（∨）

**收起条样式**：
- 背景同工具栏，圆角 `20px`，padding `5px 18px`
- 内容：箭头 SVG + "ShowAndTell" 文字（`rgba(255,255,255,0.3)`）
- cursor: pointer

### 2.6 展开行为
**点收起条**：
1. 隐藏收起条
2. 设置工具栏回到底部居中（`left: 50%, bottom: 24px, transform: translateX(-50%)`）
3. `display: flex`，`opacity: 0`
4. 启动 `transition: opacity 0.22s ease`
5. 下一帧：`opacity: 1`
6. 220ms 后：清除 transition 和 opacity
7. 再等 1 帧：将位置转为像素坐标（为下次拖动准备）
8. 重置 `barAnchored = "bottom"`

### 2.7 关闭行为
**点 ✕**：
- 工具栏 `display: none`
- 收起条 `display: none`
- 摄像框 `display: none`
- 停止激光（清除 canvas，取消 rAF）
- 停止摄像头（停止 stream）
- 停止录制（如果正在录制）
- 关闭颜色/形状面板
- `shown = false`
- 再次点插件图标：`window.__SAT__.toggle()` → `showAll()`

---

## 三、摄像头模块

### 3.1 开关逻辑
- 点「摄像头」按钮：
  - 关闭状态 → 调用 `getUserMedia({video: {width: 640, height: 480}})`
  - 开启状态 → 停止所有 track，隐藏气泡
- 开启后按钮高亮（黄色 outline）

### 3.2 摄像框视觉
- 默认尺寸：`200×150px`
- 默认位置：右侧距边 24px，顶部 80px
- 默认形状：圆角 20px
- 边框：`box-shadow: 0 0 0 3px #fff, 0 8px 32px rgba(0,0,0,0.4)`
- 视频：水平镜像（`transform: scaleX(-1)`），`object-fit: cover`
- z-index：`2147483644`

### 3.3 摄像框拖动
**mousedown 时**：
1. 若点击的是 resize handle（右下角 24×24 区域）→ 不触发拖动
2. 从 `getBoundingClientRect()` 同步真实位置到 `camPos`
3. 记录偏移 `dragOffset = { x: e.clientX - r.left, y: e.clientY - r.top }`
4. cursor → `grabbing`

**mousemove 时**：
- `camPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }`
- 调用 `updateBubble()` 更新位置

**mouseup**：释放，cursor → `grab`

### 3.4 摄像框缩放
**右下角 resize handle（透明，24×24px）**：
- mousedown：同步当前真实尺寸到 `camSize`，记录起始鼠标位置
- mousemove：`camSize.w = resizeStart.w + (e.clientX - resizeStart.mx)`，限制 80–700px
- 实时调用 `updateBubble()`

**滚轮缩放**：
- 向上：×1.1；向下：×0.9
- 宽高同步缩放
- 限制：w: 80–700px，h: 60–600px

### 3.5 形状切换
- 点「···」按钮弹出菜单（固定在按钮下方）
- 三个选项：圆角（20px）/ 圆形（50%）/ 方形（6px）
- 当前选中项高亮（黄色背景）
- 点选项后立即生效，关闭菜单
- 点其他区域关闭菜单

---

## 四、麦克风模块

### 4.1 状态
- 默认关闭：图标 `opacity: 0.4`，无高亮
- 开启：`getUserMedia({audio: true})`，图标 `opacity: 1`，高亮
- 关闭：停止 stream，图标变暗

### 4.2 与录制的关系
- 麦克风开关仅管理 preview stream（将来可用于实时音量显示）
- 录制时单独申请麦克风权限，不依赖此开关

---

## 五、激光笔模块

### 5.1 模式
- **鼠标模式**（默认）：
  - canvas `pointer-events: none`（鼠标穿透到页面）
  - 取消 rAF，清除 canvas
  - 鼠标按钮高亮
- **激光笔模式**：
  - canvas `pointer-events: all`，cursor → `crosshair`
  - 启动 rAF 绘制循环
  - 激光笔按钮高亮

### 5.2 绘制逻辑
**数据结构**：`trail = [{x, y, t}]`，每帧 mousemove 追加

**rAF 循环**（每帧）：
1. 清除 canvas
2. 过滤 700ms 以前的点
3. 逐段绘制轨迹线：
   - `lineWidth = laserW × 1.5`
   - `globalAlpha = 1 - (now - point.t) / 700`（越老越透明）
   - `lineCap: round`
4. 最后一个点绘制光晕圆：半径 `laserW × 3`

### 5.3 颜色面板
- 点「颜色」按钮弹出（fixed 定位，工具栏上方）
- 8 色：`#FF3B30 #FF9500 #FFD600 #34C759 #007AFF #5856D6 #fff #111`
- hover 放大（scale 1.2），当前选中白色边框
- 粗细滑块：2–14px，实时更新 `laserW`
- 点色板外区域关闭

---

## 六、录制模块

### 6.1 开始录制
1. 调用 `getDisplayMedia({video: {frameRate: 30}, audio: true})`
2. 额外尝试 `getUserMedia({audio: true})` 获取麦克风
3. 合并所有 track 为 MediaStream
4. 创建 `MediaRecorder`，mimeType: `video/webm;codecs=vp9`
5. 开始计时（setInterval，每秒 +1）
6. 录制按钮变为「停止」（红色背景加深，⏹图标）
7. 计时器颜色变红

**失败处理**：用户拒绝 → console.error，不弹 alert

### 6.2 停止录制
- 触发方式：点「停止」按钮 / 用户在系统层停止共享
- 调用 `recorder.stop()`
- 停止所有 track
- 计时器归零，按钮恢复
- 弹出导出面板

### 6.3 导出面板
- 居中弹层，暗色背景，blur
- 显示：录制时长 + 文件大小（MB）
- 按钮：「下载录制文件」→ 创建 blob URL，触发 `<a>` 下载 `.webm`，3秒后释放 URL
- 按钮：「关闭」→ 丢弃 blob，移除面板

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
3. 先 `insertCSS`（`src/content.css`），再 `executeScript`（`src/content.js`）
4. content.js 以 IIFE 运行
5. 检查 `window.__SAT__`：存在则调用 `toggle()`（切换显示/隐藏），不存在则初始化

### 8.2 去重保护
```js
if (window.__SAT__) { window.__SAT__.toggle(); return }
```
防止重复注入时创建多套 DOM

### 8.3 限制
- 不支持 `chrome://` 页面（Chrome 安全限制）
- 不支持 `chrome-extension://` 页面
- 每个标签页独立注入，切换标签页工具栏不跟随

---

## 九、文件结构

```
showandtell-extension/
├── manifest.json          # MV3，权限：activeTab/scripting
├── toolbar.html           # 备用（独立窗口模式，当前未使用）
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background.js      # service worker，处理图标点击
│   ├── content.js         # 主逻辑，注入到页面
│   ├── content.css        # 全局样式重置（防止页面 CSS 污染）
│   └── toolbar.js         # 备用
├── test/
│   └── smoke.js           # 控制台冒烟测试脚本
└── PRD.md                 # 本文档
```

---

## 十、已知限制 & 待优化

| 项目 | 说明 |
|------|------|
| Twemoji 图标 | 依赖 CDN，离线环境图标空白 |
| 录制格式 | 仅 webm，无 mp4 转码（CSP 限制） |
| 标签页跟随 | 切换标签页工具栏消失，需重新点图标 |
| 形状菜单位置 | 固定在工具栏上方，工具栏拖动后菜单位置可能偏离 |
| 颜色面板位置 | 固定 bottom:78px，工具栏在顶部时可能被遮挡 |
