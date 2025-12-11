import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bird, ChevronLeft, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { sendTransactionalEmail } from "@/lib/sendTransactionalEmail";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Session check error:", sessionError);
          return;
        }
        if (session?.user) {
          navigate("/dashboard");
        }
      } catch (err) {
        console.error("Error checking session:", err);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);
        if (session?.user) {
          navigate("/dashboard");
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    // Validation
    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    if (!isLogin && !username) {
      setError("Please provide a username");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        console.log("Attempting sign in with:", email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          console.error("Sign in error:", error);
          throw new Error(error.message);
        }
        console.log("Sign in successful:", data.user?.email);
        toast({ title: "Welcome back!", description: "Taking you to the landing page..." });
      } else {
        console.log("Attempting sign up with:", email);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) {
          console.error("Sign up error:", error);
          throw new Error(error.message);
        }
        console.log("Sign up successful:", data.user?.email);
        
        // Store username in Supabase users table
        if (data.user?.email && username) {
          try {
            // Use upsert to handle duplicate email gracefully
            const { error: insertError } = await supabase
              .from('users')
              .upsert(
                {
                  email: data.user.email,
                  username: username,
                },
                { onConflict: 'email' }
              );
            
            if (insertError) {
              console.error("Error storing user profile:", insertError);
            } else {
              console.log("User profile stored with username:", username);
            }
          } catch (profileError) {
            console.error("Failed to store user profile:", profileError);
          }
        }
        
        // Send welcome email with username
        if (data.user?.email) {
          try {
            await sendTransactionalEmail({
              to: data.user.email,
              templateId: 'welcome_verify',
              data: { first_name: username || email.split('@')[0] },
            });
            console.log("Welcome email sent to:", data.user.email);
          } catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
            // Don't throw - signup was successful, email sending is bonus
          }
        }
        
        // Check if email confirmation is required
        if (data.user && !data.session) {
          setSuccessMessage("Check your email to verify your account, then you can sign in.");
          setEmail("");
          setPassword("");
        } else {
          // Auto-sign in if no email verification needed
          setSuccessMessage("Account created! Signing you in...");
          setEmail("");
          setPassword("");
          setTimeout(() => setIsLogin(true), 1000);
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      const errorMessage = error?.message || "An unexpected error occurred";
      setError(errorMessage);
      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-3 xs:p-4">
      <div className="absolute top-3 xs:top-4 left-3 xs:left-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="text-muted-foreground hover:text-foreground h-8 w-8 xs:h-10 xs:w-10"
        >
          <ChevronLeft className="h-4 w-4 xs:h-5 xs:w-5" />
        </Button>
      </div>
      <div className="absolute top-3 xs:top-4 right-3 xs:right-4">
        <button
          onClick={toggleTheme}
          className="p-1.5 xs:p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 xs:h-5 xs:w-5 text-foreground" />
          ) : (
            <Moon className="h-4 w-4 xs:h-5 xs:w-5 text-foreground" />
          )}
        </button>
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-6 xs:mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 mb-3 xs:mb-4 mx-auto hover:opacity-80 transition-opacity"
          >
            <Bird className="h-6 xs:h-8 w-6 xs:w-8 text-foreground" />
            <span className="text-lg xs:text-2xl font-bold text-foreground">YieldCanary</span>
          </button>
          <h1 className="text-xl xs:text-2xl font-semibold text-foreground">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-xs xs:text-sm text-muted-foreground mt-1 xs:mt-2">
            {isLogin
              ? "Sign in to access your dashboard"
              : "Start tracking your high-yield ETFs"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 xs:space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-3 xs:px-4 py-2 rounded text-xs xs:text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 xs:px-4 py-2 rounded text-xs xs:text-sm">
              {successMessage}
            </div>
          )}
          <div className="space-y-1.5 xs:space-y-2">
            <Label htmlFor="email" className="text-xs xs:text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-sm h-9 xs:h-10"
            />
          </div>

          {!isLogin && (
            <div className="space-y-1.5 xs:space-y-2">
              <Label htmlFor="username" className="text-xs xs:text-sm">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={!isLogin}
                className="text-sm h-9 xs:h-10"
              />
            </div>
          )}

          <div className="space-y-1.5 xs:space-y-2">
            <Label htmlFor="password" className="text-xs xs:text-sm">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="text-sm h-9 xs:h-10"
            />
          </div>

          <Button type="submit" className="w-full text-sm xs:text-base h-9 xs:h-10" disabled={loading}>
            {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <div className="mt-4 xs:mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs xs:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
