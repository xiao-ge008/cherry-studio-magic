# ✅ CLI 系统提示词弹窗 - 全屏功能更新

## 🎯 新增功能

### 全屏编辑模式

现在系统提示词弹窗支持**全屏编辑模式**，为用户提供更大的编辑空间！

## 📋 功能特性

### 1. **全屏切换按钮**

- 📍 位置：弹窗右上角
- 🎨 图标：
  - 普通模式：`⛶` (Maximize2) - 点击进入全屏
  - 全屏模式：`⛝` (Minimize2) - 点击退出全屏
- 💡 悬停提示：
  - 中文：全屏编辑 / 退出全屏
  - 英文：Fullscreen / Exit Fullscreen

### 2. **普通模式 vs 全屏模式**

#### 普通模式（默认）

- ✅ 显示完整的说明文字
- ✅ 显示使用提示框
- ✅ 文本框：12-20 行自适应高度
- ✅ 弹窗宽度：600px-800px
- ✅ 居中显示

#### 全屏模式

- ✅ 文本框占据整个可视区域
- ✅ 隐藏说明文字和提示框（节省空间）
- ✅ 弹窗宽度：90% 视口宽度（最大 800px）
- ✅ 高度：几乎填满整个视口（vh - 32px）
- ✅ 文本框自动填充剩余空间
- ✅ 禁用 resize（避免布局问题）

## 🎨 UI 优化

### 响应式布局

```typescript
// 全屏状态下的布局
<PopupContainer $isFullscreen={true}>
  <Header>               {/* 固定高度 */}
    <Title>...</Title>
    <FullscreenButton>   {/* 切换按钮 */}
  </Header>

  <EditorContainer>      {/* flex: 1 - 占据剩余空间 */}
    <TextArea />         {/* height: 100% */}
  </EditorContainer>

  <Footer>               {/* 固定高度 */}
    <保存> <取消>
  </Footer>
</PopupContainer>
```

### 样式特性

1. **Flexbox 布局**
   - `flex-direction: column` - 垂直排列
   - `overflow: hidden` - 避免滚动条
   - `flex-shrink: 0` - 固定元素不收缩

2. **动态样式**
   - 使用 styled-components 的 props 传递状态
   - `$isFullscreen` prop 控制样式

3. **空间利用**
   - 全屏时 padding 减小（24px → 16px）
   - 编辑器使用 `flex: 1` 填充剩余空间
   - Header 和 Footer flex-shrink: 0 保持固定

## 💻 技术实现

### 状态管理

```typescript
const [isFullscreen, setIsFullscreen] = useState(false)

const toggleFullscreen = () => {
  setIsFullscreen(!isFullscreen)
}
```

### 条件渲染

```typescript
{/* 仅在非全屏时显示说明 */}
{!isFullscreen && <Description>...</Description>}

{/* 仅在非全屏时显示提示框 */}
{!isFullscreen && <InfoBox>...</InfoBox>}
```

### 动态属性

```typescript
<StyledTextArea
  autoSize={isFullscreen ? false : { minRows: 12, maxRows: 20 }}
  $isFullscreen={isFullscreen}
/>
```

## 🚀 使用方式

### 进入全屏模式

1. 打开 CLI 系统提示词弹窗
2. 点击右上角的 `⛶` 全屏按钮
3. 弹窗立即扩展到全屏大小
4. 编辑器自动填充所有可用空间

### 退出全屏模式

1. 点击右上角的 `⛝` 退出全屏按钮
2. 弹窗恢复到普通大小
3. 说明文字和提示框重新显示

### 保存和取消

- 无论在哪种模式下，保存和取消按钮始终可见
- 点击保存/取消会自动关闭弹窗

## 📊 对比表格

| 特性 | 普通模式 | 全屏模式 |
|------|---------|---------|
| 弹窗宽度 | 600-800px | 90vw (max 800px) |
| 弹窗高度 | 自适应 | ~100vh |
| 说明文字 | ✅ 显示 | ❌ 隐藏 |
| 提示框 | ✅ 显示 | ❌ 隐藏 |
| 文本框高度 | 12-20行 | 填充剩余空间 |
| Padding | 24px | 16px |
| Resize | vertical | none |
| 居中显示 | ✅ | ❌ (top: 20px) |

## 🎁 用户体验提升

1. **更大编辑空间** 📝
   - 全屏模式提供几乎整个视口用于编辑
   - 适合编写长篇系统提示词

2. **专注模式** 🎯
   - 隐藏非必要信息
   - 减少干扰，提高专注度

3. **灵活切换** ⚡
   - 一键切换，即时响应
   - 状态保持，不丢失编辑内容

4. **视觉反馈** 👁️
   - 图标变化清晰指示当前状态
   - Tooltip 提供额外说明

## 🔧 代码关键点

### Styled Components with Props

```typescript
const PopupContainer = styled.div<{ $isFullscreen: boolean }>`
  padding: ${(props) => (props.$isFullscreen ? '16px' : '24px')};
  height: ${(props) => (props.$isFullscreen ? 'calc(100vh - 32px)' : 'auto')};
`
```

### Textarea Height Control

```typescript
const StyledTextArea = styled(Input.TextArea)<{ $isFullscreen: boolean }>`
  height: ${(props) => (props.$isFullscreen ? '100%' : 'auto')};

  textarea {
    height: ${(props) => (props.$isFullscreen ? '100% !important' : 'auto')};
  }
`
```

### Modal Configuration

```typescript
GeneralPopup.show({
  width: '90%',
  style: { maxWidth: '800px', top: 20 },
  centered: false, // 不居中，使用 top 定位
  maskClosable: true
})
```

## ✅ 测试清单

- [x] 全屏按钮显示正常
- [x] 点击按钮切换状态
- [x] 图标根据状态改变
- [x] Tooltip 显示正确文字
- [x] 全屏时弹窗尺寸正确
- [x] 编辑器填充所有空间
- [x] 说明和提示框条件显示
- [x] 保存按钮功能正常
- [x] 取消按钮功能正常
- [x] 状态切换不丢失内容

## 🎉 优化效果

### 之前

- ⚠️ 固定大小弹窗（700px）
- ⚠️ 编辑空间有限（12-20 行）
- ⚠️ 无法扩展

### 现在

- ✅ 支持全屏编辑
- ✅ 灵活的空间利用
- ✅ 一键切换模式
- ✅ 专注编辑体验

---

**更新时间：** 2025-11-27
**版本：** 1.1
**状态：** ✅ 已完成并测试
