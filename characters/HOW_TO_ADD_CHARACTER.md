# 如何新增数字人角色

## 新增数字人角色步骤

### 第一步：创建角色配置文件

在 `characters/` 目录中创建一个新的 `.yaml` 文件，例如 `xiaoshi.yaml`

```yaml
# characters/xiaoshi.yaml - 石实实验学校数字人"小石"

character_config:
  # 基本信息
  conf_name: '小石'              # 显示在UI中的名称
  conf_uid: 'xiaoshi_001'         # 唯一标识符，必须唯一
  character_name: '小石'          # AI对话中使用的名字

  # Live2D 模型配置
  live2d_model_name: 'your_model_name'  # 需要在 model_dict.json 中定义

  # 个性设定（核心）
  persona_prompt: |
    你是石实实验学校的AI数字人助手"小石"。
    你是学校的学生向导，负责回答学生和家长的疑问。
    你性格温和、友善，对学校了如指掌。
    你的回答应该准确、简洁、友好。

    关于学校的基本信息：
    - 学校全称：石实实验学校
    - 办学理念：以人为本，全面发展
    - 你可以介绍学校的历史、成就、特色课程等信息
    - 对于不确定的问题，诚实回答"抱歉，这个信息我需要确认一下"

  # 头像图片（可选）
  avatar: 'xiaoshi.png'  # 将图片放到 /avatars 目录

  # TTS 配置（可选，覆盖主配置）
  tts_config:
    tts_model: 'edge_tts'
    edge_tts:
      voice: 'zh-CN-XiaoxiaoNeural'  # 中文女声
      rate: '+0%'
      volume: '+80%'
```

### 第二步：添加 Live2D 模型

1. 将 Live2D 模型文件夹放到 `live2d-models/` 目录
2. 在 `model_dict.json` 中添加模型定义：

```json
{
  "your_model_name": {
    "name": "你的模型名称",
    "url": "/live2d-models/your_model_folder/",
    "model_json": "your_model.model3.json"
  }
}
```

### 第三步：添加头像图片（可选）

1. 准备一个正方形图片（建议 256x256px）
2. 将图片放到 `avatars/` 目录
3. 在角色配置文件中设置 `avatar` 字段

### 第四步：重启应用

角色配置会自动加载，重启后即可在侧栏中看到新角色。

## 角色配置字段说明

| 字段 | 必需 | 说明 |
|------|------|------|
| conf_name | ✅ | 显示名称 |
| conf_uid | ✅ | 唯一标识符 |
| character_name | ✅ | AI对话中使用的名字 |
| live2d_model_name | ✅ | Live2D模型名称 |
| persona_prompt | ✅ | 个性设定提示词 |
| avatar | ❌ | 头像图片文件名 |

## 高级配置选项

### 不同的语音引擎
```yaml
tts_config:
  tts_model: 'azure_tts'  # 使用 Azure TTS
  azure_tts:
    voice: 'zh-CN-XiaoxiaoNeural'
```

### 不同的LLM模型
```yaml
agent_config:
  agent_settings:
    basic_memory_agent:
      llm_provider: 'openai_llm'
  llm_configs:
    openai_llm:
      model: 'gpt-4o-mini'
      temperature: 0.7
```

### ASR 配置
```yaml
asr_config:
  asr_model: 'sherpa_onnx'
  sherpa_onnx_asr:
    model_type: 'sense_voice'
```

## 多角色管理

可以创建多个角色配置文件：
- `xiaoshi.yaml` - 校园向导小石
- `teacher.yaml` - 教师助手
- `librarian.yaml` - 图书馆管理员

每个角色可以有独特的个性和声音配置。

## 注意事项

1. **conf_uid 必须唯一**：每个角色的 conf_uid 不能重复
2. **模型必须存在**：live2d_model_name 必须在 model_dict.json 中定义
3. **提示词质量**：persona_prompt 的质量直接影响角色的表现
4. **测试验证**：创建角色后建议进行对话测试
