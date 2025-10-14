# JS组件生成指南 - JSON参数规范

## 🎯 生成组件时的必须遵循规则

在生成JS组件的Markdown文档时，必须严格遵循以下JSON参数格式规范。

## 📋 组件参数配置规范

### 1. JSON类型参数定义

```javascript
// 正确的JSON参数定义
{
  name: 'data',
  type: 'json',
  description: '数据对象，包含组件所需的配置信息',
  required: true,
  example: '{"key": "value", "number": 123, "boolean": true}'
}
```

### 2. 示例值格式要求

- **必须是有效的JSON字符串**
- **使用双引号包裹属性名和字符串值**
- **不能包含单引号作为JSON格式**

```javascript
// ✅ 正确的示例
example: '{"name": "Alice", "age": 25, "active": true}'

// ❌ 错误的示例
example: "{'name': 'Alice', 'age': 25, 'active': true}"
```

## 🔧 Markdown使用格式规范

### 方案1：URL编码（强烈推荐）

```markdown
## 使用示例

### 基础用法
```html
<js-component-name
data="%7B%22current%22%3A65%2C%22max%22%3A100%2C%22showPercent%22%3Atrue%7D"
theme="dark"
/>
```

### 复杂数据
```html
<js-component-name
config="%7B%22style%22%3A%7B%22color%22%3A%22blue%22%2C%22size%22%3A%22large%22%7D%2C%22animation%22%3Atrue%7D"
/>
```

### 编码工具
```javascript
// 使用encodeURIComponent编码JSON
const data = {current: 65, max: 100, showPercent: true}
const encoded = encodeURIComponent(JSON.stringify(data))
console.log(`data="${encoded}"`)
```
```

### 方案2：HTML实体转义（备选）

```markdown
## 使用示例

### 基础用法
```html
<js-component-name
data="{&quot;current&quot;:65,&quot;max&quot;:100,&quot;showPercent&quot;:true}"
theme="dark"
/>
```

### 复杂数据
```html
<js-component-name
config="{&quot;style&quot;:{&quot;color&quot;:&quot;blue&quot;,&quot;size&quot;:&quot;large&quot;},&quot;animation&quot;:true}"
/>
```
```

### 方案2：分离参数（最佳实践）

```markdown
## 使用示例

### 推荐用法（分离参数）
```html
<js-component-name
current="65"
max="100"
showPercent="true"
theme="dark"
/>
```

### 简化配置
```html
<js-component-name
color="blue"
size="large"
animation="true"
/>
```
```

### 方案3：单引号JSON（兼容格式）

```markdown
## 使用示例

### 兼容格式
```html
<js-component-name
data="{'current':65,'max':100,'showPercent':true}"
theme="dark"
/>
```
```

## 🚨 禁止的格式

### ❌ 绝对不能使用的格式

```markdown
<!-- 错误示例 - 不要在文档中包含这些格式 -->

❌ 双引号嵌套：
<js-component-name data="{"current":65,"max":100}" />

❌ 无效属性语法：
<js-component-name theme=""dark"" />

❌ 未转义特殊字符：
<js-component-name data='{"message":"Hello "World"!"}' />
```

## 📝 文档模板

### 标准组件文档模板

```markdown
# [组件名称] 使用指南

## 📋 参数说明

| 参数名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| data | json | 是 | {} | 数据对象，包含组件配置 |
| theme | string | 否 | "light" | 主题模式：light/dark |

## 🚀 使用示例

### 基础用法
```html
<js-[组件名]
data="{&quot;key&quot;:&quot;value&quot;}"
theme="dark"
/>
```

### 推荐用法（分离参数）
```html
<js-[组件名]
key="value"
theme="dark"
/>
```

### 高级用法
```html
<js-[组件名]
data="{&quot;config&quot;:{&quot;style&quot;:&quot;modern&quot;,&quot;animation&quot;:true}}"
/>
```

## 🧪 测试用例

```html
<!-- 测试1：基本功能 -->
<js-[组件名] key="test" />

<!-- 测试2：完整配置 -->
<js-[组件名]
data="{&quot;complete&quot;:true,&quot;value&quot;:123}"
theme="dark"
/>
```

## 🔧 故障排除

如果组件不显示：
1. 检查JSON格式是否正确
2. 确认使用了正确的转义格式
3. 验证所有必需参数都已提供
4. 查看浏览器控制台错误信息
```

## 🎨 特殊场景处理

### 1. 包含特殊字符的JSON

```markdown
### 处理特殊字符
```html
<!-- 包含引号的文本 -->
<js-component-name
message="{&quot;text&quot;:&quot;Hello \\&quot;World\\&quot;!&quot;}"
/>

<!-- 包含换行符的文本 -->
<js-component-name
content="{&quot;multiline&quot;:&quot;Line 1\\nLine 2&quot;}"
/>
```
```

### 2. 数组参数

```markdown
### 数组数据
```html
<!-- 字符串数组 -->
<js-component-name
items="[&quot;item1&quot;,&quot;item2&quot;,&quot;item3&quot;]"
/>

<!-- 对象数组 -->
<js-component-name
users="[{&quot;name&quot;:&quot;Alice&quot;},{&quot;name&quot;:&quot;Bob&quot;}]"
/>
```
```

### 3. 嵌套对象

```markdown
### 复杂嵌套结构
```html
<js-component-name
config="{&quot;ui&quot;:{&quot;theme&quot;:&quot;dark&quot;,&quot;size&quot;:&quot;large&quot;},&quot;data&quot;:{&quot;count&quot;:42}}"
/>
```
```

## 🔍 验证工具

### JSON格式验证

```javascript
// 验证JSON格式的工具函数
function validateJsonExample(example) {
  try {
    JSON.parse(example)
    return { valid: true }
  } catch (error) {
    return { valid: false, error: error.message }
  }
}

// 转义工具
function escapeForHtml(jsonString) {
  return jsonString.replace(/"/g, '&quot;')
}
```

## 📋 检查清单

在生成组件文档时，确保：

- [ ] 所有JSON示例都是有效的JSON格式
- [ ] 使用了正确的HTML实体转义（&quot;）
- [ ] 提供了分离参数的替代方案
- [ ] 包含了完整的测试用例
- [ ] 添加了故障排除指南
- [ ] 验证了所有示例在实际环境中可用

## 🎯 最终目标

确保生成的组件文档：
1. **格式正确**：所有JSON参数都能正确解析
2. **跨环境兼容**：在开发和生产环境中都能正常工作
3. **用户友好**：提供多种使用方式和清晰的示例
4. **易于调试**：包含详细的错误处理指南

遵循这些规则，可以确保生成的JS组件文档质量高、易用性强，避免用户在使用过程中遇到JSON解析错误。
