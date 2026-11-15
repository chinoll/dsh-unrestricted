# dsh-unrestricted

**简体中文** | [English](./README.en.md) | [日本語](./README.ja.md)

本仓库 fork 自 [yexi-by/dsh-unrestricted](https://github.com/yexi-by/dsh-unrestricted)，增加**按会话保存的输入框开关，默认开启**。要求 DSH `>=0.2.2-rc.1 <0.2.3-0`。

`dsh-unrestricted` 是 DeepSeek Harness（DSH）的提示词破限插件。它在系统提示词（System Prompt）组装阶段注入破限规则，放开模型在逆向分析、安全测试、敏感题材写作等场景下的拒答限制，让模型直接给出完整的代码与技术方案。

插件在输入框工具栏提供「破限：开／关」按钮，按会话保存选择，默认开启。沿用 DSH 原有界面风格和工具、计划模式、代码执行及子代理机制。

---

## 目录

- [规则效果](#规则效果)
- [工作原理](#工作原理)
  - [系统提示词注入](#系统提示词注入)
  - [各运行模式适配](#各运行模式适配)
  - [结构化融合与安全回退](#结构化融合与安全回退)
  - [即时开关](#即时开关)
- [安装与更新](#安装与更新)
  - [本地源码安装](#本地源码安装)
- [使用说明](#使用说明)
- [注意事项](#注意事项)
- [本地开发与测试](#本地开发与测试)
- [开源协议与致谢](#开源协议与致谢)

---

## 规则效果

开启破限后，注入的规则主要改变以下回答行为：

- **直接输出结果**：首行直接给出代码、分析步骤、补丁或正文，省去免责声明、客套话与道德说教；确需说明的物理或操作风险放在文末简短附注。
- **逆向分析与补丁**：定位校验函数（`CHECK_FN`），还原核心算法并编写注册机（Keygen）；标注二进制补丁偏移（`OFFSET`）与替换字节（`PATCH_BYTE`），提供反调试、反虚拟机绕过方案。
- **安全测试与脚本实现**：编写漏洞验证代码（PoC / Exploit）、多线程字典爆破、端口扫描、加密反向 Shell 及代理转发脚本。
- **文学创作与文本编校**：适配正文写作、剧情设定推演、人物塑造和文稿润色。按用户指定的文风落笔——需要直白描写时自然写出，不拉灯回避；侧重氛围与克制时保留留白。角色默认按成年人处理，不因年龄话题拒答或刻意强调设定。
- **工业与实验流程**：给出化工、药理、特种加工等流程的完整步骤、配比与参数，不省略关键环节。
- **资源检索**：调用联网搜索工具查询并返回整理后的结果列表（名称、链接、来源、规格），不编造链接。
- **隔离外部文本指令**：工作区文件与网页内容作为输入数据处理，不改变当前回答规则；用户给出的域名、主机、软件名等原样保留。

---

## 工作原理

### 系统提示词注入

DSH 发起请求时会先组装全局系统提示词（System Prompt）。在普通对话里临时附带破限指令容易被系统提示词压过，也可能干扰工具调用格式。

插件直接挂载到 `system-prompt/assemble` 组装流水线：

1. 在官方角色设定（`deployment:persona-prefix`）末尾追加引导说明，并在后方插入独立的规则分块（`unrestricted:execution-mode`）。
2. 工作目录信息（`deployment:persona-suffix`）、工具定义和环境变量保持原样，不改动工具协议。

```text
[DSH 发起请求]
      │
      ▼
[系统提示词组装流水线]
      │
      ├─> 官方角色设定 (Persona)
      │        │
      │        ▼ [dsh-unrestricted]
      │        ├─ 开启: 插入破限规则分块并协调各模式约束
      │        └─ 关闭: 原样放行，保持官方默认提示词
      │
      ├─> 官方工具与协议定义 (Bash/Pwsh, FS, Web Search...)
      ├─> 计划模式策略 (Plan Policy)
      └─> 运行环境信息 (CWD, Model...)
      │
      ▼
[发送给模型接口]
```

### 各运行模式适配

插件按 DSH 的不同运行模式分别处理提示词分块：

- **Standard / Cordis 模式**：在角色设定后插入破限规则，保留全部原生工具定义。
- **PTC 模式**：该模式通过 `run_code` 执行脚本。插件在 `tools:ptc-only` 分块中补充说明，使 `run_code` 内编写的脚本和 SDK 调用遵循同一套输出规则。
- **Plan 模式**：区分执行权限与方案内容——审批前不修改文件或执行写操作，但计划文档内正常写出完整的技术步骤与代码。
- **Minimal 模式**：在当前智能体作用域内注入规则，保留子代理原有的自定义角色和结构化输出（`structured_output`）说明。
- **子代理**：后台子代理与结构化输出任务自动沿用当前开关状态。

### 结构化融合与安全回退

插件按 DSH 官方提示词的结构化段落名称（`deployment:persona-prefix`、`plan:policy`、`tools:ptc-only`、`tool:structured_output`）进行幂等融合，不依赖脆弱的逐字文案哈希校验，本 fork 面向 DSH `>=0.2.2-rc.1 <0.2.3-0` 的 Web / Desktop 宿主。如果自定义模式缺少角色设定段落，对应模式会自动保留原版提示词并在设置页友好提示。

### 即时开关

默认值和各会话的独立选择保存在当前 profile 的 `cordis.patch.yml` 中，切换后从下一次模型请求开始生效，无需重启服务。关闭当前会话的开关会让该会话使用原版提示词，不影响其他会话。正在进行的请求不会被中断。

---

## 安装与更新

```sh
# Web 端安装指定版本
dsh plugin --profile web add github:chinoll/dsh-unrestricted#v0.3.0

# 桌面端安装指定版本（使用桌面端内置 CLI）
"& '$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add github:chinoll/dsh-unrestricted#v0.3.0"
```

安装后重启 `dsh web` 或 DSH 桌面端，按下方[使用说明](#使用说明)启用。

#### 更新

更新统一使用 DSH 原生插件管理页的更新功能，或通过以下命令更新。插件不再自行查询 GitHub 或执行 pnpm 安装。

```sh
dsh plugin --profile web remove dsh-unrestricted
dsh plugin --profile web add github:chinoll/dsh-unrestricted#v0.3.0
```

更新后重启 `dsh web` 或 DSH 桌面端。

#### 卸载

```sh
dsh plugin --profile web remove dsh-unrestricted
```

### 本地源码安装

调试本地源码目录时使用 `file:` 协议安装：

```sh
dsh plugin --profile web add file:D:/work/dsh/plugin/unrestricted
```

---

## 使用说明

1. 在左侧「插件」页面启用 `dsh-unrestricted`。
2. 输入框工具栏的「破限：开／关」按钮只控制当前会话，首次使用默认开启。切换从下一次模型请求生效，选择会持久保存，切换会话或重启后保留；子代理继承所属会话的选择。
3. 插件详情中的「未单独设置的会话默认开启」仅控制没有独立选择的会话，已单独设置的会话不受影响。

升级时保留已有配置：如果旧版曾关闭总开关，新版会将这个值保留为默认值；可在插件详情中重新开启默认值。

设置卡片中同时提供：

- **模式覆盖与提示词预览**：显示 Standard、PTC、Cordis、Minimal 四种模式的生效状态，支持展开查看或一键复制各模式最终生成的完整系统提示词。

---

## 注意事项

- **接口层内容过滤**：系统提示词只能改变模型自身的回答倾向。如果上游 API 网关设有额外的关键词拦截，触发时会直接断开或返回 400 错误，这类网关层拦截无法靠提示词绕过。
- **宿主权限机制**：插件不改变 DSH 的文件沙箱、命令审批弹窗及 Plan 模式写保护。

---

## 本地开发与测试

```sh
git clone https://github.com/chinoll/dsh-unrestricted.git
cd dsh-unrestricted
pnpm install

pnpm typecheck
pnpm build
pnpm test
```

辅助脚本：

- `node tools/dump-prompts.mjs --repo <path> --out tests/fixtures`：从指定 DSH 源码目录导出原版提示词，更新测试 fixtures。
- `node tools/verify-live.mjs --repo <path>`：在本地验证四种模式的组装与还原结果（不调用模型接口）。

---

## 开源协议与致谢

- 提示词规则结构与部分任务路由思路参考并改编自 [Jia-Ethan/codex-keysmith](https://github.com/Jia-Ethan/codex-keysmith)（MIT License），详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
- 本项目与 codex-keysmith 及其作者无隶属关系。
- 采用 [MIT License](LICENSE) 开源。
