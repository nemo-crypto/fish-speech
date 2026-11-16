# Reliability and performance review

Review date: 2026-11-16. This personal-fork branch includes the earlier reference-audio Base64 validation fix and a focused review of reference input, file loading, and cache behavior.

## Changes

- Reject blank TTS text and reference IDs containing trailing newlines, while preserving valid text unchanged.
- Report missing reference directories, empty reference sets, and missing transcripts as invalid input instead of silently creating directories or treating a missing transcript path as text.
- Treat excessively long inline transcripts as text; propagate other filesystem errors.
- Honor `use_cache="off"` by skipping hash computation and retention of newly encoded reference tokens. Existing cache entries are not erased.
- Skip directory scans on reference-ID cache hits. Cache-on hash reuse continues to use the current request's transcript.
- Enumerate files once, match extensions case-insensitively, exclude directories, avoid duplicate matches, and preserve natural sorting. Reference audio is loaded in deterministic natural order.

Intentional behavior changes: `list_files` with absent or empty extensions includes all files; reference-ID loading now uses natural order; missing references and blank TTS requests fail explicitly. Non-streaming invalid-input handling can return HTTP 400; streaming responses may already have sent headers before a reference error occurs.

## Validation

From the local checkout:

```sh
.venv/bin/python -m pytest -q tests/
```

Result: **107 passed, 5 skipped, 26 warnings, 62 subtests passed**. CUDA/SM89 and multi-GPU checks were skipped on the Apple development machine. Tests exercise actual dependencies and small models; reference-focused tests mock the encoder and need no pretrained weights. The new reference IO tests failed before the fixes (9 failures and 1 error).

Modified Python files were checked with Black (Python 3.10 target), isort (Black profile), and bytecode compilation. Runtime dependency manifests and lockfiles were not changed. The local ignored `.venv` uses TensorBoard 2.20.0, consistent with the repository lockfile and its protobuf constraint.

## Microbenchmark

Listing 1,000 WAV files with `AUDIO_EXTENSIONS`, 20 calls per repetition, five repetitions on the same machine:

| Version | Median elapsed time |
| --- | --- |
| Before | 0.181840 s |
| After | 0.158991 s |

This is about 12.6% lower elapsed time for this directory-listing workload only. It is not a speech-generation throughput measurement. Cache hits additionally avoid directory enumeration, and cache-off avoids hashing and retention.

## Scope and remaining limits

This is not a comprehensive security audit or a production readiness certification. Cache-on storage remains unbounded and is not isolated by tenant. Server authentication, rate limiting, dependency vulnerability auditing, and reference storage permissions require separate review. No pretrained voice-cloning quality, GPU latency, GPU memory, or multi-GPU measurements were performed. Model weights, numerical precision, and voice-generation algorithms were not modified.

## Follow-up: reference creation failure ownership

Move exclusive reference-directory creation outside the copy/transcript cleanup handler. If another request wins creation after the existence check, this request now propagates FileExistsError without deleting the winner's directory. Failures after this invocation successfully creates the directory still clean it up. Also reject source directories before attempting an audio copy and preserve the original exception traceback.

A deterministic competing-mkdir regression failed before the change; the paired copy-failure test verifies that owned-directory cleanup remains intact. Full suite: **109 passed, 5 skipped, 62 subtests passed**. This fixes the creation-conflict case, not arbitrary concurrent deletion/replacement or a transactional multi-process reference store. The GPU and security-audit limitations above still apply.
