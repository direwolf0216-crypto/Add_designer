"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [data, setData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const signInData = await signIn("credentials", {
      ...data,
      redirect: false,
    });

    if (signInData?.error) {
      if (signInData.error.startsWith("TEMPORARY_PASSWORD:")) {
        const token = signInData.error.split(":")[1];
        router.push(`/reset-password?token=${token}`);
        return;
      }
      
      if (signInData.error === "Approval pending") {
        setShowPendingPopup(true);
      } else if (signInData.error === "Account deactivated") {
        setError("Your account has been deactivated. Please contact support.");
      } else {
        setError("Invalid credentials. Please try again.");
      }
      setLoading(false);
    } else {
      router.push("/dashboard/overview");
      router.refresh();
    }
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-h-[80vh]">
      
      {/* LEFT COLUMN: Hero Section with Printer graphic */}
      <div className="w-full lg:col-span-6 xl:col-span-7 flex flex-col justify-between pt-4 lg:pt-0 relative z-10 text-white">
        
        {/* Top Headlines */}
        <div className="space-y-4 mb-8">

          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-light tracking-tight text-slate-100 leading-[1.1]">
            Bringing Your <br />
            <span className="font-extrabold bg-gradient-to-r from-[#ff007a] via-[#ff4d00] to-[#ff007a] bg-clip-text text-transparent">
              Ideas
            </span>{" "}
            <span className="font-extrabold bg-gradient-to-r from-[#00d2ff] to-[#3a7bd5] bg-clip-text text-transparent">
              to Life
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base xl:text-lg max-w-lg font-normal leading-relaxed pt-1">
            High quality prints, creative designs, and custom solutions — all in one place.
          </p>
        </div>

        {/* 4 Feature Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-4 max-w-xl text-center">
          
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[#d946ef] text-xl mb-1">⚡</div>
            <div className="text-[0.75rem] font-medium text-slate-200">Fast Service</div>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[#3b82f6] text-xl mb-1">🛡️</div>
            <div className="text-[0.75rem] font-medium text-slate-200">Premium Quality</div>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[#eab308] text-xl mb-1">🎨</div>
            <div className="text-[0.75rem] font-medium text-slate-200">Custom Designs</div>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[#22c55e] text-xl mb-1">💚</div>
            <div className="text-[0.75rem] font-medium text-slate-200">Customer Satisfaction</div>
          </div>

        </div>

        {/* Laser Printer Graphic at Bottom Left */}
        <div className="relative mt-4 -ml-4 pointer-events-none">
          <Image 
            unoptimized 
            src="/assets/signin/printerSignin.png" 
            alt="Laser Printer Graphic" 
            width={600} 
            height={400} 
            className="w-full max-w-[480px] h-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
          />
        </div>

      </div>


      {/* RIGHT COLUMN: White Auth Card with Fluid Splashes */}
      <div className="w-full lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end">
        <div className="bg-white w-full max-w-[450px] lg:max-w-[470px] rounded-[2.2rem] shadow-[0_25px_70px_rgba(0,0,0,0.45)] p-8 sm:p-10 relative overflow-hidden z-20">
          
          {/* Top-Right Liquid Splash Decor */}
          <Image 
            unoptimized 
            src="/assets/signin/singinPanelTopRight.png" 
            alt="Top Right Splash" 
            width={180} 
            height={180} 
            className="absolute top-0 right-0 w-[140px] sm:w-[170px] h-auto pointer-events-none select-none z-10" 
          />

          {/* Bottom-Left Liquid Splash Decor */}
          <Image 
            unoptimized 
            src="/assets/signin/singinPanelBottomLeft.png" 
            alt="Bottom Left Splash" 
            width={180} 
            height={180} 
            className="absolute bottom-0 left-0 w-[140px] sm:w-[170px] h-auto pointer-events-none select-none z-10" 
          />

          {/* Card Content Container */}
          <div className="relative z-20 py-2">
            
            {/* Header Logo & Titles */}
            <div className="flex flex-col items-center justify-center text-center mb-6">
              <div className="mb-3">
                <Image 
                  unoptimized 
                  src="/assets/logo.png?v=2" 
                  alt="Add Designer Logo" 
                  width={340} 
                  height={90} 
                  className="w-[250px] sm:w-[280px] h-auto object-contain drop-shadow-sm" 
                />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome Back!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5">
                Sign in to continue to your account
              </p>
            </div>

            {/* Error Notification Alert */}
            {error && (
              <div className="bg-rose-50 text-rose-600 text-xs sm:text-sm p-3.5 rounded-2xl mb-6 text-center border border-rose-200 font-semibold flex items-center justify-center gap-2">
                <i className="ph-bold ph-warning-circle text-base"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={loginUser} className="flex flex-col gap-5">
              
              {/* Username / Email Input */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <i className="ph ph-user text-[1.2rem]"></i>
                </div>
                <input 
                  type="email" 
                  placeholder="Email / Username"
                  className="w-full h-[52px] pl-12 pr-4 bg-white border border-slate-200/90 rounded-full text-[0.95rem] text-slate-800 font-medium focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition-all placeholder:text-slate-400"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                  required
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <i className="ph ph-lock-key text-[1.2rem]"></i>
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="w-full h-[52px] pl-12 pr-12 bg-white border border-slate-200/90 rounded-full text-[0.95rem] text-slate-800 font-medium focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition-all placeholder:text-slate-400"
                  value={data.password}
                  onChange={(e) => setData({ ...data, password: e.target.value })}
                  required
                />
                <button 
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  <i className={`ph ${showPassword ? 'ph-eye' : 'ph-eye-slash'} text-[1.2rem]`}></i>
                </button>
              </div>

              {/* Checkbox & Forgot Password */}
              <div className="flex justify-between items-center px-1 mt-1 mb-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 accent-blue-600 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer" 
                  />
                  <span className="text-[0.825rem] text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Remember Me</span>
                </label>
                <a 
                  href="#" 
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!data.email) {
                      setError("Please enter your email address to reset your password.");
                    } else {
                      try {
                        const res = await fetch('/api/auth/forgot-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: data.email })
                        });
                        const resData = await res.json();
                        if (res.ok) {
                          toast.success(resData.message || "Password reset instructions sent.");
                          setError(null);
                        } else {
                          setError(resData.error || "Failed to send reset instructions.");
                        }
                      } catch (err) {
                        setError("An error occurred. Please try again.");
                      }
                    }
                  }} 
                  className="text-[0.825rem] text-blue-600 font-bold hover:text-blue-700 hover:underline transition-colors"
                >
                  Forgot Password?
                </a>
              </div>

              {/* Gradient Action Button */}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full h-[54px] mt-2 bg-gradient-to-r from-[#ff007f] via-[#ff5500] to-[#ff9f1c] hover:opacity-95 text-white font-extrabold rounded-full text-[1.05rem] shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 transition-all duration-200 flex justify-center items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed transform active:scale-[0.99]"
              >
                {loading ? (
                  <div className="flex items-center gap-2.5">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Sign In</span>
                    <i className="ph-bold ph-arrow-right text-lg"></i>
                  </div>
                )}
              </button>

            </form>

          </div>

          {/* Approval Pending Modal Popup */}
          {showPendingPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-fade-in" onClick={() => setShowPendingPopup(false)}></div>
              <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-[400px] overflow-hidden animate-scale-up p-8 text-center z-30">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mx-auto mb-5 border border-amber-200/60 shadow-inner">
                  <i className="ph-fill ph-hourglass-high text-3xl"></i>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">Approval Pending</h3>
                <p className="text-[0.925rem] text-slate-500 mb-8 leading-relaxed">
                  Your account has been successfully created, but it is currently waiting for an Administrator to approve it. 
                  <br/><br/>
                  Please check back later or contact the Studio Owner.
                </p>
                <button 
                  onClick={() => setShowPendingPopup(false)}
                  className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors shadow-md"
                >
                  Okay, I understand
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
