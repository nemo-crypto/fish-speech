const byId = (id) => document.getElementById(id);
const form = byId("studio");
const text = byId("text");
const mode = byId("mode");
const provider = byId("provider");
const player = byId("player");
const download = byId("download");
const preview = byId("preview");
const publicOrigin = "https://fishaudio-drama-3.hf.space";
const cloudEndpoint = "https://api.fish.audio/v1/tts";
const samples = {
  zh: "你好，欢迎来到语音工作室。文字可以很轻，声音可以走得很远。",
  en: "Welcome to the speech studio. Take a moment to hear how a simple sentence comes to life.",
};
let pending = null;
let audioUrl = null;
let speaking = null;

function setStatus(message, error = false) {
  const status = byId("status");
  status.textContent = message;
  status.classList.toggle("error", error);
}

function readInput() {
  const content = text.value.trim();
  if (!content) throw new Error("请输入要合成的文字。");
  if (content.length > 2000) throw new Error("合成文本最多 2,000 字符。");
  return content;
}

function getEndpoint() {
  if (provider.value === "cloud") return cloudEndpoint;
  let endpoint;
  try {
    endpoint = new URL(byId("endpoint").value.trim());
  } catch {
    throw new Error("请填写有效的 Fish Speech 服务地址。");
  }
  const loopback = ["127.0.0.1", "localhost"].includes(endpoint.hostname);
  if (
    !(
      endpoint.protocol === "https:" ||
      (loopback && endpoint.protocol === "http:")
    ) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error(
      "请使用 HTTPS 服务地址，或本机 HTTP 地址。地址不能包含凭据、查询参数或片段。",
    );
  }
  const path = endpoint.pathname.replace(/\/+$/, "");
  endpoint.pathname = path.endsWith("/v1/tts") ? path : path + "/v1/tts";
  return endpoint.href;
}

function referenceAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () =>
      reject(new Error("无法读取参考音频，请重新选择文件。"));
    reader.readAsDataURL(file);
  });
}

async function makeRequest(content, signal) {
  const endpoint = getEndpoint();
  const key = byId("key").value.trim();
  if (provider.value === "cloud" && !key) {
    byId("connection").open = true;
    byId("key").focus();
    throw new Error("请填写 Fish Audio API Key，或切换为自建服务。");
  }

  const format = byId("format").value;
  const headers = { "Content-Type": "application/json" };
  const body = { text: content, format, streaming: false };
  if (key) headers.Authorization = "Bearer " + key;
  if (provider.value === "local") body.use_memory_cache = "off";

  if (mode.value === "id") {
    const id = byId("voice").value.trim();
    if (!id) throw new Error("请输入已有音色 ID。");
    body.reference_id = id;
  }
  if (mode.value === "audio") {
    const file = byId("reference").files[0];
    const transcript = byId("transcript").value.trim();
    if (!file || !transcript || !file.size)
      throw new Error("请上传参考音频并填写录音原文。");
    if (file.size > 3 * 1024 * 1024) throw new Error("参考音频不能超过 3 MB。");
    body.references = [
      { audio: await referenceAsBase64(file), text: transcript },
    ];
  }
  signal.throwIfAborted();
  return { endpoint, headers, body, format };
}

function statusError(code) {
  if (code === 401 || code === 403)
    return "服务拒绝了请求，请检查 API Key 和账户权限。";
  if (code === 402) return "账户额度不足，请检查 Fish Audio 账户余额。";
  if (code === 429) return "请求过于频繁，请稍后再试。";
  if (code === 400 || code === 422)
    return "服务无法处理当前输入，请检查文本、音色 ID 或参考音频。";
  return "推理服务返回错误（HTTP " + code + "）。";
}

async function generateFromAPI(content, signal) {
  const request = await makeRequest(content, signal);
  setStatus("正在合成语音，请稍候…");
  const response = await fetch(request.endpoint, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal,
    redirect: "error",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(statusError(response.status));
  const mime = response.headers.get("content-type")?.split(";")[0].trim();
  if (!mime?.startsWith("audio/") && mime !== "application/octet-stream") {
    throw new Error("服务没有返回音频，请检查服务地址和接口配置。");
  }
  const audio = await response.blob();
  if (!audio.size) throw new Error("服务返回了空音频，请重试。");
  return {
    audio,
    format: request.format,
    mime: request.format === "mp3" ? "audio/mpeg" : "audio/wav",
  };
}

function publicUrl(value, base = publicOrigin) {
  const url = new URL(value, base);
  if (url.origin !== publicOrigin)
    throw new Error("公开服务返回了未知音频地址。");
  return url;
}

async function generatePublic(content, signal) {
  if (content.length > 500) throw new Error("公开体验每次最多 500 字符。");
  const call = await fetch(publicOrigin + "/gradio_api/call/v2/perform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    signal,
    body: JSON.stringify({
      text: content,
      mode: "Surprise",
      voice: "clone1",
      transcript: "",
      name: "",
      description: "",
      scene: "",
      temperature: 1,
      top_p: 0.9,
      top_k: 0,
    }),
  });
  if (!call.ok) throw new Error(statusError(call.status));
  const { event_id: id } = await call.json();
  if (typeof id !== "string" || !/^[a-f0-9]+$/i.test(id)) {
    throw new Error("公开服务没有返回任务编号。");
  }
  setStatus("正在排队或合成语音，请稍候…");
  const events = await fetch(publicOrigin + "/gradio_api/call/perform/" + id, {
    signal,
  });
  if (!events.ok) throw new Error(statusError(events.status));
  const complete = (await events.text()).match(
    /^event: complete\r?\ndata: ([^\r\n]+)/m,
  );
  const result = complete && JSON.parse(complete[1])?.[0];
  if (!result?.url)
    throw new Error("公开服务未返回音频，可能已达到免费额度，请稍后重试。");

  const url = publicUrl(result.url);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(statusError(response.status));
  if (!result.is_stream) {
    const audio = await response.blob();
    if (!audio.size) throw new Error("公开服务返回了空音频。");
    const mp3 = audio.type === "audio/mpeg" || url.pathname.endsWith(".mp3");
    const wav =
      /audio\/(?:x-)?wav/i.test(audio.type) || url.pathname.endsWith(".wav");
    if (!mp3 && !wav) throw new Error("公开服务返回了未知音频格式。");
    return {
      audio,
      format: mp3 ? "mp3" : "wav",
      mime: mp3 ? "audio/mpeg" : "audio/wav",
    };
  }
  // Gradio returns a finalized playlist of AAC segments in streaming mode.
  const manifest = await response.text();
  const segments = manifest
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (
    !manifest.includes("#EXT-X-ENDLIST") ||
    !segments.length ||
    segments.length > 250
  ) {
    throw new Error("公开服务未返回完整音频。");
  }
  const parts = [];
  for (let start = 0; start < segments.length; start += 8) {
    const batch = segments.slice(start, start + 8);
    parts.push(
      ...(await Promise.all(
        batch.map(async (segment) => {
          const segmentUrl = publicUrl(segment, url);
          if (!segmentUrl.pathname.endsWith(".aac"))
            throw new Error("公开服务返回了未知音频格式。");
          const chunk = await fetch(segmentUrl, { signal });
          if (!chunk.ok) throw new Error(statusError(chunk.status));
          return chunk.arrayBuffer();
        }),
      )),
    );
  }
  return { audio: new Blob(parts), format: "aac", mime: "audio/aac" };
}

async function handleSubmit(event) {
  event.preventDefault();
  if (pending) return;
  const controller = new AbortController();
  pending = controller;
  const timer = setTimeout(() => controller.abort("timeout"), 120000);
  byId("generate").disabled = true;
  byId("cancel").hidden = false;
  setStatus("正在准备语音合成…");

  try {
    stopPreview();
    const content = readInput();
    const { audio, format, mime } = await (provider.value === "public"
      ? generatePublic(content, controller.signal)
      : generateFromAPI(content, controller.signal));
    const url = URL.createObjectURL(new Blob([audio], { type: mime }));
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = url;
    player.src = audioUrl;
    download.href = audioUrl;
    download.download = "fish-speech." + format;
    player.hidden = download.hidden = false;
    byId("empty").hidden = true;
    setStatus("生成完成，可试听或下载。");
  } catch (error) {
    if (controller.signal.aborted) {
      const timedOut = controller.signal.reason === "timeout";
      setStatus(timedOut ? "生成超时，请稍后重试。" : "已取消等待。", timedOut);
    } else if (error instanceof TypeError) {
      setStatus("无法连接推理服务。请检查服务地址、网络和跨域设置。", true);
    } else {
      setStatus(error.message || "生成失败，请重试。", true);
    }
  } finally {
    clearTimeout(timer);
    pending = null;
    byId("generate").disabled = false;
    byId("cancel").hidden = true;
  }
}

function stopPreview() {
  if (!speaking) return;
  speaking = null;
  window.speechSynthesis.cancel();
  preview.textContent = "朗读预览（系统音色）";
}

function playPreview() {
  if (speaking) {
    stopPreview();
    setStatus("已停止预览。");
    return;
  }
  if (pending) return;
  try {
    const content = readInput();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = /\p{Script=Han}/u.test(content) ? "zh-CN" : "en-US";
    speaking = utterance;
    preview.textContent = "停止朗读";
    setStatus("正在使用系统音色朗读。");
    const finish = (message, error = false) => {
      if (speaking !== utterance) return;
      speaking = null;
      preview.textContent = "朗读预览（系统音色）";
      setStatus(message, error);
    };
    utterance.onend = () => finish("朗读预览完成。");
    utterance.onerror = () =>
      finish("系统朗读不可用，请检查浏览器的语音设置。", true);
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    stopPreview();
    setStatus(error.message, true);
  }
}

function updateMode() {
  byId("id-fields").hidden = mode.value !== "id";
  byId("audio-fields").hidden = mode.value !== "audio";
}

function updateProvider() {
  const local = provider.value === "local";
  const shared = provider.value === "public";
  if (shared) mode.value = "default";
  mode.querySelector('[value="id"]').disabled = shared;
  mode.querySelector('[value="audio"]').disabled = shared;
  byId("format").hidden = byId("format-label").hidden = shared;
  byId("key-fields").hidden = shared;
  byId("public-hint").hidden = !shared;
  updateMode();
  byId("local-fields").hidden = byId("key-optional").hidden = !local;
  byId("key-link").hidden = local;
  byId("key").value = "";
}

function updateCount() {
  byId("count").textContent =
    text.value.length.toLocaleString("en-US") + " / 2,000";
}

text.addEventListener("input", updateCount);
mode.addEventListener("change", updateMode);
provider.addEventListener("change", updateProvider);
for (const button of document.querySelectorAll("[data-sample]")) {
  button.addEventListener("click", () => {
    text.value = samples[button.dataset.sample];
    updateCount();
    text.focus();
  });
}
byId("clear").addEventListener("click", () => {
  text.value = "";
  updateCount();
  text.focus();
});
byId("cancel").addEventListener("click", () => pending?.abort());
player.addEventListener("error", () =>
  setStatus("浏览器无法播放返回的音频，请检查推理服务的输出格式。", true),
);
preview.hidden = !(
  "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
);
preview.addEventListener("click", playPreview);
form.addEventListener("submit", handleSubmit);
updateProvider();
