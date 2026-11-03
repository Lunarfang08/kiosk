import { wsBase } from '@/lib/utils'

export type IceServer = RTCIceServer

export type DograhSessionInfo = {
  workflow_id: string
  workflow_run_id: number
  signaling_url: string
  ice_servers?: IceServer[]
  force_turn_relay?: boolean
  path?: string
}

export type RtfHandler = (msg: Record<string, unknown>) => void

/**
 * Thin Dograh SmallWebRTC client matching Dograh's useWebSocketRTC contract.
 * Signaling goes through our backend proxy (or a public embed URL).
 * TTS audio arrives as a remote WebRTC audio track.
 */
export class DograhWebRTCClient {
  private pc: RTCPeerConnection | null = null
  private ws: WebSocket | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private audioEl: HTMLAudioElement | null = null
  private startedAt = 0
  private firstAudioAt: number | null = null
  private pcId = crypto.randomUUID()
  private workflowId = ''
  private workflowRunId = 0

  onRemoteStream: ((stream: MediaStream) => void) | null = null
  onRtf: RtfHandler | null = null
  onConnectionState: ((state: string) => void) | null = null
  onError: ((err: Error) => void) | null = null
  onFirstAudio: ((ms: number) => void) | null = null

  async connect(info: DograhSessionInfo): Promise<void> {
    this.startedAt = performance.now()
    this.firstAudioAt = null
    this.pcId = crypto.randomUUID()
    this.workflowId = String(info.workflow_id)
    this.workflowRunId = Number(info.workflow_run_id)

    const iceServers = info.ice_servers?.length
      ? info.ice_servers
      : [{ urls: ['stun:stun.l.google.com:19302'] }]

    this.pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: info.force_turn_relay ? 'relay' : 'all',
    })

    this.pc.onconnectionstatechange = () => {
      this.onConnectionState?.(this.pc?.connectionState || 'closed')
    }

    this.pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track])
      this.remoteStream = stream
      this.onRemoteStream?.(stream)
      if (!this.audioEl) {
        this.audioEl = new Audio()
        this.audioEl.autoplay = true
      }
      this.audioEl.srcObject = stream
      void this.audioEl.play().catch(() => undefined)
      if (this.firstAudioAt == null && event.track.kind === 'audio') {
        this.firstAudioAt = performance.now() - this.startedAt
        this.onFirstAudio?.(Math.round(this.firstAudioAt))
      }
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })
    for (const track of this.localStream.getAudioTracks()) {
      this.pc.addTrack(track, this.localStream)
    }

    const signalingUrl = this.resolveWsUrl(info.signaling_url)
    await this.openSignaling(signalingUrl)

    this.pc.onicecandidate = (ev) => {
      this.send({
        type: 'ice-candidate',
        payload: {
          candidate: ev.candidate
            ? {
                candidate: ev.candidate.candidate,
                sdpMid: ev.candidate.sdpMid,
                sdpMLineIndex: ev.candidate.sdpMLineIndex,
              }
            : null,
          pc_id: this.pcId,
        },
      })
    }

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    const local = this.pc.localDescription
    if (!local?.sdp) throw new Error('Failed to create local SDP offer')

    this.send({
      type: 'offer',
      payload: {
        sdp: local.sdp,
        type: 'offer',
        pc_id: this.pcId,
        workflow_id: this.workflowId,
        workflow_run_id: this.workflowRunId,
        call_context_vars: { source: 'kiosk' },
      },
    })
  }

  private resolveWsUrl(url: string): string {
    if (url.startsWith('ws://') || url.startsWith('wss://')) return url
    if (url.startsWith('/')) return `${wsBase()}${url}`
    return url
  }

  private openSignaling(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      this.ws = ws
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('Signaling WebSocket failed'))
      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as Record<string, unknown>
          await this.handleSignalingMessage(msg)
        } catch (err) {
          this.onError?.(err instanceof Error ? err : new Error(String(err)))
        }
      }
      ws.onclose = () => {
        this.onConnectionState?.('disconnected')
      }
    })
  }

  private async handleSignalingMessage(msg: Record<string, unknown>) {
    const type = String(msg.type || '')

    if (type === 'answer' && this.pc) {
      const payload = (msg.payload || {}) as { sdp?: string }
      if (payload.sdp) {
        await this.pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp })
        this.onConnectionState?.('connected')
      }
      return
    }

    if (type === 'ice-candidate' && this.pc) {
      const payload = (msg.payload || {}) as {
        candidate?: {
          candidate?: string
          sdpMid?: string | null
          sdpMLineIndex?: number | null
        } | null
      }
      if (payload.candidate?.candidate) {
        try {
          await this.pc.addIceCandidate({
            candidate: payload.candidate.candidate,
            sdpMid: payload.candidate.sdpMid ?? undefined,
            sdpMLineIndex: payload.candidate.sdpMLineIndex ?? undefined,
          })
        } catch {
          /* trickle race is common */
        }
      }
      return
    }

    if (type === 'error') {
      const payload = (msg.payload || {}) as { message?: string }
      this.onError?.(new Error(payload.message || 'Dograh signaling error'))
      return
    }

    if (type === 'call-ended') {
      this.onConnectionState?.('disconnected')
      return
    }

    if (type.startsWith('rtf-')) {
      this.onRtf?.(msg)
    }
  }

  private send(obj: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  getRemoteStream() {
    return this.remoteStream
  }

  async disconnect() {
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    this.ws = null
    this.pc?.getSenders().forEach((s) => s.track?.stop())
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.pc?.close()
    this.pc = null
    this.localStream = null
    if (this.audioEl) {
      this.audioEl.srcObject = null
      this.audioEl = null
    }
    this.remoteStream = null
  }
}
