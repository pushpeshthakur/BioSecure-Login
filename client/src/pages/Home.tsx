import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[100px]"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center z-10 max-w-3xl"
      >
        <div className="inline-flex items-center justify-center p-3 mb-8 bg-card/50 backdrop-blur border border-primary/30 rounded-full box-shadow-glow">
          <ShieldCheck className="w-8 h-8 text-primary mr-3" />
          <span className="font-mono text-sm tracking-[0.2em] text-primary font-bold">SECURE AUTH PROTOCOL</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 tracking-tight">
          Biometric <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-600">Security</span>
        </h1>
        
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
          Next-generation identity verification using advanced neural networks for facial recognition and voice print analysis.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Link href="/login">
            <Button size="lg" className="w-48 h-14 text-lg bg-primary text-primary-foreground font-bold hover:shadow-[0_0_30px_hsla(180,100%,50%,0.4)] transition-all">
              Login System
            </Button>
          </Link>
          
          <Link href="/register">
            <Button size="lg" variant="outline" className="w-48 h-14 text-lg border-primary/50 text-primary hover:bg-primary/10">
              Register New Agent
            </Button>
          </Link>
        </div>
      </motion.div>

      <div className="absolute bottom-8 left-0 right-0 text-center">
         <p className="text-xs font-mono text-muted-foreground/50">SYSTEM VERSION 2.4.0 • SECURE CONNECTION ESTABLISHED</p>
      </div>
    </div>
  );
}
