import React from 'react';
import RotatingEarth from './components/RotatingEarth';

export default function App() {
  return (
    <main className="min-h-screen bg-black flex justify-center items-center overflow-hidden relative">
      <div className="relative w-full h-screen flex flex-col items-center justify-center">
        <RotatingEarth />
      </div>
      
      {/* Overlay UI elements for sophistication */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none mix-blend-difference">
        <h1 className="text-2xl font-light tracking-tighter text-white/90">
          GLOBE<span className="font-bold">.GL</span>
        </h1>
        <div className="h-px w-12 bg-white/30 my-2" />
        <p className="text-xs text-white/50 font-mono tracking-widest uppercase">
          Visualization 01
        </p>
      </div>

      <div className="absolute top-8 right-8 z-10 pointer-events-none flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-white/60 font-mono uppercase tracking-widest">System Online</span>
        </div>
        <span className="text-[10px] text-white/40 font-mono">64.223 LAT -12.44 LON</span>
      </div>
    </main>
  );
}