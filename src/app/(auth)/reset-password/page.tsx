"use client";

import { useState, useSyncExternalStore, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import Link from "next/link";

const noopSubscribe = () => () => {};
const readStoredReset = () => {
  try {
    return sessionStorage.getItem("pwreset");
  } catch {
    return null;
  }
};

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The login page stores { email, token } in sessionStorage; older links may still carry them in the URL.
  const stored = useSyncExternalStore(noopSubscribe, readStoredReset, () => null);
  const parsed = (() => {
    try {
      return stored ? (JSON.parse(stored) as { email?: string; token?: string }) : null;
    } catch {
      return null;
    }
  })();
  const token = parsed?.token ?? searchParams.get("token");
  const email = parsed?.email ?? searchParams.get("email");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token || !email) {
      setError("Invalid or missing token. Please sign in again with your temporary password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        try {
          sessionStorage.removeItem("pwreset");
        } catch {}
        toast.success(data.message || "Password updated successfully!");
        router.push("/login");
      } else {
        setError(data.error || "Failed to reset password.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-white/95 backdrop-blur-2xl w-full rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-white/60 p-8 text-center">
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-4 border border-rose-200">
          <i className="ph-bold ph-warning-circle text-3xl"></i>
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">Invalid Reset Link</h2>
        <p className="text-slate-500 text-sm mb-6">Your password reset token is invalid or has expired.</p>
        <Link href="/login" className="inline-flex items-center gap-2 text-amber-600 font-bold hover:underline">
          <i className="ph-bold ph-arrow-left"></i>
          <span>Return to Login</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white/95 backdrop-blur-2xl w-full rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-white/60 p-8 sm:p-10 relative overflow-hidden">
      <div className="flex justify-center mb-6">
        <div className="bg-slate-50/80 p-3 px-6 rounded-2xl border border-slate-100/80 shadow-sm flex items-center justify-center">
          <Image unoptimized src="/assets/logo.png?v=2" alt="Add Designer Logo" width={340} height={90} className="w-[280px] sm:w-[320px] object-contain drop-shadow-sm" />
        </div>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-[1.4rem] font-extrabold text-slate-900 tracking-tight">Create New Password</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">Set a strong password for your studio account</p>
      </div>

      {error && (
        <div className="bg-rose-50/90 text-rose-600 text-xs sm:text-sm p-3.5 rounded-2xl mb-6 text-center border border-rose-200 font-semibold flex items-center justify-center gap-2">
          <i className="ph-bold ph-warning-circle text-base"></i>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={resetPassword} className="flex flex-col gap-5">
        <div className="group relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors">
            <i className="ph ph-lock-key text-[1.2rem]"></i>
          </div>
          <input 
            type={showPassword ? "text" : "password"}
            placeholder="New Password"
            className="w-full h-[52px] pl-11 pr-11 bg-slate-50/70 border border-slate-200 rounded-2xl text-[0.95rem] text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button 
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
            onClick={() => setShowPassword(!showPassword)}
          >
            <i className={`ph ${showPassword ? 'ph-eye' : 'ph-eye-slash'} text-[1.2rem]`}></i>
          </button>
        </div>

        <div className="group relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors">
            <i className="ph ph-lock-key-open text-[1.2rem]"></i>
          </div>
          <input 
            type={showPassword ? "text" : "password"}
            placeholder="Confirm Password"
            className="w-full h-[52px] pl-11 pr-4 bg-slate-50/70 border border-slate-200 rounded-2xl text-[0.95rem] text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 transition-all"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full h-[52px] bg-gradient-to-r from-[#f89d2a] via-[#ff8f00] to-[#e07d00] hover:from-[#e0891d] hover:to-[#c66900] text-white font-extrabold rounded-2xl text-[1rem] shadow-[0_10px_25px_-5px_rgba(248,157,42,0.5)] transition-all flex justify-center items-center gap-2 disabled:opacity-75"
        >
          {loading ? "Updating Password..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="bg-white/95 backdrop-blur-2xl w-full rounded-[2.5rem] p-8 text-center text-slate-500 font-medium">
        Loading form...
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
