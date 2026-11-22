import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  FlipHorizontal2,
  Grid3x3,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
} from 'lucide-react';

interface GreenRoomStageProps {
  userName?: string | null;
  compact?: boolean;
}

export function GreenRoomStage({
  userName,
  compact = false,
}: GreenRoomStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [mirrored, setMirrored] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [studioLighting, setStudioLighting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micDb, setMicDb] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [speakerTesting, setSpeakerTesting] = useState(false);
  const [backdropError, setBackdropError] = useState(false);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('');

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vids = devices.filter((d) => d.kind === 'videoinput');
      const mics = devices.filter((d) => d.kind === 'audioinput');
      const spks = devices.filter((d) => d.kind === 'audiooutput');
      setVideoDevices(vids);
      setAudioInputs(mics);
      setAudioOutputs(spks);
      if (!selectedVideoId && vids[0]?.deviceId) {
        setSelectedVideoId(vids[0].deviceId);
      }
      if (!selectedAudioId && mics[0]?.deviceId) {
        setSelectedAudioId(mics[0].deviceId);
      }
      if (!selectedSpeakerId && spks[0]?.deviceId) {
        setSelectedSpeakerId(spks[0].deviceId);
      }
    } catch {
      // Ignore enumerate failure
    }
  }, [selectedAudioId, selectedSpeakerId, selectedVideoId]);

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setMicLevel(0);
    setMicDb(null);
  }, []);

  const stopAllTracks = useCallback(() => {
    stopMeter();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopMeter]);

  const startAudioMeter = useCallback(
    (stream: MediaStream) => {
      stopMeter();
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sumSq = 0;
          for (let i = 0; i < data.length; i += 1) {
            const norm = (data[i] - 128) / 128;
            sumSq += norm * norm;
          }
          const rms = Math.sqrt(sumSq / data.length);
          const clamped = Math.min(1, rms * 3.8);
          const db = rms > 0.0001 ? Math.round(20 * Math.log10(rms)) : -60;
          setMicLevel(clamped);
          setMicDb(Math.max(-60, Math.min(0, db)));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // Web Audio unavailable
      }
    },
    [stopMeter]
  );

  const syncMediaStream = useCallback(
    async (wantCam: boolean, wantMic: boolean, vidId?: string, audId?: string) => {
      setMediaError(null);

      if (!wantCam && !wantMic) {
        stopAllTracks();
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('Camera and microphone capture is unavailable in this browser.');
        setCameraOn(false);
        setMicOn(false);
        return;
      }

      stopAllTracks();

      try {
        const constraints: MediaStreamConstraints = {
          video: wantCam
            ? vidId
              ? { deviceId: { exact: vidId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
          audio: wantMic
            ? audId
              ? { deviceId: { exact: audId }, echoCancellation: true, noiseSuppression: true }
              : { echoCancellation: true, noiseSuppression: true }
            : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current && wantCam) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        if (wantMic) {
          startAudioMeter(stream);
        }

        await refreshDevices();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to access camera or microphone permissions.';
        setMediaError(message);
        if (wantCam) setCameraOn(false);
        if (wantMic) setMicOn(false);
      }
    },
    [refreshDevices, startAudioMeter, stopAllTracks]
  );

  useEffect(() => {
    refreshDevices();
    return () => {
      stopAllTracks();
    };
  }, [refreshDevices, stopAllTracks]);

  const handleToggleCamera = async () => {
    const nextCam = !cameraOn;
    setCameraOn(nextCam);
    await syncMediaStream(nextCam, micOn, selectedVideoId, selectedAudioId);
  };

  const handleToggleMic = async () => {
    const nextMic = !micOn;
    setMicOn(nextMic);
    await syncMediaStream(cameraOn, nextMic, selectedVideoId, selectedAudioId);
  };

  const handleSelectVideo = async (deviceId: string) => {
    setSelectedVideoId(deviceId);
    if (cameraOn) {
      await syncMediaStream(true, micOn, deviceId, selectedAudioId);
    }
  };

  const handleSelectAudio = async (deviceId: string) => {
    setSelectedAudioId(deviceId);
    if (micOn) {
      await syncMediaStream(cameraOn, true, selectedVideoId, deviceId);
    }
  };

  const handleTestSpeaker = async () => {
    if (speakerTesting) return;
    setSpeakerTesting(true);
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioContextClass();

      const ctxWithSink = ctx as AudioContext & {
        setSinkId?: (id: string) => Promise<void>;
      };
      if (selectedSpeakerId && typeof ctxWithSink.setSinkId === 'function') {
        await ctxWithSink.setSinkId(selectedSpeakerId).catch(() => {});
      }

      const now = ctx.currentTime;
      const notes = [523.25, 659.25];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.16);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.16 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.16 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.16);
        osc.stop(now + idx * 0.16 + 0.38);
      });

      setTimeout(() => {
        ctx.close().catch(() => {});
        setSpeakerTesting(false);
      }, 650);
    } catch {
      setSpeakerTesting(false);
    }
  };

  const initials = (userName || 'You')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Hardware Green Room
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Check framing, microphone levels, and speakers before entering Google Meet
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMirrored((v) => !v)}
            aria-pressed={mirrored}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
              mirrored
                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
            Mirror
          </button>

          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            aria-pressed={showGrid}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
              showGrid
                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
            Framing Grid
          </button>

          <button
            type="button"
            onClick={() => setStudioLighting((v) => !v)}
            aria-pressed={studioLighting}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
              studioLighting
                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Studio Tone
          </button>
        </div>
      </div>

      <div
        className={`relative mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-slate-800 ${
          compact ? 'aspect-video' : 'aspect-video min-h-[280px]'
        }`}
      >
        {cameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover transition-transform duration-150 ${
              mirrored ? '-scale-x-100' : ''
            } ${studioLighting ? 'brightness-105 contrast-105 saturate-105' : ''}`}
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center">
            {!backdropError && (
              <img
                src="/src/assets/images/acoustic_focus_pod_1795376998095.jpg"
                alt="Acoustic focus studio pod backdrop"
                referrerPolicy="no-referrer"
                onError={() => setBackdropError(true)}
                className="absolute inset-0 h-full w-full object-cover opacity-35"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-slate-950/50" />
            <div className="relative z-10 flex flex-col items-center text-center px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-slate-800/90 text-lg font-semibold text-white">
                {initials}
              </div>
              <p className="mt-3 text-sm font-medium text-white">
                Camera is muted in Green Room
              </p>
              <p className="mt-0.5 text-xs text-slate-300">
                Turn on Camera Preview below to check framing and lighting
              </p>
            </div>
          </div>
        )}

        {showGrid && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
          >
            <div className="border-r border-b border-white/25" />
            <div className="border-r border-b border-white/25" />
            <div className="border-b border-white/25" />
            <div className="border-r border-b border-white/25" />
            <div className="border-r border-b border-white/25" />
            <div className="border-b border-white/25" />
            <div className="border-r border-white/25" />
            <div className="border-r border-white/25" />
            <div />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMic}
              className={`inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                micOn
                  ? 'bg-white text-slate-900 hover:bg-slate-100'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {micOn ? 'Mic Live' : 'Test Mic'}
            </button>

            <button
              type="button"
              onClick={handleToggleCamera}
              className={`inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                cameraOn
                  ? 'bg-white text-slate-900 hover:bg-slate-100'
                  : 'bg-slate-800/90 text-white hover:bg-slate-700'
              }`}
            >
              {cameraOn ? (
                <Camera className="h-4 w-4" />
              ) : (
                <CameraOff className="h-4 w-4" />
              )}
              {cameraOn ? 'Camera On' : 'Preview Camera'}
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-slate-900/80 px-3 py-1.5 backdrop-blur-xs">
            <span className="text-xs font-medium text-slate-200 whitespace-nowrap">
              Input Level
            </span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full w-full origin-left transition-transform duration-75 ${
                  micLevel > 0.85
                    ? 'bg-amber-400'
                    : micLevel > 0.05
                    ? 'bg-emerald-400'
                    : 'bg-slate-500'
                }`}
                style={{ transform: `scaleX(${micOn ? Math.max(0.03, micLevel) : 0.03})` }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-slate-200 w-12 text-right">
              {micOn && micDb !== null ? `${micDb} dB` : 'Muted'}
            </span>
          </div>
        </div>
      </div>

      {mediaError && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300"
        >
          {mediaError}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label
            htmlFor="greenroom-mic"
            className="block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Microphone
          </label>
          <select
            id="greenroom-mic"
            value={selectedAudioId}
            onChange={(e) => handleSelectAudio(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {audioInputs.length === 0 ? (
              <option value="">Default system microphone</option>
            ) : (
              audioInputs.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Microphone ${idx + 1}`}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="greenroom-cam"
            className="block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Camera
          </label>
          <select
            id="greenroom-cam"
            value={selectedVideoId}
            onChange={(e) => handleSelectVideo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {videoDevices.length === 0 ? (
              <option value="">Default system camera</option>
            ) : (
              videoDevices.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Camera ${idx + 1}`}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="greenroom-spk"
            className="block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Speakers
          </label>
          <div className="mt-1 flex items-center gap-2">
            <select
              id="greenroom-spk"
              value={selectedSpeakerId}
              onChange={(e) => setSelectedSpeakerId(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {audioOutputs.length === 0 ? (
                <option value="">Default audio output</option>
              ) : (
                audioOutputs.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Speaker ${idx + 1}`}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={handleTestSpeaker}
              disabled={speakerTesting}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Play speaker test chime"
            >
              <Volume2 className="h-3.5 w-3.5" />
              {speakerTesting ? 'Playing' : 'Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
