"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { MotionConfig, motion, useAnimationControls, useMotionTemplate, useMotionValue, useSpring, useTransform, type Variants } from "framer-motion";
import InkDrops from "./InkDrops";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// Entrance choreography: headline lines rise out of a mask, then the copy, badges and printer.
const stagger = (gap: number, delay = 0): Variants => ({ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } });
const rise: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT_EXPO } },
};
const lineRise: Variants = {
  hidden: { y: "110%" },
  show: { y: "0%", transition: { duration: 0.8, ease: EASE_OUT_EXPO } },
};
const printerIn: Variants = {
  hidden: { opacity: 0, x: -60, scale: 0.94 },
  show: { opacity: 1, x: 0, scale: 1, transition: { duration: 1, ease: EASE_OUT_EXPO } },
};

/** Pointer position across the window as springs from -1 to 1 (still on touch or reduced motion). */
function usePointer() {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, { stiffness: 60, damping: 18, mass: 0.6 });
  const py = useSpring(rawY, { stiffness: 60, damping: 18, mass: 0.6 });
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(pointer: coarse)").matches) return;
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth) * 2 - 1);
      rawY.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [rawX, rawY]);
  return { px, py };
}

/** Only allow same-origin relative redirects after login. */
function safeCallbackUrl(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard/overview";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { px, py } = usePointer();
  const card = useAnimationControls();

  // 3D tilt: the printer turns toward the pointer; the card leans less, with a glare that follows it.
  const printerRotY = useTransform(px, [-1, 1], [-12, 12]);
  const printerRotX = useTransform(py, [-1, 1], [7, -7]);
  const cardRotY = useTransform(px, [-1, 1], [-5, 5]);
  const cardRotX = useTransform(py, [-1, 1], [4, -4]);
  const glareX = useTransform(px, [-1, 1], [10, 90]);
  const glareY = useTransform(py, [-1, 1], [5, 70]);
  const glare = useMotionTemplate`radial-gradient(420px circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.55), transparent 55%)`;

  const fail = (message: string) => {
    setError(message);
    card.start({ x: [0, -12, 10, -7, 4, 0], transition: { duration: 0.45, ease: "easeOut" } });
  };

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
        // Hand the one-time code to the reset page without putting it in the URL/history.
        const token = signInData.error.split(":")[1];
        try {
          sessionStorage.setItem("pwreset", JSON.stringify({ email: data.email.trim().toLowerCase(), token }));
        } catch {}
        router.push("/reset-password");
        return;
      }
      
      if (signInData.error === "Approval pending") {
        setShowPendingPopup(true);
      } else if (signInData.error === "Account deactivated") {
        fail("Your account has been deactivated. Please contact support.");
      } else if (signInData.error.startsWith("Too many attempts")) {
        fail(signInData.error);
      } else {
        fail("Invalid credentials. Please try again.");
      }
      setLoading(false);
    } else {
      router.push(safeCallbackUrl(searchParams.get("callbackUrl")));
      router.refresh();
    }
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-12 items-center lg:min-h-[80dvh]">
      
      {/* LEFT COLUMN: Hero Section with Printer graphic */}
      <motion.div
        className="w-full lg:col-span-6 xl:col-span-7 flex flex-col justify-between pt-1 lg:pt-0 relative z-10 text-white text-center lg:text-left"
        variants={stagger(0.1)}
        initial="hidden"
        animate="show"
      >
        <div className="hidden lg:contents"><InkDrops px={px} py={py} /></div>
        
        {/* Top Headlines */}
        <div className="space-y-2 sm:space-y-4 mb-3 sm:mb-5 lg:mb-8 lg:short:mb-5">

          <h1 className="relative text-3xl sm:text-4xl xl:text-6xl lg:short:text-5xl font-light tracking-tight text-slate-100 leading-[1.1]">
            <span className="block overflow-hidden pb-1">
              <motion.span className="inline-block" variants={lineRise}>Bringing Your</motion.span>
            </span>
            <span className="block overflow-hidden pb-2">
              <motion.span className="inline-block" variants={lineRise}>
                <span className="signin-gradient-text font-extrabold bg-gradient-to-r from-[#ff007a] via-[#ff4d00] to-[#ff007a] bg-clip-text text-transparent">
                  Ideas
                </span>{" "}
                <span className="signin-gradient-text font-extrabold bg-gradient-to-r from-[#00d2ff] to-[#3a7bd5] bg-clip-text text-transparent">
                  to Life
                </span>
              </motion.span>
            </span>
          </h1>

          <motion.p variants={rise} className="relative hidden sm:block text-slate-300 text-sm sm:text-base xl:text-lg max-w-lg mx-auto lg:mx-0 font-normal leading-relaxed pt-1">
            High quality prints, creative designs, and custom solutions — all in one place.
          </motion.p>
        </div>

        {/* 4 Feature Badges */}
        <motion.div variants={stagger(0.08)} className="relative hidden md:grid grid-cols-4 gap-3 lg:gap-4 my-2 lg:my-4 lg:short:my-2 max-w-xl mx-auto lg:mx-0 text-center [perspective:800px]">
          
          <motion.div
            variants={rise}
            whileHover={{ y: -5, rotateX: 8, scale: 1.04 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] hover:border-white/25 hover:bg-white/10 transition-colors"
          >
            <div className="text-[#d946ef] text-xl mb-1"><i className="ph-fill ph-lightning" aria-hidden="true"></i></div>
            <div className="text-[0.75rem] font-medium text-slate-200">Fast Service</div>
          </motion.div>

          <motion.div
            variants={rise}
            whileHover={{ y: -5, rotateX: 8, scale: 1.04 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] hover:border-white/25 hover:bg-white/10 transition-colors"
          >
            <div className="text-[#3b82f6] text-xl mb-1"><i className="ph-fill ph-shield-check" aria-hidden="true"></i></div>
            <div className="text-[0.75rem] font-medium text-slate-200">Premium Quality</div>
          </motion.div>

          <motion.div
            variants={rise}
            whileHover={{ y: -5, rotateX: 8, scale: 1.04 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] hover:border-white/25 hover:bg-white/10 transition-colors"
          >
            <div className="text-[#eab308] text-xl mb-1"><i className="ph-fill ph-palette" aria-hidden="true"></i></div>
            <div className="text-[0.75rem] font-medium text-slate-200">Custom Designs</div>
          </motion.div>

          <motion.div
            variants={rise}
            whileHover={{ y: -5, rotateX: 8, scale: 1.04 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] hover:border-white/25 hover:bg-white/10 transition-colors"
          >
            <div className="text-[#22c55e] text-xl mb-1"><i className="ph-fill ph-heart" aria-hidden="true"></i></div>
            <div className="text-[0.75rem] font-medium text-slate-200">Customer Satisfaction</div>
          </motion.div>

        </motion.div>

        {/* Laser Printer Graphic at Bottom Left */}
        <motion.div variants={printerIn} className="relative hidden lg:block mt-4 lg:short:mt-2 -ml-4 pointer-events-none [perspective:1100px]">
          {/* Soft floor shadow */}
          <div className="printer-shadow absolute bottom-[2%] left-[8%] h-[14%] w-[70%] max-w-[340px] rounded-[50%] bg-black/70 blur-2xl" aria-hidden="true" />
          <motion.div
            className="relative w-full max-w-[480px] lg:short:max-w-[380px] [transform-style:preserve-3d]"
            style={{ rotateY: printerRotY, rotateX: printerRotX }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image 
              unoptimized 
              src="/assets/signin/printerSignin.png" 
              alt="Laser Printer Graphic" 
              width={600} 
              height={400} 
              className="w-full max-w-[480px] h-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
            />
            {/* Specular light sweeping across the machine */}
            <div className="printer-sheen absolute inset-0" aria-hidden="true" />
            {/* Blue status light breathing */}
            <div className="printer-glow absolute left-[30%] top-[9%] h-[6%] w-[34%] rounded-full bg-sky-400/70 blur-xl mix-blend-screen" aria-hidden="true" />
            {/* Ink dripping off the wet print */}
            <span className="ink-drip absolute left-[58%] top-[86%] h-3 w-2 rounded-b-full rounded-t-[40%] bg-[#ec008c] shadow-[0_0_10px_rgba(236,0,140,0.8)]" style={{ animationDelay: "0s" }} aria-hidden="true" />
            <span className="ink-drip absolute left-[71%] top-[89%] h-3.5 w-2.5 rounded-b-full rounded-t-[40%] bg-[#00aeef] shadow-[0_0_10px_rgba(0,174,239,0.8)]" style={{ animationDelay: "-1.1s" }} aria-hidden="true" />
            <span className="ink-drip absolute left-[84%] top-[93%] h-3 w-2 rounded-b-full rounded-t-[40%] bg-[#ffd400] shadow-[0_0_10px_rgba(255,212,0,0.8)]" style={{ animationDelay: "-2s" }} aria-hidden="true" />
          </motion.div>
        </motion.div>

      </motion.div>


      {/* RIGHT COLUMN: White Auth Card with Fluid Splashes */}
      <div className="w-full lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end [perspective:1400px]">
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.25 }}
          style={{ rotateY: cardRotY, rotateX: cardRotX }}
          className="w-full max-w-[450px] lg:max-w-[470px] [transform-style:preserve-3d]"
        >
        <motion.div animate={card} className="bg-white w-full rounded-[1.75rem] sm:rounded-[2.2rem] shadow-[0_25px_70px_rgba(0,0,0,0.45)] p-6 sm:p-8 lg:p-10 lg:short:p-8 relative overflow-hidden z-20">
          {/* Glare that follows the pointer across the card */}
          <motion.div className="pointer-events-none absolute inset-0 z-30 opacity-40 mix-blend-soft-light" style={{ background: glare }} aria-hidden="true" />
          
          {/* Top-Right Liquid Splash Decor */}
          <Image 
            unoptimized 
            src="/assets/signin/singinPanelTopRight.png" 
            alt="Top Right Splash" 
            width={180} 
            height={180} 
            className="absolute top-0 right-0 w-[110px] sm:w-[170px] h-auto pointer-events-none select-none z-10" 
          />

          {/* Bottom-Left Liquid Splash Decor */}
          <Image 
            unoptimized 
            src="/assets/signin/singinPanelBottomLeft.png" 
            alt="Bottom Left Splash" 
            width={180} 
            height={180} 
            className="absolute bottom-0 left-0 w-[110px] sm:w-[170px] h-auto pointer-events-none select-none z-10" 
          />

          {/* Card Content Container */}
          <motion.div className="relative z-20 py-0 sm:py-2 lg:short:py-0" variants={stagger(0.07, 0.45)} initial="hidden" animate="show">
            
            {/* Header Logo & Titles */}
            <motion.div variants={rise} className="flex flex-col items-center justify-center text-center mb-4 sm:mb-6 lg:short:mb-4">
              <div className="mb-2 sm:mb-3">
                <Image 
                  unoptimized 
                  src="/assets/logo.png?v=2" 
                  alt="Add Designer Logo" 
                  width={340} 
                  height={90} 
                  className="w-[200px] sm:w-[250px] lg:w-[280px] lg:short:w-[230px] h-auto object-contain drop-shadow-sm" 
                />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome Back!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5">
                Sign in to continue to your account
              </p>
            </motion.div>

            {/* Error Notification Alert */}
            {error && (
              <motion.div role="alert" key={error} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="bg-rose-50 text-rose-600 text-xs sm:text-sm p-3.5 rounded-2xl mb-6 text-center border border-rose-200 font-semibold flex items-center justify-center gap-2">
                <i className="ph-bold ph-warning-circle text-base"></i>
                <span>{error}</span>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={loginUser} className="flex flex-col gap-3.5 sm:gap-5 lg:short:gap-4">
              
              {/* Username / Email Input */}
              <motion.div variants={rise} className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <i className="ph ph-user text-[1.2rem]"></i>
                </div>
                <input 
                  type="email" 
                  placeholder="Email / Username"
                  className="w-full h-12 sm:h-[52px] pl-12 pr-4 bg-white border border-slate-200/90 rounded-full text-[0.95rem] text-slate-800 font-medium focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition-all placeholder:text-slate-400"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                  required
                />
              </motion.div>

              {/* Password Input */}
              <motion.div variants={rise} className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <i className="ph ph-lock-key text-[1.2rem]"></i>
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="w-full h-12 sm:h-[52px] pl-12 pr-12 bg-white border border-slate-200/90 rounded-full text-[0.95rem] text-slate-800 font-medium focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition-all placeholder:text-slate-400"
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
              </motion.div>

              {/* Checkbox & Forgot Password */}
              <motion.div variants={rise} className="flex justify-between items-center px-1 mt-1 mb-1">
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
              </motion.div>

              {/* Gradient Action Button */}
              <motion.button
                variants={rise}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit" 
                disabled={loading}
                className="group relative overflow-hidden w-full h-12 sm:h-[54px] mt-1 sm:mt-2 bg-gradient-to-r from-[#ff007f] via-[#ff5500] to-[#ff9f1c] hover:opacity-95 text-white font-extrabold rounded-full text-[1.05rem] shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 transition-shadow duration-200 flex justify-center items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                <span aria-hidden="true" className="signin-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/35" />
                {loading ? (
                  <div className="flex items-center gap-2.5">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <div className="relative flex items-center gap-2">
                    <span>Sign In</span>
                    <i className="ph-bold ph-arrow-right text-lg transition-transform duration-200 group-hover:translate-x-1"></i>
                  </div>
                )}
              </motion.button>

            </form>

          </motion.div>

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
                  Please check back later or contact the business owner.
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
        </motion.div>
        </motion.div>
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <MotionConfig reducedMotion="user">
      <Suspense>
        <LoginForm />
      </Suspense>
    </MotionConfig>
  );
}
