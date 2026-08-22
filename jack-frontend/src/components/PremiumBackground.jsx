import React from 'react';
import { motion } from 'framer-motion';

// 🔥 DIRECT LIVE LINKS (For Realistic Background)
const SKY_BG_URL = "https://images.unsplash.com/photo-1499346141973-206e12368ee3?q=80&w=2000&auto=format&fit=crop"; 
const DRONE_IMG_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Drone_DJI_Phantom_3_Professional.png/800px-Drone_DJI_Phantom_3_Professional.png";

// --- REALISTIC PARCEL BOX COMPONENT ---
const RealisticParcelBox = () => {
  return (
    <div className="w-[85px] h-[75px] bg-[#C19A6B] rounded-md mt-[-8px] relative z-10 shadow-[0_20px_30px_-10px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center border-t-4 border-[#A0522D] overflow-hidden">
      
      {/* 3D Box Texture & Shadow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/40"></div>
      
      {/* Premium Branded Tape */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[14px] bg-[#111827] -translate-x-1/2 shadow-inner flex flex-col items-center justify-center overflow-hidden">
        <span className="text-[#FF4500] font-black text-[5px] rotate-90 tracking-widest opacity-80 whitespace-nowrap">EXPRESS</span>
      </div>
      
      {/* Jack Essentials Logo Mark */}
      <div className="relative z-20 text-center bg-white/90 px-2.5 py-1.5 border border-white/50 rounded shadow-sm backdrop-blur-md transform -rotate-2">
        <span className="text-slate-900 font-black text-xl leading-none tracking-tighter drop-shadow-sm flex items-baseline">
          J<span className="text-[#FF4500]">S</span>
        </span>
        <div className="h-[2px] w-[90%] bg-slate-200 my-0.5 mx-auto rounded-full"></div>
        <span className="text-slate-700 font-black text-[7px] tracking-[0.1em] uppercase">Jack Essentials</span>
      </div>
    </div>
  );
};

// --- DRONE WITH PARCEL ANIMATED COMPONENT ---
const AnimatedDrone = ({ delay, duration, startY, endY, leftPos, scale, isDistant }) => {
  return (
    <motion.div
      className="absolute pointer-events-none"
      // Performance optimization for smooth rendering
      style={{ left: leftPos, top: startY, willChange: 'transform' }}
      animate={{
        y: [0, endY - startY], 
        // Added realistic wind turbulence (random swaying)
        rotate: [0, 4, -2, 5, -4, 0], 
        x: [0, 15, -10, 20, -15, 0] 
      }}
      transition={{
        y: { duration: duration, delay: delay, repeat: Infinity, ease: "linear" }, 
        rotate: { duration: duration * 0.7, delay: delay, repeat: Infinity, ease: "easeInOut" }, 
        x: { duration: duration * 0.8, delay: delay, repeat: Infinity, ease: "easeInOut" } 
      }}
    >
      {/* Depth of field effect using blur and scale */}
      <div className={`flex flex-col items-center ${isDistant ? 'blur-[2px] opacity-60' : 'drop-shadow-2xl opacity-95'}`} style={{ scale: scale }}>
        
        <div className="relative">
          {/* Realistic Drone Image */}
          <img 
            src={DRONE_IMG_URL} 
            alt="JACK Delivery Drone" 
            className="w-[160px] h-auto object-contain"
          />
          
          {/* 🔥 PRO FEATURE: Blinking Navigation LED */}
          <div className="absolute bottom-[25%] right-[10%] w-2 h-2 bg-red-500 rounded-full animate-ping shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
          <div className="absolute bottom-[25%] left-[10%] w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
        </div>
        
        {/* String holding box */}
        <div className="w-[1.5px] h-[28px] bg-gradient-to-b from-slate-600 to-slate-400 mt-[-18px] z-0 origin-top animate-pulse"></div>
        
        {/* Realistic Parcel Box */}
        <RealisticParcelBox />
        
      </div>
    </motion.div>
  );
};

const PremiumBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden z-0 bg-sky-100">
      
      {/* Realistic Sky Image Background with Gradient Overlay for Text Readability */}
      <div className="absolute inset-0 z-0">
        <img 
          src={SKY_BG_URL} 
          alt="Sky Background" 
          className="w-full h-full object-cover opacity-90"
        />
        {/* Adds a slight dark gradient at the bottom so page content stays readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-slate-50/80"></div>
      </div>
      
      {/* 5 Smooth Realistic Drones (Mixed depth for Parallax) */}
      {[
        { id: 1, delay: 0, duration: 18, startY: '110vh', endY: '-30vh', leftPos: '10%', scale: 1.1, isDistant: false },
        { id: 2, delay: 4, duration: 28, startY: '115vh', endY: '-20vh', leftPos: '45%', scale: 0.6, isDistant: true },
        { id: 3, delay: 2, duration: 22, startY: '120vh', endY: '-35vh', leftPos: '75%', scale: 0.9, isDistant: false },
        { id: 4, delay: 12, duration: 35, startY: '110vh', endY: '-15vh', leftPos: '85%', scale: 0.45, isDistant: true },
        { id: 5, delay: 8, duration: 24, startY: '125vh', endY: '-40vh', leftPos: '25%', scale: 0.85, isDistant: false },
      ].map((drone) => (
        <AnimatedDrone key={drone.id} {...drone} />
      ))}
      
    </div>
  );
};

export default PremiumBackground;