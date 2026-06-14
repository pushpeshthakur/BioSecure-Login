import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, LogOut, FileText, Server, Users } from "lucide-react";
import { motion } from "framer-motion";
import type { User } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // In a real app, you'd verify the session with an API call here.
    // For this demo, we check sessionStorage populated by login.
    const storedUser = sessionStorage.getItem("user");
    if (!storedUser) {
      setLocation("/login");
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [setLocation]);

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    setLocation("/login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 hidden md:block">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg tracking-wider">SECURE<span className="text-primary">NET</span></span>
          </div>
          
          <nav className="space-y-2">
            <Button variant="ghost" className="w-full justify-start bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary">
              <Server className="w-4 h-4 mr-3" />
              Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start hover:bg-white/5">
              <FileText className="w-4 h-4 mr-3" />
              Logs
            </Button>
            <Button variant="ghost" className="w-full justify-start hover:bg-white/5">
              <Users className="w-4 h-4 mr-3" />
              Personnel
            </Button>
          </nav>
        </div>
        
        <div className="absolute bottom-6 left-6 right-6">
          <div className="p-4 bg-background/50 rounded-lg border border-border">
            <div className="text-xs font-mono text-muted-foreground mb-1">SYSTEM STATUS</div>
            <div className="flex items-center gap-2 text-sm text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              OPERATIONAL
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 grid-bg">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Mission Control</h1>
            <p className="text-muted-foreground font-mono text-sm">Welcome back, Agent {user.displayName}</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-destructive/50 text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4 mr-2" />
            Terminate Session
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-card border-l-4 border-l-primary h-full">
              <CardContent className="p-6">
                <div className="text-xs font-mono text-muted-foreground uppercase mb-2">Security Level</div>
                <div className="text-4xl font-display font-bold text-white">ALPHA</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-card border-l-4 border-l-green-500 h-full">
              <CardContent className="p-6">
                <div className="text-xs font-mono text-muted-foreground uppercase mb-2">Auth Confidence</div>
                <div className="text-4xl font-display font-bold text-green-400">99.8%</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-card border-l-4 border-l-purple-500 h-full">
              <CardContent className="p-6">
                <div className="text-xs font-mono text-muted-foreground uppercase mb-2">Last Login</div>
                <div className="text-lg font-mono text-white mt-2">{new Date().toLocaleString()}</div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }} 
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent"></div>
          
          <div className="w-32 h-32 rounded-full bg-green-500/10 flex items-center justify-center mb-6 animate-pulse">
            <ShieldCheck className="w-16 h-16 text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">ACCESS GRANTED</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Biometric verification successful. Your identity has been confirmed against the secure database. You are authorized to proceed.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-lg">
             <div className="bg-background/50 p-4 rounded border border-border">
                <div className="text-xs text-muted-foreground mb-1">Face Match</div>
                <div className="text-green-400 font-mono font-bold">CONFIRMED</div>
             </div>
             <div className="bg-background/50 p-4 rounded border border-border">
                <div className="text-xs text-muted-foreground mb-1">Voice Match</div>
                <div className="text-green-400 font-mono font-bold">CONFIRMED</div>
             </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
