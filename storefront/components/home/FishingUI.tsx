'use client';

import { useState, useEffect } from 'react';
import { Trophy, Coins, Fish, Send } from 'lucide-react';

interface Highscore {
  initials: string;
  score: number;
  created_at: string;
}

interface FishingUIProps {
  points: number;
  poleLevel: number;
  baitLevel: number;
  onUpgradePole: () => void;
  onUpgradeBait: () => void;
  gamePhase: string; // 'idle' | 'cast' | 'biting' | 'reeling' | 'caught' | 'escaped' | 'highscore'
  tension: number; // 0 to 1
  onReel: () => void;
  onSubmitHighscore: (initials: string) => void;
}

export default function FishingUI({
  points,
  poleLevel,
  baitLevel,
  onUpgradePole,
  onUpgradeBait,
  gamePhase,
  tension,
  onReel,
  onSubmitHighscore,
}: FishingUIProps) {
  const [highscores, setHighscores] = useState<Highscore[]>([]);
  const [initials, setInitials] = useState('');
  const [showHighscores, setShowHighscores] = useState(false);

  const poleCost = poleLevel * 150;
  const baitCost = baitLevel * 100;

  useEffect(() => {
    fetch('/api/highscores')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setHighscores(data);
      })
      .catch(console.error);
  }, [gamePhase]); // Refresh when game phase changes

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 md:p-8">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex gap-4 pointer-events-auto">
          {/* Stats & Upgrades */}
          <div className="bg-white/80 backdrop-blur-md border border-brand-border/50 rounded-2xl p-4 shadow-xl text-brand-text flex flex-col gap-3 min-w-[200px]">
            <div className="flex items-center justify-between border-b border-brand-border/30 pb-2">
              <span className="font-semibold text-sm uppercase tracking-wider text-brand-text/70">Points</span>
              <span className="font-bold text-xl flex items-center gap-1 text-[#D4894F]">
                {points} <Coins size={18} />
              </span>
            </div>

            <button
              onClick={onUpgradePole}
              disabled={points < poleCost}
              className="flex justify-between items-center bg-brand-surface hover:bg-brand-secondary/20 transition-colors p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold">Pole Lv.{poleLevel}</span>
                <span className="text-xs text-brand-text/70">Stronger reeling</span>
              </div>
              <span className="text-sm font-bold">{poleCost} pts</span>
            </button>

            <button
              onClick={onUpgradeBait}
              disabled={points < baitCost}
              className="flex justify-between items-center bg-brand-surface hover:bg-brand-secondary/20 transition-colors p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold">Bait Lv.{baitLevel}</span>
                <span className="text-xs text-brand-text/70">Attracts faster</span>
              </div>
              <span className="text-sm font-bold">{baitCost} pts</span>
            </button>
          </div>
        </div>

        {/* Highscores Toggle */}
        <div className="pointer-events-auto">
          <button
            onClick={() => setShowHighscores(!showHighscores)}
            className="bg-white/80 backdrop-blur-md p-3 rounded-full shadow-xl hover:bg-white transition-colors text-[#D4894F]"
            title="Highscores"
          >
            <Trophy size={24} />
          </button>
          
          {showHighscores && (
            <div className="absolute right-4 md:right-8 top-20 bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl w-64 border border-[#D4894F]/20">
              <h3 className="text-lg font-bold text-brand-text text-center border-b border-brand-border/50 pb-2 mb-2 uppercase tracking-widest">Highscores</h3>
              <div className="flex flex-col gap-2">
                {highscores.map((hs, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="font-bold font-mono text-brand-text/60 w-6">{i + 1}.</span>
                    <span className="font-bold text-brand-text tracking-widest">{hs.initials}</span>
                    <span className="font-bold text-[#D4894F] text-right w-12">{hs.score}</span>
                  </div>
                ))}
                {highscores.length === 0 && (
                  <div className="text-center text-sm text-brand-text/50">No scores yet.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Area (Center/Bottom) */}
      <div className="flex-1 flex items-center justify-center pointer-events-none">
        {gamePhase === 'idle' && (
          <div className="text-white/60 font-medium text-lg uppercase tracking-widest animate-pulse drop-shadow-md">
            Click on water to cast line
          </div>
        )}
        {gamePhase === 'biting' && (
          <div className="text-white font-bold text-3xl uppercase tracking-widest animate-bounce drop-shadow-lg text-red-400">
            ! BITE !
          </div>
        )}
        {gamePhase === 'reeling' && (
          <div className="flex flex-col items-center gap-4 pointer-events-auto w-full max-w-sm">
            <div className="text-white font-bold text-xl uppercase tracking-widest drop-shadow-md">
              Reel it in!
            </div>
            {/* Tension Bar */}
            <div className="w-full bg-black/50 border-2 border-white/50 rounded-full h-6 overflow-hidden relative">
              {/* Green Zone */}
              <div className="absolute top-0 bottom-0 left-[20%] right-[20%] bg-green-500/30" />
              <div 
                className={`h-full transition-all duration-75 ${tension > 0.8 || tension < 0.2 ? 'bg-red-500' : 'bg-green-400'}`}
                style={{ width: `${tension * 100}%` }}
              />
            </div>
            <button
              onPointerDown={onReel}
              className="bg-[#D4894F] text-white px-8 py-4 rounded-full font-bold text-xl shadow-[0_4px_0_#A86530] active:shadow-[0_0px_0_#A86530] active:translate-y-1 transition-all"
            >
              REEL
            </button>
          </div>
        )}
        {gamePhase === 'escaped' && (
          <div className="text-white/80 font-bold text-3xl uppercase tracking-widest drop-shadow-lg text-red-300">
            Got Away...
          </div>
        )}
        {gamePhase === 'caught' && (
          <div className="text-white font-bold text-4xl uppercase tracking-widest drop-shadow-lg text-green-300 animate-[bounce_0.5s_infinite]">
            Caught!
          </div>
        )}
        {gamePhase === 'highscore' && (
          <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl pointer-events-auto border-4 border-[#D4894F] flex flex-col items-center gap-6 transform animate-[scale-in_0.3s_ease-out]">
            <h2 className="text-3xl font-black text-brand-text uppercase tracking-widest">New Highscore!</h2>
            <div className="text-[#D4894F] text-5xl font-black">{points}</div>
            <p className="text-brand-text/70 text-sm uppercase tracking-wider font-semibold">Enter 3 Initials</p>
            <div className="flex items-center gap-4">
              <input 
                type="text" 
                maxLength={3}
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                className="w-32 h-16 text-center text-4xl font-black font-mono tracking-widest rounded-xl border-2 border-brand-border bg-brand-surface focus:border-[#D4894F] focus:ring-4 focus:ring-[#D4894F]/20 outline-none uppercase"
                placeholder="AAA"
                autoFocus
              />
              <button
                disabled={initials.length !== 3}
                onClick={() => onSubmitHighscore(initials)}
                className="w-16 h-16 rounded-xl bg-[#D4894F] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#b5713c] transition-colors"
              >
                <Send size={24} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
