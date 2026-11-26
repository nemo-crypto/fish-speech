import { stretchSpeech, encodeWav } from "./voice-dsp.js?v=3";

const byId = (id) => document.getElementById(id);
const original = byId("original-audio");
const converted = byId("converted-audio");
const download = byId("voice-download");
const fileInput = byId("voice-file");
const generate = byId("voice-generate");
const record = byId("record");
const clear = byId("voice-clear");
const pitch = byId("pitch");
const speed = byId("speed");
const maxDuration = 60;
const maxBytes = 15 * 1024 * 1024;
const sampleRate = 24000;

let source;
let inputVersion = 0;
let recording;
let waitingForMic = false;
let loading = false;
let processing = false;

function status(message, error = false) {
  const element = byId("voice-status");
  element.textContent = message;
  element.classList.toggle("error", error);
}

function updateControls() {
  fileInput.disabled = waitingForMic || Boolean(recording);
  record.disabled =
    waitingForMic ||
    !navigator.mediaDevices?.getUserMedia ||
    !window.MediaRecorder;
  clear.disabled = (!source && !loading) || waitingForMic || Boolean(recording);
  generate.disabled =
    !source || loading || processing || waitingForMic || Boolean(recording);
}

function replaceAudio(player, blob) {
  player.pause();
  const oldUrl = player.getAttribute("src");
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  player.removeAttribute("src");
  if (blob) player.src = URL.createObjectURL(blob);
  player.hidden = !blob;
  player.load();
}

function clearResult() {
  replaceAudio(converted);
  download.removeAttribute("href");
  download.hidden = true;
  byId("voice-empty").hidden = false;
}

async function loadSource(file, title, version = ++inputVersion) {
  source = undefined;
  loading = true;
  clearResult();
  replaceAudio(original);
  byId("source-meta").hidden = true;
  updateControls();
  status("正在读取音频…");

  try {
    if (!file.size || file.size > maxBytes)
      throw new Error("请选择不超过 15 MB 的音频。");
    const decoder = new OfflineAudioContext(1, 1, sampleRate);
    let data;
    try {
      data = await decoder.decodeAudioData(await file.arrayBuffer());
    } catch {
      throw new Error("无法读取这段音频，请尝试 WAV、MP3 或 M4A。");
    }
    if (version !== inputVersion) return;
    if (data.duration > maxDuration + 0.1)
      throw new Error("请将音频剪到 60 秒以内。");
    if (data.duration < 0.1)
      throw new Error("音频过短，请使用至少 0.1 秒的片段。");
    source = data;
    replaceAudio(original, file);
    const meta = byId("source-meta");
    meta.textContent = title + " · " + data.duration.toFixed(1) + " 秒";
    meta.hidden = false;
    status("");
  } catch (error) {
    if (version === inputVersion) status(error.message, true);
  } finally {
    if (version === inputVersion) {
      loading = false;
      updateControls();
    }
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) void loadSource(file, file.name);
});

clear.addEventListener("click", () => {
  inputVersion++;
  source = undefined;
  loading = false;
  fileInput.value = "";
  byId("source-meta").hidden = true;
  replaceAudio(original);
  clearResult();
  status("");
  updateControls();
});

record.addEventListener("click", async () => {
  if (recording) {
    if (recording.state !== "inactive") recording.stop();
    return;
  }
  waitingForMic = true;
  updateControls();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (byId("voice-panel").hidden) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    let limit;
    const release = () => {
      clearTimeout(limit);
      stream.getTracks().forEach((track) => track.stop());
      if (recording === recorder) recording = undefined;
      record.textContent = "开始录音";
      updateControls();
    };
    let failed = false;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      failed = true;
      release();
      status("录音中断，请重试或上传音频。", true);
    };
    recorder.onstop = () => {
      release();
      if (!failed) {
        fileInput.value = "";
        void loadSource(
          new Blob(chunks, { type: recorder.mimeType }),
          "麦克风录音",
        );
      }
    };
    recorder.start();
    recording = recorder;
    record.textContent = "结束录音";
    status("正在录音，最长 60 秒。");
    limit = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, 59500);
  } catch {
    stream?.getTracks().forEach((track) => track.stop());
    status("无法访问麦克风，请检查权限或上传音频。", true);
  } finally {
    waitingForMic = false;
    updateControls();
  }
});

function updateSliders() {
  const semitones = Number(pitch.value);
  byId("pitch-value").textContent =
    (semitones > 0 ? "+" : "") + semitones + " 半音";
  byId("speed-value").textContent = Number(speed.value).toFixed(2) + "×";
  for (const button of document.querySelectorAll("[data-pitch]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.pitch === pitch.value),
    );
  }
}

pitch.addEventListener("input", updateSliders);
speed.addEventListener("input", updateSliders);
for (const button of document.querySelectorAll("[data-pitch]")) {
  button.addEventListener("click", () => {
    pitch.value = button.dataset.pitch;
    updateSliders();
  });
}

byId("voice-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (generate.disabled) return;
  processing = true;
  const version = inputVersion;
  const input = source;
  const pitchRatio = 2 ** (Number(pitch.value) / 12);
  const length = Math.round(
    (input.duration * sampleRate) / Number(speed.value),
  );
  original.pause();
  clearResult();
  updateControls();
  status("正在应用变声…");

  try {
    const context = new OfflineAudioContext(
      1,
      Math.ceil((input.duration * sampleRate) / pitchRatio),
      sampleRate,
    );
    const node = context.createBufferSource();
    node.buffer = input;
    node.playbackRate.value = pitchRatio;
    node.connect(context.destination);
    node.start();
    const shifted = (await context.startRendering()).getChannelData(0);
    if (version !== inputVersion) return;
    const wav = encodeWav(
      stretchSpeech(shifted, length, sampleRate),
      sampleRate,
    );
    replaceAudio(converted, wav);
    download.href = converted.src;
    download.hidden = false;
    byId("voice-empty").hidden = true;
    status("变声完成。");
  } catch {
    if (version === inputVersion) status("变声处理失败，请重试。", true);
  } finally {
    processing = false;
    updateControls();
  }
});

for (const button of document.querySelectorAll("[data-tool]")) {
  button.addEventListener("click", () => {
    const voice = button.dataset.tool === "voice";
    byId("tts-panel").hidden = voice;
    byId("voice-panel").hidden = !voice;
    for (const item of document.querySelectorAll("[data-tool]")) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    if (voice) {
      byId("player").pause();
      if (byId("preview").textContent === "停止朗读") byId("preview").click();
    } else {
      original.pause();
      converted.pause();
      if (recording?.state === "recording") recording.stop();
    }
  });
}
updateControls();
