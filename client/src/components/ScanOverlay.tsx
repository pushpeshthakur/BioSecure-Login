import { motion } from "framer-motion";

export function ScanOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-80 h-80">
        <div className="absolute inset-0 border-4 border-primary/30 rounded-full animate-pulse"></div>
        <div className="absolute inset-4 border-4 border-primary/50 rounded-full border-t-transparent animate-spin duration-1000"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
            className="text-primary font-mono text-xl font-bold text-shadow-glow"
          >
            VERIFYING
          </motion.div>
        </div>
        
        {/* Scanning grid */}
        <motion.div 
            className="absolute inset-0 bg-gradient-to-b from-primary/0 via-primary/20 to-primary/0"
            initial={{ top: "-100%" }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </div>
  );
}
