import React, { useState, useEffect } from "react";
import { useReactMediaRecorder } from "react-media-recorder";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, RefreshCcw, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BiometricVoiceProps {
  onCapture: (audioBase64: string | null) => void;
  isScanning?: boolean;
}

export function BiometricVoice({ onCapture, isScanning }: BiometricVoiceProps) {
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  
  const { status, startRecording, stopRecording, mediaBlobUrl, clearBlobUrl } =
    useReactMediaRecorder({ 
        audio: true,
        blobPropertyBag: { type: "audio/webm" }
    });

  // Convert blob to base64 when recording stops
  useEffect(() => {
    if (status === "stopped" && mediaBlobUrl) {
      fetch(mediaBlobUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            const base64String = reader.result as string;
            // The API expects just the base64 data, sometimes with or without prefix. 
            // Usually FileReader includes "data:audio/wav;base64,...".
            // We'll pass the whole string and let backend handle or strip it if needed.
            // But typical usage often wants just the base64 part. Let's keep the prefix for now as it describes the file.
            setAudioBase64(base64String);
            onCapture(base64String);
          };
        });
    }
  }, [status, mediaBlobUrl, onCapture]);

  const handleRetake = () => {
    clearBlobUrl();
    setAudioBase64(null);
    onCapture(null);
  };

  return (
    <div className="w-full bg-card rounded-xl border border-border p-6 relative overflow-hidden">
      {/* Visualizer background fake */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none gap-1">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 bg-primary transition-all duration-100",
              status === "recording" ? "animate-pulse" : "h-2"
            )}
            style={{ 
                height: status === "recording" ? `${Math.random() * 80 + 20}%` : '4px',
                animationDelay: `${i * 0.05}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center gap-6">
        <div className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
            status === "recording" 
                ? "bg-destructive/20 border-2 border-destructive shadow-[0_0_30px_rgba(239,68,68,0.3)]" 
                : audioBase64 
                    ? "bg-primary/20 border-2 border-primary shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                    : "bg-muted border-2 border-border"
        )}>
          {status === "recording" ? (
            <Mic className="w-10 h-10 text-destructive animate-pulse" />
          ) : audioBase64 ? (
            <Volume2 className="w-10 h-10 text-primary" />
          ) : (
            <Mic className="w-10 h-10 text-muted-foreground" />
          )}
        </div>

        <div className="flex items-center gap-4">
          {status !== "recording" && !audioBase64 && (
            <Button
              onClick={startRecording}
              disabled={isScanning}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Mic className="w-4 h-4 mr-2" />
              Start Recording
            </Button>
          )}

          {status === "recording" && (
            <Button
              onClick={stopRecording}
              variant="destructive"
              className="animate-pulse"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Recording
            </Button>
          )}

          {audioBase64 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const audio = new Audio(mediaBlobUrl!);
                  audio.play();
                }}
              >
                <Play className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button variant="ghost" onClick={handleRetake}>
                <RefreshCcw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            {status === "recording" ? "Recording Input..." : audioBase64 ? "Voice Sample Secured" : "Awaiting Input"}
        </p>
      </div>
    </div>
  );
}
