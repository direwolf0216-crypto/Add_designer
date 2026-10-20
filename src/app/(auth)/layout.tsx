import React from 'react';
import { Outfit } from 'next/font/google';
import Image from 'next/image';

const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] });

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen w-full flex items-center justify-center bg-[#060b1c] relative ${outfit.className} overflow-hidden selection:bg-pink-500 selection:text-white`}>
      
      {/* Top Right Vibrant Fluid Splash / Blobs */}
      <div className="absolute top-0 right-0 w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] pointer-events-none z-0">
        <div className="absolute top-[-50px] right-[-50px] w-[350px] h-[300px] bg-gradient-to-bl from-[#ff007a] via-[#ff4d00] to-[#ffb800] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] blur-sm opacity-95"></div>
        <div className="absolute top-[120px] right-[140px] w-[36px] h-[36px] bg-[#ffb800] rounded-full shadow-lg"></div>
        <div className="absolute top-[170px] right-[90px] w-[24px] h-[24px] bg-[#ff007a] rounded-full shadow-lg"></div>
      </div>

      {/* Bottom Right Fluid Wave Graphic */}
      <div className="absolute bottom-0 right-0 w-[400px] sm:w-[550px] h-auto pointer-events-none z-0">
        <Image
          unoptimized
          src="/assets/signin/rightBottom.png"
          alt="Bottom Right Wave"
          width={600}
          height={600}
          className="w-full h-auto object-contain opacity-95"
        />
      </div>

      {/* Ambient Radial Glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container Wrapper */}
      <div className="z-10 w-full max-w-[1320px] px-4 sm:px-8 lg:px-12 py-6 relative">
        {children}
      </div>
    </div>
  );
}
