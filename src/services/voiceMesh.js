import { getWebRtcInbox, postWebRtcSignal } from "./roomApi.js";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export function pairConnId(a, b) {
  return [String(a), String(b)].sort().join(":");
}

/**
 * شبكة صوتية بسيطة (كل لاعب يتصل بالآخرين عبر WebRTC).
 * الإشارات عبر WebSocket إن وُجدت، وإلا polling على REST.
 */
export class VoiceMeshController {
  /**
   * @param {object} opts
   * @param {string} opts.roomCode
   * @param {string} opts.selfId
   * @param {string} opts.authToken — hostToken أو playerToken
   * @param {MediaStream|null} opts.localStream
   * @param {() => Promise<string[]>} opts.fetchPeerIds
   * @param {(remoteId: string, stream: MediaStream) => void} opts.onRemoteStream
   * @param {(remoteId: string) => void} opts.onRemoteStreamGone
   * @param {null|{ subscribe: (fn: (from: string, msg: object) => void) => () => void, send: (to: string, msg: object) => void }} [opts.signalTransport]
   */
  constructor({ roomCode, selfId, authToken, localStream, fetchPeerIds, onRemoteStream, onRemoteStreamGone, signalTransport = null }) {
    this.roomCode = roomCode;
    this.selfId = selfId;
    this.authToken = authToken;
    this.localStream = localStream;
    this.fetchPeerIds = fetchPeerIds;
    this.onRemoteStream = onRemoteStream;
    this.onRemoteStreamGone = onRemoteStreamGone;
    this.signalTransport = signalTransport;
    /** @type {Map<string, RTCPeerConnection>} */
    this._pcs = new Map();
    /** @type {Map<string, RTCIceCandidateInit[]>} */
    this._iceQueues = new Map();
    this._stopped = false;
    this._pollId = null;
    this._peerPollId = null;
    this._busy = Promise.resolve();
    this._unsubSignal = null;
  }

  start() {
    this._stopped = false;
    void this._runInQueue(() => this._tickInbox());
    void this._runInQueue(() => this._syncPeers());
    if (this.signalTransport) {
      this._unsubSignal = this.signalTransport.subscribe((from, msg) => {
        void this._runInQueue(() => this._handleSignal(from, msg));
      });
      this._pollId = setInterval(() => void this._runInQueue(() => this._tickInbox()), 5200);
    } else {
      this._pollId = setInterval(() => void this._runInQueue(() => this._tickInbox()), 650);
    }
    this._peerPollId = setInterval(() => void this._runInQueue(() => this._syncPeers()), 2200);
  }

  stop() {
    this._stopped = true;
    if (this._unsubSignal) {
      try {
        this._unsubSignal();
      } catch {
        /* ignore */
      }
      this._unsubSignal = null;
    }
    if (this._pollId) clearInterval(this._pollId);
    if (this._peerPollId) clearInterval(this._peerPollId);
    this._pollId = null;
    this._peerPollId = null;
    for (const pc of this._pcs.values()) {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    }
    this._pcs.clear();
    this._iceQueues.clear();
  }

  updateLocalStream(stream) {
    this.localStream = stream;
  }

  _runInQueue(fn) {
    this._busy = this._busy
      .then(async () => {
        if (this._stopped) return;
        try {
          await fn();
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return this._busy;
  }

  _qIce(remoteId) {
    if (!this._iceQueues.has(remoteId)) this._iceQueues.set(remoteId, []);
    return this._iceQueues.get(remoteId);
  }

  async _flushIce(remoteId, pc) {
    const q = this._iceQueues.get(remoteId);
    if (!q?.length || !pc) return;
    const copy = q.splice(0, q.length);
    for (const c of copy) {
      try {
        await pc.addIceCandidate(c ? new RTCIceCandidate(c) : null);
      } catch {
        /* ignore */
      }
    }
  }

  _postSignal(to, msg) {
    if (this.signalTransport) {
      try {
        this.signalTransport.send(to, msg);
      } catch {
        /* ignore */
      }
    } else {
      void postWebRtcSignal(this.roomCode, this.authToken, { to, msg }).catch(() => {});
    }
  }

  _makePc(remoteId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (this._stopped || !e.candidate) return;
      this._postSignal(remoteId, {
        type: "ice",
        candidate: e.candidate.toJSON(),
        connId: pairConnId(this.selfId, remoteId),
      });
    };
    pc.ontrack = (ev) => {
      if (ev.streams?.[0]) this.onRemoteStream(remoteId, ev.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "failed" || st === "closed" || st === "disconnected") {
        this.onRemoteStreamGone(remoteId);
      }
    };
    return pc;
  }

  _attachLocal(pc) {
    if (!this.localStream) return;
    for (const track of this.localStream.getAudioTracks()) {
      try {
        const exists = pc.getSenders().some((s) => s.track?.id === track.id);
        if (!exists) pc.addTrack(track, this.localStream);
      } catch {
        /* ignore */
      }
    }
  }

  _teardownPeer(remoteId) {
    const pc = this._pcs.get(remoteId);
    if (pc) {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
      this._pcs.delete(remoteId);
    }
    this._iceQueues.delete(remoteId);
    this.onRemoteStreamGone(remoteId);
  }

  async _syncPeers() {
    if (this._stopped) return;
    const peers = await this.fetchPeerIds();
    const set = new Set(peers);
    for (const pid of [...this._pcs.keys()]) {
      if (!set.has(pid)) this._teardownPeer(pid);
    }
    for (const pid of peers) {
      if (pid === this.selfId) continue;
      if (this.localStream && !this._pcs.has(pid)) await this._createOfferTo(pid);
    }
  }

  async _tickInbox() {
    if (this._stopped) return;
    const data = await getWebRtcInbox(this.roomCode, this.authToken);
    const messages = Array.isArray(data.messages) ? data.messages : [];
    for (const row of messages) {
      if (row?.from && row.msg) await this._handleSignal(String(row.from), row.msg);
    }
  }

  async _handleSignal(from, msg) {
    if (from === this.selfId || !msg || typeof msg !== "object") return;
    const t = msg.type;
    if (t === "offer" && typeof msg.sdp === "string") await this._onOffer(from, msg.sdp);
    else if (t === "answer" && typeof msg.sdp === "string") await this._onAnswer(from, msg.sdp);
    else if (t === "ice") await this._onIce(from, msg.candidate ?? null);
  }

  async _createOfferTo(remoteId) {
    if (this._stopped || !this.localStream || this._pcs.has(remoteId)) return;
    const pc = this._makePc(remoteId);
    this._pcs.set(remoteId, pc);
    this._attachLocal(pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this._postSignal(remoteId, {
      type: "offer",
      sdp: offer.sdp,
      connId: pairConnId(this.selfId, remoteId),
    });
    await this._flushIce(remoteId, pc);
  }

  async _onOffer(from, sdp) {
    let pc = this._pcs.get(from);
    if (pc && pc.signalingState === "have-local-offer" && String(this.selfId) > String(from)) {
      this._teardownPeer(from);
      pc = null;
    } else if (pc && pc.signalingState === "have-local-offer") {
      return;
    }
    if (!pc) {
      pc = this._makePc(from);
      this._pcs.set(from, pc);
    }
    const remote = new RTCSessionDescription({ type: "offer", sdp });
    await pc.setRemoteDescription(remote);
    this._attachLocal(pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this._postSignal(from, {
      type: "answer",
      sdp: answer.sdp,
      connId: pairConnId(this.selfId, from),
    });
    await this._flushIce(from, pc);
  }

  async _onAnswer(from, sdp) {
    const pc = this._pcs.get(from);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
    await this._flushIce(from, pc);
  }

  async _onIce(from, candidateInit) {
    const pc = this._pcs.get(from);
    if (!pc || !pc.remoteDescription) {
      this._qIce(from).push(candidateInit);
      return;
    }
    try {
      await pc.addIceCandidate(candidateInit ? new RTCIceCandidate(candidateInit) : null);
    } catch {
      /* ignore */
    }
  }
}
