/**
 * Web Audio utilities for lip-sync energy and optional WAV chunk export.
 */

export class AudioAnalyserBridge {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private timeData: Uint8Array<ArrayBuffer> | null = null
  private freqData: Uint8Array<ArrayBuffer> | null = null
  private raf = 0
  private running = false

  onLevel: ((level: number) => void) | null = null

  attach(stream: MediaStream) {
    this.dispose()
    this.ctx = new AudioContext()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    // Lower smoothing → snappier lip motion
    this.analyser.smoothingTimeConstant = 0.35
    this.source = this.ctx.createMediaStreamSource(stream)
    this.source.connect(this.analyser)
    this.timeData = new Uint8Array(this.analyser.fftSize)
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount)
    this.running = true
    const tick = () => {
      if (!this.running || !this.analyser || !this.timeData || !this.freqData) return
      this.analyser.getByteTimeDomainData(this.timeData)
      this.analyser.getByteFrequencyData(this.freqData)

      let sum = 0
      for (let i = 0; i < this.timeData.length; i += 1) {
        const v = (this.timeData[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / this.timeData.length)

      // Emphasize speech formant band (~300Hz–3kHz)
      const binHz = (this.ctx?.sampleRate || 48000) / this.analyser.fftSize
      const lo = Math.max(1, Math.floor(300 / binHz))
      const hi = Math.min(this.freqData.length - 1, Math.floor(3000 / binHz))
      let speech = 0
      for (let i = lo; i <= hi; i += 1) speech += this.freqData[i]
      speech = speech / ((hi - lo + 1) * 255)

      const level = Math.min(1, Math.max(rms * 8, speech * 1.8))
      this.onLevel?.(level)
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  async resume() {
    if (this.ctx?.state === 'suspended') await this.ctx.resume()
  }

  dispose() {
    this.running = false
    cancelAnimationFrame(this.raf)
    try {
      this.source?.disconnect()
    } catch {
      /* ignore */
    }
    void this.ctx?.close()
    this.ctx = null
    this.analyser = null
    this.source = null
    this.timeData = null
    this.freqData = null
  }
}

/** Record a MediaStream into short WAV blobs (for LiveTalking /humanaudio later). */
export async function recordWavChunk(
  stream: MediaStream,
  durationMs = 800,
): Promise<Blob> {
  const recorder = new MediaRecorder(stream, { mimeType: preferredMime() })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  recorder.start()
  await new Promise((r) => setTimeout(r, durationMs))
  recorder.stop()
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })
  return new Blob(chunks, { type: recorder.mimeType })
}

function preferredMime() {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus'
  }
  return 'audio/webm'
}
