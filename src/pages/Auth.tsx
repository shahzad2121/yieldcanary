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
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [taxRateError, setTaxRateError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // Check current session and handle password-recovery URL on initial load
    const checkSession = async () => {
      try {
        const url = window.location.href;
        const isRecoveryFlow = url.includes("type=recovery");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Session check error:", sessionError);
          return;
        }

        // If the user arrived via a password recovery link, immediately enter reset mode
        if (isRecoveryFlow && session?.user) {
          console.log("Detected password recovery flow from URL during session check");
          setIsResettingPassword(true);
          setIsLogin(true);
          setError("");
          setSuccessMessage("Enter a new password for your YieldCanary account.");
          setPassword("");
          setConfirmPassword("");
          setRecoveryEmail(session.user.email ?? null);
        }
        // NOTE: We no longer auto-redirect to the dashboard here to avoid
        // skipping the reset-password form when coming from recovery links.
      } catch (err) {
        console.error("Error checking session:", err);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);

        if (event === "PASSWORD_RECOVERY") {
          console.log("Password recovery mode activated from auth state change");
          setIsResettingPassword(true);
          setIsLogin(true);
          setError("");
          setSuccessMessage("Enter a new password for your YieldCanary account.");
          setPassword("");
          setConfirmPassword("");
          setRecoveryEmail(session?.user?.email ?? null);
          return;
        }

        if (event === "SIGNED_IN") {
          const urlHasRecovery = window.location.href.includes("type=recovery");
          // If we're in or coming from a recovery flow, don't auto-redirect away
          if (isResettingPassword || urlHasRecovery) {
            console.log("Signed in during password recovery flow; staying on Auth page");
            return;
          }

          if (session?.user) {
            console.log("Signed in normally, navigating to dashboard");
            navigate("/dashboard");
          }
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, [navigate, isResettingPassword]);

  const handleForgotPassword = async () => {
    setError("");
    setSuccessMessage("");

    if (!email) {
      setError("Please enter your email address first");
      return;
    }

    setLoading(true);

    try {
      // Call custom password reset Edge Function that uses Resend
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not set');
      }

      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add authorization header if session exists
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/reset-password`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/auth`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to send password reset email:', error);
        throw new Error(error.error || 'Failed to send password reset email');
      }

      setSuccessMessage("Password reset email sent. Check your inbox for the reset link.");
      toast({
        title: "Password reset email sent",
        description: "Check your inbox and follow the link to set a new password.",
      });
    } catch (err: any) {
      console.error("Forgot password error:", err);
      const errorMessage = err?.message || "Failed to send password reset email";
      setError(errorMessage);
      toast({
        title: "Password Reset Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (isResettingPassword) {
        // Validation for password reset flow
        if (!password || !confirmPassword) {
          setError("Please fill in all password fields");
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          console.error("Update password error:", error);
          throw new Error(error.message);
        }

        setSuccessMessage("Password updated successfully. You can now sign in with your new password.");
        toast({
          title: "Password updated",
          description: "You can now sign in with your new password.",
        });

        // Reset state back to normal login mode
        setIsResettingPassword(false);
        setPassword("");
        setConfirmPassword("");
        setRecoveryEmail(null);
        setIsLogin(true);
      } else if (isLogin) {
        // Validation for login flow
        if (!email || !password) {
          setError("Please fill in all fields");
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }

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
        toast({ title: "Welcome back!", description: "Taking you to the dashboard..." });
      } else {
        // Validation for sign up flow
        if (!email || !password) {
          setError("Please fill in all fields");
          setLoading(false);
          return;
        }

        if (!firstName) {
          setError("Please provide your first name");
          setLoading(false);
          return;
        }

        if (!username) {
          setError("Please provide a username");
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }

        // Determine final tax rate before sign-up
        let finalTaxRate = 20;
        const trimmedTax = taxRate.trim();
        if (trimmedTax !== "") {
          const parsed = Number(trimmedTax);
          if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
            setTaxRateError("Tax rate must be between 0 and 100");
            return;
          }
          finalTaxRate = parsed;
        } else {
          // Empty input means "use default 20%"
          setTaxRate("20");
        }
        setTaxRateError("");

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
        
        // Store username, first name, and tax_rate in Supabase users table
        if (data.user?.email && username) {
          try {
            // Use upsert to handle duplicate email gracefully
            const { error: insertError } = await supabase
              .from('users')
              .upsert(
                {
                  email: data.user.email,
                  username: username,
                  name: firstName,
                  tax_rate: finalTaxRate,
                  subscription_tier: 'free',
                  is_paid: false,
                  subscription_status: 'free',
                },
                { onConflict: 'email' }
              );
            
            if (insertError) {
              console.error("Error storing user profile:", insertError);
            } else {
              console.log("User profile stored with username:", username, "and first name:", firstName);
            }
          } catch (profileError) {
            console.error("Failed to store user profile:", profileError);
          }
        }
        
        // Send welcome email with first name
        if (data.user?.email) {
          try {
            await sendTransactionalEmail({
              to: data.user.email,
              templateId: 'welcome_verify',
              data: { first_name: firstName || username || email.split('@')[0] },
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
          setFirstName("");
          setPassword("");
        } else {
          // Auto-sign in if no email verification needed
          setSuccessMessage("Account created! Signing you in...");
          setEmail("");
          setFirstName("");
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
      <div className="absolute top-3 xs:top-4 right-3 xs:top-4">
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
            {isResettingPassword
              ? "Reset your password"
              : isLogin
                ? "Welcome back"
                : "Create your account"}
          </h1>
          <p className="text-xs xs:text-sm text-muted-foreground mt-1 xs:mt-2">
            {isResettingPassword
              ? recoveryEmail
                ? `Choose a new password for ${recoveryEmail}`
                : "Choose a new password for your account"
              : isLogin
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
          {!isResettingPassword && (
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
          )}

          {!isLogin && !isResettingPassword && (
            <div className="space-y-1.5 xs:space-y-2">
              <Label htmlFor="firstName" className="text-xs xs:text-sm">First Name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required={!isLogin}
                className="text-sm h-9 xs:h-10"
              />
            </div>
          )}

          {!isLogin && !isResettingPassword && (
            <div className="space-y-1.5 xs:space-y-2">
              <Label htmlFor="username" className="text-xs xs:text-sm">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={!isLogin}
                className="text-sm h-9 xs:h-10"
              />
            </div>
          )}

          {!isLogin && !isResettingPassword && (
            <div className="space-y-1.5 xs:space-y-2">
              <Label htmlFor="taxRate" className="text-xs xs:text-sm">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                placeholder="20"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="text-sm h-9 xs:h-10"
              />
              {taxRateError && (
                <p className="text-xs text-destructive">{taxRateError}</p>
              )}
              <p className="text-xs text-muted-foreground">Your tax rate for yield calculations. You can adjust this later.</p>
            </div>
          )}

          <div className="space-y-1.5 xs:space-y-2">
            <Label htmlFor="password" className="text-xs xs:text-sm">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="text-sm h-9 xs:h-10"
            />
          </div>

          {isResettingPassword && (
            <div className="space-y-1.5 xs:space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs xs:text-sm">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="text-sm h-9 xs:h-10"
              />
            </div>
          )}

          {isLogin && !isResettingPassword && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs xs:text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={loading}
              >
                Forgot your password?
              </button>
            </div>
          )}

          <Button type="submit" className="w-full text-sm xs:text-base h-9 xs:h-10" disabled={loading}>
            {loading
              ? "Loading..."
              : isResettingPassword
                ? "Update Password"
                : isLogin
                  ? "Sign In"
                  : "Sign Up"}
          </Button>
        </form>

        {!isResettingPassword && (
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
        )}
      </div>
    </div>
  );
}
