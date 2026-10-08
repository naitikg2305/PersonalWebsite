---
title: "Running Local LLMs: Quantization, VRAM Sizing, Chat Templates and Decoding"
category: "Applied LLMs: RAG, Local Models & Evaluation"
slug: "llm-local-models-quantization"
summary: "A practical guide to running open models on your own GPU: what 4-bit and 8-bit quantization really do, how to estimate VRAM, why chat templates matter, which decoding settings to use, and Ollama vs Hugging Face Transformers."
---

# Running Local LLMs: Quantization, VRAM Sizing, Chat Templates and Decoding

My first local model experiment was Phi-3 Mini (3.8B parameters) on a laptop RTX 3060 with 6 GB of VRAM. In FP16 it took about **150 seconds per answer**, with the GPU spiking up and down while the model thrashed between VRAM and system RAM. After switching to 4-bit quantization, the same model fit entirely on the GPU and answered in seconds. Later, on a 12 GB desktop GPU, I ran 4B to 14B models through Ollama. This article collects what those experiments taught me.

## Why run models locally?

- **Privacy:** prompts and documents never leave the machine.
- **Cost:** no per-token bills once you own the hardware.
- **Offline use:** works with no network after the download.
- **Control:** you choose the model, the quantization, and the decoding settings.

The trade-off is that you own the operations: memory limits, drivers, library versions, and prompt formatting. A hosted API hides all of that.

## Parameters are not bytes

"8B" means roughly 8 billion parameters. How much memory those parameters need depends on **precision**:

| Precision | Bytes per parameter | 3.8B model | 8B model |
|---|---:|---:|---:|
| FP32 | 4 | ~15 GB | ~32 GB |
| FP16 / BF16 | 2 | ~7.6 GB | ~16 GB |
| INT8 (8-bit) | 1 | ~3.8 GB | ~8 GB |
| 4-bit | ~0.5 + metadata | ~2-2.5 GB | ~4.5-6 GB |

That table explains my first failure. Phi-3 Mini in FP16 needs about 7.6 GB just for weights, which doesn't fit in 6 GB. With `device_map="auto"`, the library quietly offloaded layers to CPU RAM, and every token had to cross the PCIe bus. Measured on that laptop, 8-bit used roughly 5 GB and 4-bit roughly 3 GB.

Don't confuse the two "B"s. `qwen3:8b` means 8 **billion parameters**, and "8-bit" means **8 bits per weight**. They are independent dimensions.

## Sizing VRAM

Runtime VRAM is always more than the weight file:

```
runtime VRAM ≈ quantized weights + KV cache (grows with context) + runtime buffers + other GPU users
```

The **KV cache** stores attention keys and values for every token in the active context, so a longer context costs more memory. Doubling the context doesn't double the weights, but it can add gigabytes. Your desktop and display server use VRAM too.

Measurements from a 12 GB card running Ollama at an 8K context:

| Model | Download | Runtime VRAM | Placement |
|---|---:|---:|---|
| Qwen3 4B | 2.5 GB | ~3.9 GB | 100% GPU |
| Qwen3 8B | 5.2 GB | ~6.3 GB | 100% GPU |
| Qwen3 14B | 9.3 GB | ~10 GB | 100% GPU |

The most important rule is to **stay 100 percent on the GPU.** A larger model that spills to CPU is often worse in practice than a smaller one that fits, because speed collapses while quality barely improves. Leave 1 to 2 GB of headroom for KV-cache growth and the desktop. Check with `ollama ps` (look for "100% GPU") and `watch -n 1 nvidia-smi` while generating.

## What quantization actually does

Quantization stores weights with fewer bits. On GPUs (bitsandbytes, GGUF via llama.cpp/Ollama), it is usually **compressed weights feeding floating-point compute**, not pure integer inference:

- Weights are stored as 4-bit or 8-bit codes, plus per-group **scale factors**.
- At runtime, each block is **dequantized on the fly** to FP16/BF16 for the matrix multiply.
- The benefits are a 2 to 4x smaller footprint and less memory bandwidth per token. The cost is a small quality loss.

That is different from edge accelerators such as a Coral TPU, which run genuinely INT8 kernels end to end on a compiled graph. The shared idea is "fewer bits means smaller and often faster", but the mechanics differ.

**4-bit vs 8-bit:** 4-bit has the smallest footprint and slightly more quality loss. 8-bit uses about twice the memory and is closer to FP16 quality. For chat and RAG on a small GPU, 4-bit NF4 is the usual sweet spot.

### Loading a 4-bit model with Transformers + bitsandbytes

```python
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",            # NormalFloat4: better than plain int4 for LLM weights
    bnb_4bit_compute_dtype=torch.float16, # dequantize to fp16 for the matmuls
    bnb_4bit_use_double_quant=True,       # also quantize the scale factors
)

tok = AutoTokenizer.from_pretrained(MODEL_DIR)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_DIR,
    quantization_config=bnb,
    device_map="cuda:0",       # fail loudly instead of silently offloading
    local_files_only=True,
).eval()
```

For 8-bit, use `BitsAndBytesConfig(load_in_8bit=True)` and drop the `bnb_4bit_*` options.

**Download weights once.** Calling `from_pretrained("org/model-id")` on a server pulls from the Hugging Face cache or the network, which makes cold starts slow. I snapshot the model into a local directory once (`huggingface_hub.snapshot_download(..., local_dir="models/phi3-mini")`) and load with `local_files_only=True`.

**`device_map` choice:** `"auto"` is convenient but hides CPU offload. If you have one GPU and expect the model to fit, pin it with `"cuda:0"` so an OOM is an error, not a 50x slowdown.

## Chat templates are not optional

Instruction-tuned models were trained on a specific turn format. Phi-3's looks like this:

```
<|system|>
Keep it under 200 words.<|end|>
<|user|>
How does a car engine work?<|end|>
<|assistant|>
```

When I passed raw strings instead, the model hallucinated, continued my question, or never stopped. Never build this format by hand. Let the tokenizer do it:

```python
messages = [
    {"role": "system", "content": "You are a concise mechanical engineer. Keep it under 200 words."},
    {"role": "user", "content": question},
]
prompt = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tok(prompt, return_tensors="pt").to(model.device)
```

`add_generation_prompt=True` appends the assistant turn marker so the model knows it's its turn to speak. **System messages steer the model:** "keep it under 200 words" and a persona noticeably reduced rambling on open-ended questions.

Ollama applies the model's template for you, which is one reason it "just works".

## Decoding settings

```python
with torch.inference_mode():
    out = model.generate(
        **inputs,
        max_new_tokens=512,
        do_sample=False,            # greedy: deterministic, factual
        repetition_penalty=1.1,     # discourage loops
        eos_token_id=tok.eos_token_id,
        pad_token_id=tok.eos_token_id,
    )
answer = tok.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
```

| Setting | What it does | Typical value |
|---|---|---|
| `do_sample=False` | Always pick the most likely token (greedy) | RAG, extraction, evaluation |
| `do_sample=True` + `temperature` | Sample; higher temperature = more random | 0.2-0.7 for chat, higher for creative |
| `top_p` | Sample only from the smallest set of tokens covering probability p | 0.9-1.0 |
| `repetition_penalty` | Penalize repeated n-grams | 1.05-1.2 |
| `max_new_tokens` | Hard length cap | 256-1024 |

Two gotchas:

- **Decode only the new tokens.** `out[0]` contains the prompt *plus* the answer. Slice from the prompt length, or the reply will echo the whole prompt.
- **Stopping.** Many chat models have no dedicated pad token, so setting `pad_token_id = eos_token_id` silences warnings. Also check that the EOS token is the turn-end marker your template uses. For some models, the end-of-turn token (`<|end|>`) differs from the tokenizer's default EOS. If generation runs past the answer, pass both as stop IDs.

## Version drift: the bugs that aren't yours

My hardest local-model bugs had nothing to do with RAG. One model's cached remote modeling code was written for an older `transformers` release:

1. It read `config.rope_scaling["type"]`, which crashed because the local config had `rope_scaling: null`. My "fix" of inventing a scaling type made things worse, since the code only accepted specific values.
2. During generation, it read `past_key_values.seen_tokens`. Newer `transformers` replaced that attribute with `DynamicCache.get_seq_length()`, so it raised an `AttributeError`.

What fixed it: **load the model exactly the way a known-working script does** (no extra config overrides or attention-implementation flags), leave `rope_scaling` alone, and add a tiny compatibility shim:

```python
from transformers import DynamicCache
if not hasattr(DynamicCache, "seen_tokens"):
    DynamicCache.seen_tokens = property(lambda self: self.get_seq_length())
```

The lesson: pin `transformers`, `torch`, and `bitsandbytes` versions together, and when something breaks, diff your load path against a minimal working script before you start patching.

## Ollama vs Transformers

| | Ollama (llama.cpp, GGUF) | Transformers + bitsandbytes |
|---|---|---|
| Setup | `ollama run qwen3:8b`, then a local HTTP API | Python env, CUDA, version pinning |
| Quantization | Pre-quantized GGUF (Q4/Q5/Q8) | Quantized at load time (NF4/INT8) |
| Chat template | Applied automatically | You call `apply_chat_template` |
| Control | Options like `num_ctx`, temperature | Full access to generation, logits, hooks |
| Best for | Daily local chat, quick model comparison | Research, custom pipelines, fine-tuning |

```bash
ollama list          # local models
ollama ps            # loaded model + GPU/CPU placement
ollama show qwen3:14b
```

On servers, vLLM plays a similar role to Ollama: an efficient inference server behind an HTTP endpoint.

## Comparing models fairly

Use identical prompts and settings across candidates, and cover several task types: factual explanation, multi-step reasoning, code, long-document summarization, and instruction following with explicit constraints. Record answer quality, tokens per second, time to first token, VRAM, and GPU placement. The best model is the one that gives acceptable quality while staying fully GPU-resident. The biggest model that technically loads is usually not it.

## Key takeaways

- Memory ≈ parameters × bytes per parameter, plus the KV cache, plus buffers. FP16 needs about 2 bytes per parameter and 4-bit about 0.5.
- Stay 100 percent on the GPU. CPU offload is the difference between 3 seconds and 150 seconds.
- 4-bit NF4 with FP16 compute is the default sweet spot on consumer GPUs.
- Always use the model's chat template. Use system messages to steer length and persona.
- Use greedy decoding for factual and RAG work, and decode only the newly generated tokens.
- Pin library versions. Most "the model is broken" errors are version drift in the loading stack.
