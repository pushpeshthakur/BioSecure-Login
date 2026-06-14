import React, { useState } from "react";
import { Link } from "wouter";
import { useLogin } from "@/hooks/use-auth";
import { BiometricCamera } from "@/components/BiometricCamera";
import { BiometricVoice } from "@/components/BiometricVoice";
import { ScanOverlay } from "@/components/ScanOverlay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Fingerprint, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const login = useLogin();
  const [formData, setFormData] = useState({
    faceImage: "",
    voiceAudio: "",
  });

  const handleLogin = () => {
    login.mutate(formData);
  };

  const isReady = formData.faceImage && formData.voiceAudio;

  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-4">
      {login.isPending && <ScanOverlay />}
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        <Card className="border-primary/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-card/95 backdrop-blur overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
          
          <CardHeader className="text-center pb-8 border-b border-border/50">
            <div className="mx-auto w-16 h-16 bg-background rounded-full flex items-center justify-center mb-4 border-2 border-primary box-shadow-glow">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-display text-white tracking-widest text-shadow-glow">
              RESTRICTED ACCESS
            </CardTitle>
            <CardDescription className="font-mono text-primary/70 uppercase tracking-widest">
              Biometric Verification Required
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left: Face */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Fingerprint className="w-5 h-5 text-primary" />
                  <span className="font-mono text-sm uppercase text-primary">Visual Identification</span>
                </div>
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-cyan-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <BiometricCamera 
                    onCapture={(img) => setFormData(prev => ({ ...prev, faceImage: img || "" }))} 
                    isScanning={login.isPending}
                    />
                </div>
              </div>

              {/* Right: Voice */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <span className="font-mono text-sm uppercase text-primary">Vocal Authentication</span>
                </div>
                <div className="relative group h-full">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-cyan-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="h-[calc(100%-2rem)] flex flex-col justify-center">
                         <BiometricVoice 
                            onCapture={(audio) => setFormData(prev => ({ ...prev, voiceAudio: audio || "" }))}
                            isScanning={login.isPending}
                        />
                    </div>
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center space-y-4">
              <Button 
                size="lg"
                className="w-full max-w-md bg-primary text-primary-foreground font-bold text-lg h-14 tracking-wider hover:shadow-[0_0_30px_hsla(180,100%,50%,0.4)] transition-all duration-300 relative overflow-hidden group"
                onClick={handleLogin}
                disabled={!isReady || login.isPending}
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {login.isPending ? "PROCESSING..." : "VERIFY CREDENTIALS"}
                  {!login.isPending && <Lock className="w-5 h-5" />}
                </span>
                <div className="absolute inset-0 h-full w-full scale-0 rounded-md transition-all duration-300 group-hover:scale-100 group-hover:bg-white/10"></div>
              </Button>
              
              <Link href="/register" className="text-sm font-mono text-muted-foreground hover:text-primary transition-colors">
                [ NEW USER REGISTRATION ]
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
