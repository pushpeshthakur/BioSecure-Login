import React, { useState } from "react";
import { Link } from "wouter";
import { useRegister } from "@/hooks/use-auth";
import { BiometricCamera } from "@/components/BiometricCamera";
import { BiometricVoice } from "@/components/BiometricVoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, ChevronRight, UserPlus, Check } from "lucide-react";
import { motion } from "framer-motion";

export default function Register() {
  const register = useRegister();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({
    displayName: "",
    faceImage: "",
    voiceAudio: "",
  });

  const handleNext = () => {
    if (step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
  };

  const handleSubmit = () => {
    register.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-border/50 shadow-2xl bg-card/95 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4 box-shadow-glow">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-display text-primary tracking-wider">
              NEW AGENT REGISTRATION
            </CardTitle>
            <CardDescription className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Protocol v2.4 • Secure Enrollment
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 pt-6">
            {/* Progress Steps */}
            <div className="flex justify-between items-center mb-8 px-8">
              <div className={`flex flex-col items-center ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-2 ${step >= 1 ? 'border-primary bg-primary/20' : 'border-border'}`}>1</div>
                <span className="text-[10px] font-mono uppercase">Identity</span>
              </div>
              <div className="flex-1 h-0.5 mx-4 bg-border relative">
                <div className="absolute top-0 left-0 h-full bg-primary transition-all duration-300" style={{ width: step >= 2 ? '100%' : '0%' }}></div>
              </div>
              <div className={`flex flex-col items-center ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-2 ${step >= 2 ? 'border-primary bg-primary/20' : 'border-border'}`}>2</div>
                <span className="text-[10px] font-mono uppercase">Face Scan</span>
              </div>
              <div className="flex-1 h-0.5 mx-4 bg-border relative">
                <div className="absolute top-0 left-0 h-full bg-primary transition-all duration-300" style={{ width: step >= 3 ? '100%' : '0%' }}></div>
              </div>
              <div className={`flex flex-col items-center ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-2 ${step >= 3 ? 'border-primary bg-primary/20' : 'border-border'}`}>3</div>
                <span className="text-[10px] font-mono uppercase">Voiceprint</span>
              </div>
            </div>

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="font-mono text-xs uppercase text-primary">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="ENTER AGENT CODENAME"
                    className="font-mono bg-background/50 border-primary/30 focus:border-primary h-12"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  />
                </div>
                <Button 
                  className="w-full mt-4 bg-primary text-primary-foreground font-bold hover:shadow-[0_0_20px_hsla(180,100%,50%,0.3)] transition-all"
                  onClick={handleNext}
                  disabled={formData.displayName.length < 2}
                >
                  Continue <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* Step 2: Face Capture */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <Label className="font-mono text-xs uppercase text-primary">Face Biometrics</Label>
                <BiometricCamera 
                  onCapture={(img) => setFormData({ ...formData, faceImage: img || "" })} 
                />
                <Button 
                  className="w-full mt-4 bg-primary text-primary-foreground font-bold"
                  onClick={handleNext}
                  disabled={!formData.faceImage}
                >
                  Confirm Scan <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* Step 3: Voice Capture */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <Label className="font-mono text-xs uppercase text-primary">Voice Biometrics</Label>
                <BiometricVoice 
                  onCapture={(audio) => setFormData({ ...formData, voiceAudio: audio || "" })}
                />
                <Button 
                  className="w-full mt-4 bg-primary text-primary-foreground font-bold hover:shadow-[0_0_20px_hsla(180,100%,50%,0.3)] transition-all"
                  onClick={handleSubmit}
                  disabled={!formData.voiceAudio || register.isPending}
                >
                  {register.isPending ? "Encrypting..." : "Complete Registration"}
                  {!register.isPending && <Check className="w-4 h-4 ml-2" />}
                </Button>
              </motion.div>
            )}

            <div className="pt-6 border-t border-border mt-4 text-center">
              <Link href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Already have credentials? <span className="underline decoration-primary underline-offset-4">Access Terminal</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
