import { useCallback, useEffect, useRef, useState } from "react";
import { getRoom } from "../services/roomApi.js";
import { VoiceMeshController } from "../services/voiceMesh.js";

/**
 * صوت WebRTC بين لاعبي الغرفة؛ إشارات فورية عند توفر WebSocket.
 */
export function useVoiceMesh({
  roomCode,
  selfId,
  authToken,
  enabled,
  localStream,
  signalTransport = null,
  fetchPeerIds: fetchPeerIdsOverride = null,
}) {
  const [remoteStreams, setRemoteStreams] = useState(() => new Map());
  const ctrlRef = useRef(null);

  const fetchPeerIdsDefault = useCallback(async () => {
    const data = await getRoom(roomCode);
    return (data.players || []).map((p) => p.id);
  }, [roomCode]);
  const fetchPeerIds = fetchPeerIdsOverride ?? fetchPeerIdsDefault;

  useEffect(() => {
    if (!enabled || !roomCode || !selfId || !authToken || !localStream) {
      ctrlRef.current?.stop();
      ctrlRef.current = null;
      const t = requestAnimationFrame(() => setRemoteStreams(new Map()));
      return () => cancelAnimationFrame(t);
    }

    const ctrl = new VoiceMeshController({
      roomCode,
      selfId,
      authToken: authToken,
      localStream,
      signalTransport,
      fetchPeerIds,
      onRemoteStream: (remoteId, stream) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteId, stream);
          return next;
        });
      },
      onRemoteStreamGone: (remoteId) => {
        setRemoteStreams((prev) => {
          if (!prev.has(remoteId)) return prev;
          const next = new Map(prev);
          next.delete(remoteId);
          return next;
        });
      },
    });
    ctrlRef.current = ctrl;
    ctrl.start();

    return () => {
      ctrl.stop();
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
      requestAnimationFrame(() => setRemoteStreams(new Map()));
    };
  }, [enabled, roomCode, selfId, authToken, localStream, fetchPeerIds, signalTransport]);

  return { remoteStreams };
}
