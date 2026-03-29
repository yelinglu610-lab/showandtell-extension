# ShowAndTell Chrome Extension — 产品需求文档

版本：stable-v1 | 日期：2026-03-29  
仓库：https://github.com/yelinglu610-lab/showandtell-extension  
Tag：`stable-v1`（最终稳定版）

---

## 一、产品概述

ShowAndTell 是一个 Chrome 扩展，注入任意网页，提供演示工具栏。适用于录屏讲解、在线演示、教学标注场景。点击插件图标即可激活，无需配置。

### 核心功能
| 功能 | 描述 |
|------|------|
| 工具栏 | 可拖动的悬浮操作栏，支持收起/展开 |
| 摄像头 | 悬浮摄像框，边缘拖动、滚轮缩放、形状切换 |
| 麦克风 | 独立开关，图标状态明确 |
| 激光笔 | 在页面上绘制激光轨迹，颜色/粗细可调 |
| 录制 | 录制屏幕+音频，导出 webm |

---

## 二、工具栏

### 2.1 视觉
- 背景：`rgba(12,12,12,0.93)` + `backdrop-filter: blur(24px)`
- 边框：`1px solid rgba(255,255,255,0.1)`，圆角 `30px`
- 内边距：`6px 10px`，z-index：`2147483647`

### 2.2 按钮布局
```
[📷摄像头] [···形状] [🎙麦克风] | [🖱鼠标] [🔦激光笔] [🎨颜色] | [🔴录制] [00:00] | [∧收起] [✕关闭]
```
- 按钮高度 `38px`，圆角 `12px`
- hover：`rgba(255,255,255,0.09)`
- 激活：`rgba(255,214,0,0.18)` + `outline: 1.5px solid rgba(255,214,0,0.55)`

### 2.3 初始位置
- 底部居中，距底 `24px`
- 用变量 `barLeft/barTop` 管理像素坐标，`requestAnimationFrame` 后初始化

### 2.4 拖动
- 按住工具栏**空白区域**（非按钮）拖动
- mousedown：记录 `barOff`，设 `transition:none`
- mousemove：直接更新 `barLeft/barTop`，零延迟跟手
- mouseup：停在原地，不吸边

### 2.5 收起
- 点 **∧**：向右 `translateX(120%)` 滑出，230ms
- 右边缘出现「ShowAndTell」竖排标签（`bottom:80px`，左圆角贴边）

### 2.6 展开
- 点右边缘标签：`visibility:hidden` 测量宽高 → 定位底部居中 → 从右侧弹入，`cubic-bezier(.34,1.3,.64,1)`

### 2.7 关闭
- 点 **✕**：隐藏工具栏+收起条+摄像框，停止激光/摄像/录制

---

## 三、摄像头

### 3.1 开关
- 点「摄像头」：开启 `getUserMedia({video:true})`（无分辨率约束，秒开）
- 关闭：停止所有 track，隐藏摄像框
- **关闭状态**：图标 `opacity:0.35 + grayscale(1)`
- **开启状态**：黄色高亮

### 3.2 摄像框
- 默认：`200×150px`，右侧距边 24px，顶部 80px，圆角 20px
- 视频水平镜像，`object-fit:cover`
- z-index：`2147483644`

### 3.3 拖动（边缘触发）
- 鼠标在摄像框**边缘 12px 以内**：cursor → `grab`，可拖动
- 鼠标在**内部**：`cursor:default`，事件穿透，不触发拖动
- 用变量 `camPos` 管理位置，rAF 节流渲染

### 3.4 缩放
- **右下角 resize handle**（28×28px，白色斜线图标）：拖动精确缩放
- **滚轮**：×1.05/×0.95，rAF 节流，限制 w:80-700，h:60-600

### 3.5 形状
- 点「···」弹出菜单：圆角(20px) / 圆形(50%) / 方形(6px)
- 圆形模式：`updateBubble` 里取 `min(w,h)` 保持正圆

---

## 四、麦克风

- **关闭**（默认）：SVG `opacity:0.3 + grayscale(1)`
- **开启**：黄色高亮，`getUserMedia({audio:true})`
- 录制时单独申请麦克风，与此开关无关

---

## 五、激光笔

### 5.1 模式
- **鼠标模式**（默认）：canvas `pointer-events:none`，页面可正常点击
- **激光笔模式**：canvas `pointer-events:all`，cursor `crosshair`

### 5.2 绘制
- `trail = [{x,y,t}]`，700ms 渐隐
- `lineWidth = laserW×1.5`，`lineCap:round`
- 笔尖光晕圆：半径 `laserW×3`

### 5.3 颜色面板
- 8色 + 粗细滑块（2-14px）
- 点外部关闭

---

## 六、录制

- 点「录制」：`getDisplayMedia({video:{frameRate:30},audio:true})`
- 同时申请麦克风
- 计时器实时显示
- 停止后弹导出面板：显示时长，下载 `.webm`

---

## 七、快捷键

| 键 | 功能 |
|----|------|
| L | 切换激光笔 |
| M | 切换鼠标 |
| C | 开关摄像头 |
| R | 开始/停止录制 |
| Esc | 关闭工具栏 |

---

## 八、注入机制

- 点图标 → `background.js` → `insertCSS + executeScript`
- `window.__SAT__` 守卫防重复注入
- 再次点图标 → `toggle()` 切换显示/隐藏
- 不支持 `chrome://` 页面

---

## 九、文件结构

```
showandtell-extension/
├── manifest.json      # MV3，v2.2.0，permissions: activeTab/scripting/tabs
├── icons/             # 16/48/128px
├── src/
│   ├── background.js  # 点击注入
│   ├── content.js     # 全部核心逻辑（工具栏+摄像+激光+录制）
│   └── content.css    # 样式隔离
├── test/
│   └── smoke.js       # 控制台冒烟测试
├── README.md
└── PRD.md             # 本文档
```

---

## 十、已知限制

| 项目 | 说明 |
|------|------|
| Twemoji | 依赖 CDN，离线环境图标空白 |
| 录制格式 | 仅 webm |
| 标签页跳转 | 工具栏消失，需重新点图标 |
| 颜色/形状面板 | 固定 bottom:78px，工具栏在顶部时可能遮挡 |
