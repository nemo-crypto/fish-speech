# Fish Speech — Text-to-Speech and Voice Cloning

A personal fork of [fishaudio/fish-speech](https://github.com/fishaudio/fish-speech), with fixes for reference-audio validation, cache behavior, file loading, and reference creation. **语音合成与声音克隆项目：重点改善参考音频处理、错误提示和缓存行为。**

## 使用导航

[项目定位](#项目定位) · [优化说明](#优化说明) · [本地运行](#本地运行) · [验证与边界](#验证与边界) · [原项目文档](#原项目文档)

## 项目定位

适合研究和集成文本转语音（TTS / speech synthesis）、参考音色与声音克隆流程。本仓库是社区贡献 fork，模型、权重和主要生成能力来自 Fish Audio；不是官方服务或独立训练的新模型。

已验证的集成优化位于默认 `main` 分支；首轮独立上游贡献位于 `fix/reliability-review`。安装原项目、官方镜像或官方服务，不代表已经包含本 fork 的待合并补丁。

## 优化说明

| 场景 | 修改后的行为 | 对使用者的意义 |
| --- | --- | --- |
| JSON Base64 与 MessagePack 原始参考音频 | 在字段边界校验，保留合法传输方式 | 无效数据更早被发现 |
| 空白 TTS 文本、非法参考 ID | 返回明确校验错误 | 避免无意义推理或难定位的失败 |
| 参考目录/音频/转录文件缺失 | 明确报告缺失，不创建空目录 | 用户更容易修正请求和文件布局 |
| `use_memory_cache="off"` | 不为新参考音频计算缓存哈希或保留 tokens | 关闭缓存时行为与选项含义一致 |
| 缓存命中 | 复用音频 tokens；ID 命中跳过目录扫描 | 减少重复工作，当前请求文本仍生效 |
| 大小写扩展名、重复匹配、长内联文本 | 单次枚举、过滤目录、自然排序，长文本可直接使用 | 文件组织和输入更可预测 |
| 参考音色列表与单采样音频 | 仅列出完整可加载的文件布局，保持解码波形为一维数组 | 避免选中无法加载的音色，以及单采样输入变成标量 |
| 两个请求同时新增同名音色 | 创建失败的请求不删除成功请求的目录 | 修复创建冲突中的数据误删风险 |

关闭缓存不会清空之前已存在的缓存。缓存开启时仍未实现容量上限或租户隔离。流式响应一旦发送 headers，后续参考音频错误可能中断流，而不是返回新的 HTTP 400。

## 本地运行

建议 Python 3.12 和 `uv`。请先按 [安装指南](docs/en/install.md) 选择对应平台的 CPU/CUDA 依赖；以下是支持 CPU extra 的环境示例：

```sh
git clone https://github.com/nemo-crypto/fish-speech.git
cd fish-speech
uv sync --python 3.12 --extra cpu
```

CUDA 环境按指南选择对应 extra，不要同时安装互斥的 CPU/CUDA extras。macOS 依赖与硬件支持也应按安装指南确认。完成依赖安装后，按 [推理指南](docs/en/inference.md) 下载匹配的模型权重并选择 CLI、API 或 WebUI；克隆代码不等于模型已就绪。

参考音色目录示例：

```text
references/
  speaker-1/
    sample.wav
    sample.lab
```

`.lab` 文件存放对应音频的 UTF-8 转录文本。请求中 `reference_id` 使用 `speaker-1`，不要传入目录路径；ID 允许字母、数字、连字符、下划线和空格，最长 255 个字符。

## 验证与边界

在安装好项目及测试依赖的环境运行：

```sh
python -m pytest -q tests/
```

集成分支结果为 **117 项通过、5 项跳过、62 个 subtests 通过**。GPU 专用检查在本地 Apple 环境跳过；本次没有验证完整预训练模型的克隆音质或 GPU 性能。目录扫描微基准中位耗时从 0.181840 降到 0.158991 秒，仅针对该文件扫描工作负载。

测试环境、可见行为变化与剩余边界见 [逐项审查报告](docs/reliability-performance-review.md)。这不是完整安全审计；服务鉴权、限流和并发存储事务仍需独立设计。

## 贡献与来源

[本次上游 PR #1378](https://github.com/fishaudio/fish-speech/pull/1378)；Base64 校验单独见 [#1377](https://github.com/fishaudio/fish-speech/pull/1377)。

本 fork 保留原项目署名及 [许可证](LICENSE)；代码与不同模型权重的授权条件请以原项目文件为准。修复通过 PR 提交给上游，提交不代表已被接受。可在本 fork 的 [PR 列表](https://github.com/nemo-crypto/fish-speech/pulls) 查看集成情况。

## 原项目文档

以下保留 Fish Audio 的模型介绍、多语言文档、许可说明和部署入口。

<div align="center">
<h1>Fish Speech</h1>

**English** | [简体中文](docs/README.zh.md) | [Portuguese](docs/README.pt-BR.md) | [日本語](docs/README.ja.md) | [한국어](docs/README.ko.md) | [العربية](docs/README.ar.md) | [Español](docs/README.es.md)  <br>

<a href="https://www.producthunt.com/products/fish-speech?embed=true&utm_source=badge-top-post-badge&utm_medium=badge&utm_source=badge-fish&#0045;audio&#0045;s1" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=1023740&theme=light&period=daily&t=1761164814710" alt="Fish&#0032;Audio&#0032;S1 - Expressive&#0032;Voice&#0032;Cloning&#0032;and&#0032;Text&#0045;to&#0045;Speech | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
<a href="https://trendshift.io/repositories/7014" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/7014" alt="fishaudio%2Ffish-speech | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/>
</a>
<br>
</div>
<br>

<div align="center">
    <img src="https://count.getloli.com/get/@fish-speech?theme=asoul" /><br>
</div>

<br>

<div align="center">
    <a target="_blank" href="https://discord.gg/Es5qTB9BcN">
        <img alt="Discord" src="https://img.shields.io/discord/1214047546020728892?color=%23738ADB&label=Discord&logo=discord&logoColor=white&style=flat-square"/>
    </a>
    <a target="_blank" href="https://hub.docker.com/r/fishaudio/fish-speech">
        <img alt="Docker" src="https://img.shields.io/docker/pulls/fishaudio/fish-speech?style=flat-square&logo=docker"/>
    </a>
    <a target="_blank" href="https://pd.qq.com/s/bwxia254o">
      <img alt="QQ Channel" src="https://img.shields.io/badge/QQ-blue?logo=tencentqq">
    </a>
</div>

<div align="center">
    <a target="_blank" href="https://huggingface.co/fishaudio/drama-3">
        <img alt="HuggingFace Drama 3" src="https://img.shields.io/badge/🤗%20-Drama%203-orange"/>
    </a>
    <a target="_blank" href="https://huggingface.co/fishaudio/s2-pro">
        <img alt="HuggingFace S2-Pro" src="https://img.shields.io/badge/🤗%20-S2--Pro-orange"/>
    </a>
    <a target="_blank" href="https://fish.audio/blog/fish-audio-open-sources-s2/">
        <img alt="Fish Audio Blog" src="https://img.shields.io/badge/Blog-Fish_Audio_S2-1f7a8c?style=flat-square&logo=readme&logoColor=white"/>
    </a>
    <a target="_blank" href="https://arxiv.org/abs/2610.18010">
        <img alt="Paper | Technical Report" src="https://img.shields.io/badge/Paper-Technical_Report-b31b1b?style=flat-square"/>
    </a>
</div>

> [!IMPORTANT]
> **License Notice**  
> This codebase and its associated model weights are released under **[FISH AUDIO COMMUNITY LICENSE](LICENSE)**. The S2-Pro weights remain under the Fish Audio Research License. Please refer to [LICENSE](LICENSE) for more details. We will take action against any violation of the license.

> [!WARNING]
> **Legal Disclaimer**  
> We do not hold any responsibility for any illegal usage of the codebase. Please refer to your local laws about DMCA and other related laws.

## Quick Start

### For Human

- [Installation](https://speech.fish.audio/install/): environment setup, download weights, Docker deployment
- [Inference](https://speech.fish.audio/inference/): command line, API server, WebUI

> [!IMPORTANT]
> **We strongly recommend SGLang-Omni for users who care about efficiency; see the [SGLang-Omni README](https://github.com/sgl-project/sglang-omni/blob/main/sglang_omni/models/fishaudio_drama_3/README.md).**
>
> **For vLLM Omni server, please read [vLLM-Omni Fish Speech S2 Pro Recipe](https://github.com/vllm-project/vllm-omni/blob/main/recipes/fishaudio/Fish-Speech-S2-Pro.md) and the [User Guide](https://github.com/vllm-project/vllm-omni/blob/main/docs/user_guide/examples/online_serving/text_to_speech.md#fish-speech-s2-pro).**

### For LLM Agent

```
Install and configure Fish Audio Drama 3 (or S2-Pro) by following the instructions here: https://speech.fish.audio/install/
```

## Models

| Model | Size | Weights | Description |
|------|------|-------------|-------------|
| **Drama 3** | 35B-A3B (3B active per token) | [HuggingFace](https://huggingface.co/fishaudio/drama-3) | New-generation flagship for multi-character scenes and long content, with multi-turn revision and local editing |
| S2-Pro | 4B parameters | [HuggingFace](https://huggingface.co/fishaudio/s2-pro) | Previous-generation flagship with faster inference |

The model type is detected from the checkpoint's `config.json`, and both share the same command line and API server.

---

## Fish Audio Drama 3

**The new-generation voice model, upgraded across the board over S2-Pro.**

Like the S2 series, Drama 3 supports multi-speaker generation, voice cloning and natural-language control, but it makes clear advances in long-form audio, interaction and editability.

### Key features

- **Multi-turn director revision**: guide the previous take directly ("gentler, and a bit sadder"), and the model regenerates it with that context instead of starting over.
- **Infilling and precise editing**: edit audio the way you edit text — replace a single word ("Wednesday" → "Thursday") while the surrounding timbre and transitions stay natural.
- **Scene-style multi-character production**: voice a complete scene with several characters straight from a script description, with streaming support for long text.
- **Long dialogues and long speech**: built for long recordings and extended sessions, keeping characters and timbre stable throughout.
- **Stronger expressiveness**: laughter, crying, whispers and dramatic emotion are no longer flattened by the reference, so the delivery is much closer to a real performance.
- **Multilingual voice cloning**: sets a new level of SOTA for cross-lingual cloning error rates (CER / WER).
- **Natural-language tag control**: inline tags such as `[whisper]`, `[angry]` and `[laughing]` control emotion and prosody.

### What changed compared with S2-Pro

| Capability | S2-Pro | Drama 3 |
| --- | --- | --- |
| Multi-speaker | Supported | Supported, as scene-style multi-character production |
| Voice cloning | Supported | Supported, with lower multilingual error rates |
| Inline natural-language instructions | Supported | Supported |
| Local editing / infilling | Not supported | Supported |
| Multi-turn director revision | Not supported | Supported |
| Long content | Chunked generation | Long dialogues and long speech, with streaming |
| Strong emotion (laughter, crying, whispers) | Moderate | Stronger |

### Results

Drama 3 takes a clear leap over S2 on public benchmarks: multilingual voice cloning (MiniMax Multilingual Testset), free-form speech editing (Ming-Freeform) and multi-turn emotion revision (Step-Audio-Edit), where control precision, multilingual error rates (CER / WER) and style accuracy all surpass the previous generation.

Read the [technical report](https://arxiv.org/abs/2610.18010) for the architecture, the training recipe and the full evaluation results.

---

## Fish Audio S2-Pro

Our previous-generation flagship: natural-language controllable and emotionally expressive speech, about a hundred languages, and small enough to deploy on a consumer GPU.

- **Inline natural-language instructions**: tags such as `[pause]`, `[excited]` and `[whisper]` control prosody and emotion anywhere in the text.
- **Native multi-speaker generation**: speaker IDs separate the characters inside one text, so you no longer generate and concatenate one speaker at a time.
- **Rapid voice cloning**: 10–30 seconds of reference audio is enough to reproduce a timbre.
- **Single pass**: long audio can be streamed out in one go.
- **Production streaming**: RTF 0.195 on a single H200, about 100 ms to first audio.

Visit the [Fish Audio website](https://fish.audio/) for a live playground, and read the [blog post](https://fish.audio/blog/fish-audio-open-sources-s2/) and [technical report](https://arxiv.org/abs/2603.08823) for more details.

<details>
<summary><b>S2-Pro benchmark results (click to expand)</b></summary>

| Benchmark | Fish Audio S2 |
|------|------|
| Seed-TTS Eval — WER (Chinese) | **0.54%** (best overall) |
| Seed-TTS Eval — WER (English) | **0.99%** (best overall) |
| Audio Turing Test (with instruction) | **0.515** posterior mean |
| EmergentTTS-Eval — Win Rate | **81.88%** (highest overall) |
| Fish Instruction Benchmark — TAR | **93.3%** |
| Fish Instruction Benchmark — Quality | **4.51 / 5.0** |
| Multilingual (MiniMax Testset) — Best WER | **11 of 24** languages |
| Multilingual (MiniMax Testset) — Best SIM | **17 of 24** languages |

On Seed-TTS Eval, S2 achieves the lowest WER among all evaluated models including closed-source systems: Qwen3-TTS (0.77/1.24), MiniMax Speech-02 (0.99/1.90), Seed-TTS (1.12/2.25). On the Audio Turing Test, 0.515 surpasses Seed-TTS (0.417) by 24% and MiniMax-Speech (0.387) by 33%. On EmergentTTS-Eval, S2 achieves particularly strong results in paralinguistics (91.61% win rate), questions (84.41%), and syntactic complexity (83.39%).

<img src="./docs/assets/totalability.png" width=200%>

</details>

## Credits

- [VITS2 (daniilrobnikov)](https://github.com/daniilrobnikov/vits2)
- [Bert-VITS2](https://github.com/fishaudio/Bert-VITS2)
- [GPT VITS](https://github.com/innnky/gpt-vits)
- [MQTTS](https://github.com/b04901014/MQTTS)
- [GPT Fast](https://github.com/pytorch-labs/gpt-fast)
- [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS)
- [Qwen3](https://github.com/QwenLM/Qwen3)

## Tech Report
```bibtex
@misc{fish-speech-v1.4,
      title={Fish-Speech: Leveraging Large Language Models for Advanced Multilingual Text-to-Speech Synthesis},
      author={Shijia Liao and Yuxuan Wang and Tianyu Li and Yifan Cheng and Ruoyi Zhang and Rongzhi Zhou and Yijin Xing},
      year={2024},
      eprint={2411.01156},
      archivePrefix={arXiv},
      primaryClass={cs.SD},
      url={https://arxiv.org/abs/2411.01156},
}

@misc{liao2026fishaudios2technical,
      title={Fish Audio S2 Technical Report}, 
      author={Shijia Liao and Yuxuan Wang and Songting Liu and Yifan Cheng and Ruoyi Zhang and Tianyu Li and Shidong Li and Yisheng Zheng and Xingwei Liu and Qingzheng Wang and Zhizhuo Zhou and Jiahua Liu and Xin Chen and Dawei Han},
      year={2026},
      eprint={2603.08823},
      archivePrefix={arXiv},
      primaryClass={cs.SD},
      url={https://arxiv.org/abs/2603.08823}, 
}

@misc{liao2026fishaudiodrama3technical,
      title={Fish Audio Drama 3 Technical Report}, 
      author={Dawei Han and Shidong Li and Shijia Liao and Jiahua Liu and Songting Liu and Qingzheng Wang and Yuxuan Wang and Xin Chen and Yifan Cheng and Tianyu Li and Gangin Park and Xuehao Yang and Chang Zeng and Haoyang Zhang and Ruoyi Zhang and Xiangyu Zhang},
      year={2026},
      eprint={2610.18010},
      archivePrefix={arXiv},
      primaryClass={cs.SD},
      url={https://arxiv.org/abs/2610.18010}, 
}
```
