"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";

interface GnomeAudioPlayerProps {
  src: string;
  className?: string;
}

export function GnomeAudioPlayer({ src, className }: GnomeAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-gnome-sm",
        "bg-gray-100 dark:bg-[#333] border border-ubuntu-border-light dark:border-ubuntu-border-dark",
        className
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
      />

      <button
        onClick={togglePlay}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
          "bg-ubuntu-orange text-white hover:bg-ubuntu-orange-dark transition-colors"
        )}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="relative h-1.5 bg-gray-300 dark:bg-[#555] rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-ubuntu-orange rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="font-ubuntu-mono text-xs text-gray-500">
            {formatDuration(currentTime)}
          </span>
          <span className="font-ubuntu-mono text-xs text-gray-500">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Volume2 className="w-4 h-4 text-gray-400" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setVolume(v);
            if (audioRef.current) audioRef.current.volume = v;
          }}
          className="w-16 accent-ubuntu-orange"
        />
      </div>
    </div>
  );
}
