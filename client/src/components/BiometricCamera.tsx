import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCcw, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface BiometricCameraProps {
  onCapture: (imageSrc: string | null) => void;
  isScanning?: boolean;
}

export function BiometricCamera({ onCapture, isScanning }: BiometricCameraProps) {
  const webcamRef = useRef<Webcam>(null);
  const [image, setImage] = useState<string | null>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImage(imageSrc);
      onCapture(imageSrc);
    }
  }, [webcamRef, onCapture]);

  const retake = () => {
    setImage(null);
    onCapture(null);
  };

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border-2 border-border group">
      {image ? (
        <div className="relative w-full h-full">
          <img src={image} alt="Captured face" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-16 h-16 text-primary drop-shadow-lg" />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={retake}
            className="absolute bottom-4 right-4 bg-background/80 hover:bg-background border-primary/50 text-primary"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Retake
          </Button>
        </div>
      ) : (
        <div className="relative w-full h-full">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="w-full h-full object-cover"
            videoConstraints={{ facingMode: "user" }}
          />
          
          {/* Facial targeting overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-primary/30 rounded-[3rem] opacity-50"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 bg-primary/50 h-0.5"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 bg-primary/50 w-0.5"></div>
            
            {/* Corner brackets */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary"></div>
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary"></div>
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary"></div>
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary"></div>
          </div>

          {/* Scanning animation */}
          {isScanning && (
            <motion.div
              className="absolute inset-0 bg-primary/5 scan-line h-1"
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            />
          )}

          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <Button
              onClick={capture}
              disabled={isScanning}
              className="rounded-full w-12 h-12 p-0 bg-primary/20 border-2 border-primary hover:bg-primary/40 hover:scale-105 transition-all duration-200"
            >
              <Camera className="w-6 h-6 text-primary" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
