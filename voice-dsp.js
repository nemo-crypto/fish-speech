// Time stretch by overlapping short frames and aligning their shared waveform.
export function stretchSpeech(samples, length, sampleRate) {
  if (samples.length === length) return samples;
  const frame = Math.min(Math.round(sampleRate * 0.04), samples.length, length);
  const overlap = Math.max(1, Math.floor(frame / 2));
  const hop = Math.max(1, frame - overlap);
  const radius = Math.round(sampleRate * 0.012);
  const output = new Float32Array(length);
  output.set(samples.subarray(0, frame));

  for (let pos = hop; pos < length; pos += hop) {
    const last = samples.length - frame;
    const expected = Math.min(
      last,
      Math.round((pos * samples.length) / length),
    );
    const shared = Math.min(overlap, length - pos);
    let best = expected;
    let bestScore = -Infinity;
    for (
      let start = Math.max(0, expected - radius);
      start <= Math.min(last, expected + radius);
      start += 4
    ) {
      let correlation = 0;
      let power = 0;
      for (let i = 0; i < shared; i += 4) {
        correlation += output[pos + i] * samples[start + i];
        power += samples[start + i] ** 2;
      }
      if (power < 1e-8) continue;
      const score = correlation / Math.sqrt(power);
      if (score > bestScore) {
        bestScore = score;
        best = start;
      }
    }
    for (let i = 0; i < Math.min(frame, length - pos); i++) {
      const mix = i < shared ? (i + 1) / shared : 1;
      output[pos + i] = output[pos + i] * (1 - mix) + samples[best + i] * mix;
    }
  }
  return output;
}

export function encodeWav(samples, sampleRate) {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const writeText = (offset, value) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  writeText(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      44 + i * 2,
      Math.round(value * (value < 0 ? 32768 : 32767)),
      true,
    );
  }
  return new Blob([bytes], { type: "audio/wav" });
}
