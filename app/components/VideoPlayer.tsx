'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';

interface VideoPlayerProps {
  fileId: number;
  userId: string;
  filename: string;
  onClose: () => void;
}

export default function VideoPlayer({ fileId, userId, filename, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const streamUrl = `/api/files/stream?fileId=${fileId}&userId=${userId}`;

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, [isFullscreen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Update buffered progress
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered((bufferedEnd / video.duration) * 100);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          if (videoRef.current) videoRef.current.volume = Math.min(1, volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          if (videoRef.current) videoRef.current.volume = Math.max(0, volume - 0.1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentTime, volume, togglePlayPause, toggleFullscreen, toggleMute, seek]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    seek(pos * duration);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume > 0 && isMuted) {
        videoRef.current.muted = false;
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className={`absolute top-4 right-4 z-50 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-all ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <XMarkIcon className="w-6 h-6 text-white" />
      </button>

      {/* Video element */}
      <video
        ref={videoRef}
        src={streamUrl}
        className="w-full h-full object-contain"
        onClick={togglePlayPause}
        preload="auto"
        playsInline
        crossOrigin="anonymous"
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
      )}

      {/* Play/Pause overlay */}
      {!isPlaying && !isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="p-6 bg-black/50 rounded-full">
            <PlayIcon className="w-20 h-20 text-white" />
          </div>
        </div>
      )}

      {/* Controls */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress bar */}
        <div className="mb-4">
          <div 
            className="h-1.5 bg-white/30 rounded-full cursor-pointer group relative"
            onClick={handleProgressClick}
          >
            {/* Buffered progress */}
            <div 
              className="absolute h-full bg-white/50 rounded-full transition-all"
              style={{ width: `${buffered}%` }}
            />
            {/* Current progress */}
            <div 
              className="absolute h-full bg-red-600 rounded-full transition-all"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            {/* Hover indicator */}
            <div className="absolute -top-1 h-3.5 w-3.5 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${(currentTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
            />
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="p-2 hover:bg-white/20 rounded-full transition-all"
            >
              {isPlaying ? (
                <PauseIcon className="w-8 h-8 text-white" />
              ) : (
                <PlayIcon className="w-8 h-8 text-white" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group">
              <button
                onClick={toggleMute}
                className="p-2 hover:bg-white/20 rounded-full transition-all"
              >
                {isMuted || volume === 0 ? (
                  <SpeakerXMarkIcon className="w-6 h-6 text-white" />
                ) : (
                  <SpeakerWaveIcon className="w-6 h-6 text-white" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover:w-20 transition-all duration-300 accent-white"
              />
            </div>

            {/* Time */}
            <div className="text-white text-sm font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filename */}
            <div className="text-white text-sm font-medium max-w-md truncate mr-4">
              {filename}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/20 rounded-full transition-all"
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="w-6 h-6 text-white" />
              ) : (
                <ArrowsPointingOutIcon className="w-6 h-6 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div 
        className={`absolute top-4 left-4 bg-black/70 rounded-lg p-3 text-white text-xs transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="font-semibold mb-1">Keyboard Shortcuts:</div>
        <div className="space-y-0.5 text-white/80">
          <div>Space/K - Play/Pause</div>
          <div>F - Fullscreen</div>
          <div>M - Mute</div>
          <div>← → - Seek ±5s</div>
          <div>↑ ↓ - Volume</div>
        </div>
      </div>
    </div>
  );
}
