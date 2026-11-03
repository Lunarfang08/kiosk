/**
 * Browser adapter for LiveTalking's documented HTTP/WebRTC API.
 * Used when AVATAR_ENGINE=livetalking on a CUDA host — not for Mac demo.
 *
 * Endpoints (https://github.com/lipku/LiveTalking/blob/main/docs/api.md):
 * POST /offer, POST /humanaudio, POST /interrupt_talk, GET /sse
 */

export class LiveTalkingClient {
  private baseUrl: string
  private pc: RTCPeerConnection | null = null
  private sessionId: string | null = null
  private videoEl: HTMLVideoElement | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async connect(videoEl: HTMLVideoElement, avatarId?: string): Promise<string> {
    this.videoEl = videoEl
    this.pc = new RTCPeerConnection()
    this.pc.addTransceiver('video', { direction: 'recvonly' })
    this.pc.addTransceiver('audio', { direction: 'recvonly' })
    this.pc.ontrack = (ev) => {
      if (this.videoEl) {
        this.videoEl.srcObject = ev.streams[0]
        void this.videoEl.play().catch(() => undefined)
      }
    }

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    const body: Record<string, string> = {
      sdp: offer.sdp || '',
      type: 'offer',
    }
    if (avatarId) body.avatar = avatarId

    const res = await fetch(`${this.baseUrl}/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`LiveTalking /offer failed: ${res.status}`)
    const answer = (await res.json()) as { sdp: string; type: string; sessionid: string }
    this.sessionId = String(answer.sessionid)
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp })
    return this.sessionId
  }

  async speakAudio(blob: Blob): Promise<void> {
    if (!this.sessionId) throw new Error('LiveTalking session not started')
    const fd = new FormData()
    fd.append('sessionid', this.sessionId)
    fd.append('file', blob, 'speech.wav')
    const res = await fetch(`${this.baseUrl}/humanaudio`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error(`LiveTalking /humanaudio failed: ${res.status}`)
  }

  async interrupt(): Promise<void> {
    if (!this.sessionId) return
    await fetch(`${this.baseUrl}/interrupt_talk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionid: this.sessionId }),
    })
  }

  async dispose() {
    await this.interrupt()
    this.pc?.close()
    this.pc = null
    this.sessionId = null
    if (this.videoEl) this.videoEl.srcObject = null
  }
}
