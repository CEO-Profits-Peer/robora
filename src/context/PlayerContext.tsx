import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type Track = { id: string; title: string; tag: string; url: string };

type PlayerState = {
  current: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  loop: boolean;
  toggleLoop: () => void;
  upNext: Track[];
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  play: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  seek: (t: number) => void;
  next: () => void;
  prev: () => void;
};

const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [upNext, setUpNext] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loop, setLoop] = useState(false);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const upNextRef = useRef(upNext);
  upNextRef.current = upNext;

  useEffect(() => {
    const audio = new Audio();
    // Keep playing with the screen locked / app backgrounded, like a music app.
    audio.preload = "auto";
    audioRef.current = audio;

    const onTime = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (loopRef.current) {
        audio.currentTime = 0;
        audio.play();
        return;
      }
      const [nextTrack, ...rest] = upNextRef.current;
      if (nextTrack) {
        setUpNext(rest);
        playTrack(nextTrack);
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLoop = () => setLoop((v) => !v);

  function addToQueue(track: Track) {
    setUpNext((prev) => [...prev, track]);
  }

  function removeFromQueue(index: number) {
    setUpNext((prev) => prev.filter((_, i) => i !== index));
  }

  function playTrack(track: Track) {
    const audio = audioRef.current!;
    audio.src = track.url;
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    setCurrent(track);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.tag,
        album: "ROBORA",
      });
    }
  }

  function play(track: Track, newQueue?: Track[]) {
    if (newQueue) setQueue(newQueue);
    playTrack(track);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function seek(t: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = t;
    setProgress(t);
  }

  function step(dir: 1 | -1) {
    if (dir === 1 && upNext.length > 0) {
      const [nextTrack, ...rest] = upNext;
      setUpNext(rest);
      playTrack(nextTrack);
      return;
    }
    if (!current || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === current.id);
    const nextIdx = (idx + dir + queue.length) % queue.length;
    playTrack(queue[nextIdx]);
  }
  const next = () => step(1);
  const prev = () => step(-1);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => toggle());
    navigator.mediaSession.setActionHandler("pause", () => toggle());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null) seek(details.seekTime);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, queue, upNext]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  return (
    <PlayerContext.Provider
      value={{
        current,
        isPlaying,
        progress,
        duration,
        loop,
        toggleLoop,
        upNext,
        addToQueue,
        removeFromQueue,
        play,
        toggle,
        seek,
        next,
        prev,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
