# JS组件系统测试指南

## 🎯 测试目标

验证JS组件系统的完整功能，包括：
1. 组件管理界面
2. 组件创建和编辑
3. 组件在聊天中的渲染
4. 参数传递和执行

## 🚀 测试步骤

### 1. 启动应用
```bash
yarn dev
```

### 2. 访问JS组件界面

1. 打开Cherry Studio
2. 进入 **设置** → **组件管理**
3. 应该看到JS组件直接显示在组件卡片列表中（和ComfyUI组件一样）
4. 可以看到"新增 JS 组件"的虚线卡片

### 3. 验证内置示例组件

系统应该包含两个内置示例组件：

#### Hello World 组件
- **组件名**: `hello-world`
- **功能**: 简单问候
- **参数**: `name` (可选)

#### Calculator 组件
- **组件名**: `calculator`
- **功能**: 简单计算器
- **参数**: `num1`, `num2`, `operation`

### 4. 测试组件创建

1. 点击 **"新增 JS 组件"** 虚线卡片
2. 填写以下信息：
   - **组件名称**: 测试组件
   - **组件英文名**: test-component
   - **描述**: 这是一个测试组件
   - **输出类型**: 文本
   - **JS代码**:
   ```javascript
   const message = `Hello ${name || 'World'}! Current time: ${new Date().toLocaleString()}`
   return message
   ```
3. 添加参数：
   - **参数名**: name
   - **类型**: string
   - **描述**: 用户名称
   - **必需**: 否
4. 点击 **"测试代码"** 验证功能
5. 点击 **"保存"** 创建组件

### 5. 测试聊天中的组件渲染

在聊天界面中输入以下内容测试组件：

#### 测试Hello World组件
```markdown
<js-component name="hello-world" />
<js-component name="hello-world" name="Alice" />
```

#### 测试Calculator组件
```markdown
<js-component name="calculator" num1="10" num2="5" operation="add" />
<js-component name="calculator" num1="20" num2="4" operation="divide" />
```

#### 测试自定义组件
```markdown
<js-component name="test-component" />
<js-component name="test-component" name="测试用户" />
```

### 6. 验证HTML输出组件

创建一个HTML输出组件：

1. 创建新组件：
   - **组件名称**: HTML卡片
   - **组件英文名**: html-card
   - **输出类型**: HTML
   - **JS代码**:
   ```javascript
   return {
     type: 'html',
     content: `
       <div style="padding: 20px; border: 2px solid #3b82f6; border-radius: 12px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); margin: 10px 0;">
         <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 18px;">🎉 ${title || '欢迎'}</h3>
         <p style="margin: 0; color: #374151; line-height: 1.5;">${content || '这是一个HTML组件示例'}</p>
         <div style="margin-top: 15px; padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 6px;">
           <small style="color: #6b7280;">生成时间: ${new Date().toLocaleString()}</small>
         </div>
       </div>
     `
   }
   ```
2. 添加参数：
   - `title` (string, 可选): 卡片标题
   - `content` (string, 可选): 卡片内容

3. 在聊天中测试：
```markdown
<js-component name="html-card" />
<js-component name="html-card" title="自定义标题" content="这是自定义内容" />
```

## ✅ 预期结果

### 组件管理界面
- [x] JS组件直接显示在组件设置页面的卡片列表中
- [x] 显示内置示例组件（Hello World, Calculator）
- [x] 能够通过"新增 JS 组件"卡片创建组件
- [x] 能够通过"编辑"按钮编辑组件
- [x] 能够通过"删除"按钮删除组件
- [x] 代码测试功能正常工作

### 聊天渲染
- [x] `<js-component>` 标签被正确解析
- [x] 参数正确传递给JS代码
- [x] 文本输出正确显示
- [x] HTML输出正确渲染
- [x] 错误处理正常工作

### 安全性
- [x] 危险API被禁用（fetch, eval等）
- [x] 执行超时机制生效
- [x] 参数类型验证正常

## 🐛 常见问题排查

### 1. 组件不显示
- 检查组件名称是否正确
- 确认组件已启用
- 查看浏览器控制台错误

### 2. JS代码执行失败
- 检查代码语法
- 确认没有使用禁用的API
- 查看错误提示信息

### 3. 参数传递问题
- 确认参数名称匹配
- 检查参数类型是否正确
- 验证必需参数是否提供

### 4. HTML渲染问题
- 确认输出类型设置为HTML
- 检查返回的HTML格式
- 验证CSS样式是否正确

## 📝 测试报告模板

```markdown
## JS组件系统测试报告

**测试时间**: [日期时间]
**测试环境**: [操作系统/浏览器版本]

### 功能测试结果
- [ ] 组件管理界面访问
- [ ] 内置组件显示
- [ ] 组件创建功能
- [ ] 组件编辑功能
- [ ] 组件删除功能
- [ ] 代码测试功能
- [ ] 聊天中组件渲染
- [ ] 参数传递
- [ ] 文本输出
- [ ] HTML输出
- [ ] 错误处理

### 发现的问题
1. [问题描述]
2. [问题描述]

### 建议改进
1. [改进建议]
2. [改进建议]
```

## 🎉 总结

如果所有测试都通过，说明JS组件系统已经完全可用！用户可以：
- 创建自定义JavaScript组件
- 在聊天中使用组件
- 享受安全的代码执行环境
- 获得丰富的交互体验

系统现在已经为Cherry Studio带来了强大的可扩展性！
