import { useMutation } from "@tanstack/react-query";
import { api, type RegisterRequest, type LoginRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function useRegister() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      // Validate with Zod before sending
      const validated = api.auth.register.input.parse(data);
      
      const res = await fetch(`${API_URL}${api.auth.register.path}`, {
        method: api.auth.register.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Registration failed");
      }

      return api.auth.register.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      toast({
        title: "Registration Successful",
        description: "Your biometric data has been secured.",
        variant: "default",
      });
      setLocation("/login");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useLogin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const validated = api.auth.login.input.parse(data);
      
      const res = await fetch(`${API_URL}${api.auth.login.path}`, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Authentication failed");
      }

      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Access Granted",
          description: `Welcome back, ${data.user?.displayName || 'User'}.`,
          variant: "default",
          className: "border-primary text-primary-foreground bg-primary",
        });
        // Store user in session storage for simple demo persistence
        sessionStorage.setItem("user", JSON.stringify(data.user));
        setLocation("/dashboard");
      } else {
         toast({
          title: "Access Denied",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Authentication Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
