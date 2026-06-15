'use client';

import { useState, useEffect } from 'react';
import { api, type PublicSettings } from '@/lib/api';
import { Flame, Landmark, Heart, ArrowLeft, ShieldCheck, Lock, Sparkles, Coins, Gift, Info } from 'lucide-react';
import Link from 'next/link';

interface CampaignMilestone {
  target: number;
  label: string;
  desc: string;
}

const CAMPAIGN_1_MILESTONES: CampaignMilestone[] = [
  { target: 500, label: 'Electrical & Workspace Prep', desc: 'Upgrade kitchen circuits to 240V, construct a heavy-duty oven stand, and organize prep workspace.' },
  { target: 1200, label: 'Baking Accessories & Tools', desc: 'Purchase commercial-grade baking trays, premium proofing bannetons, dough scrapers, and cooling racks.' },
  { target: 2500, label: 'Oven Unit Deposit & Capacity Boost', desc: 'Acquire our multi-deck stone baking oven to scale single-run capacity from 2 to 12 loaves.' }
];

const CAMPAIGN_2_MILESTONES: CampaignMilestone[] = [
  { target: 1500, label: 'Foundation & Base Prep', desc: 'Excavate and pour a solid concrete foundation pad and raise the stone support hearth in the garden.' },
  { target: 3500, label: 'Brick Dome & Chimney Construction', desc: 'Construct the traditional firebrick clay dome, heat retention insulation wrap, and exhaust chimney.' },
  { target: 5000, label: 'Prep Station & Community Bake Launch', desc: 'Install outdoor counter workbenches, protective roofing shelter, and host our first community wood-fired bake day.' }
];

const SUPPORT_TIERS = [
  {
    amount: 10,
    title: 'Flour & Pantry Supporter',
    desc: 'Help us purchase organic flours, sourdough starter feeds, and high-quality baking ingredients.',
    impact: 'Covers raw organic flour for about 5 classic sourdough loaves.'
  },
  {
    amount: 25,
    title: 'Baking Day Helper',
    desc: 'Contributes toward cooking utilities, natural firewood, and specialized ingredients like gourmet cheeses and local honey.',
    impact: 'Funds baking ingredient costs for a full morning run of fresh buns.'
  },
  {
    amount: 50,
    title: 'Equipment Fund Supporter',
    desc: 'Directly funds essential baking tools like linen proofing cloths, lame scoring knives, and heavy-duty baking pans.',
    impact: 'Buys 2 premium wicker bread-proofing baskets.'
  },
  {
    amount: 100,
    title: 'Oven Brick Builder',
    desc: 'Directly funds heavy structural deck stones, refractory clay bricks, or high-amp electrical connectors for either oven.',
    impact: 'Directly purchases 8 high-temp refractory bricks for the dome hearth.'
  }
];

export default function OvenFundPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PublicSettings>('/api/settings/public')
      .then(setSettings)
      .catch((err) => console.error('Failed to load public settings:', err))
      .finally(() => setLoading(false));
  }, []);

  // Campaign 1: Commercial Oven Upgrade
  const title1 = settings?.oven_fund_title || 'Commercial Oven Upgrade Fund — Phase 1';
  const raised1 = Number(settings?.oven_fund_current_amount) || 1620;
  const goal1 = Number(settings?.oven_fund_goal) || 2500;
  const description1 = settings?.oven_fund_description || 'Help us prepare for a commercial stone-deck baking oven by funding the first-stage upgrade: electrical preparation, oven stand, baking trays, proofing tools, and the first deposit toward increased baking capacity.';
  const pct1 = Math.min(100, Math.max(0, Math.round((raised1 / goal1) * 100)));
  const remaining1 = Math.max(0, goal1 - raised1);

  // Campaign 2: Outdoor Wood-Fired Oven
  const title2 = settings?.oven_fund_title_2 || 'Outdoor Wood-Fired Brick Oven';
  const raised2 = Number(settings?.oven_fund_current_amount_2) || 750;
  const goal2 = Number(settings?.oven_fund_goal_2) || 5000;
  const description2 = settings?.oven_fund_description_2 || 'Build a traditional outdoor clay wood-fired brick oven and workbench prep area in the garden for seasonal community baking runs, rustic sourdough, flatbreads, and future workshops.';
  const pct2 = Math.min(100, Math.max(0, Math.round((raised2 / goal2) * 100)));
  const remaining2 = Math.max(0, goal2 - raised2);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C2623]">
      {/* Header Banner */}
      <div className="bg-[#4E3629] text-white py-16 sm:py-20 border-b border-[#8C6D58]/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(217,119,6,0.15),transparent_60%)]" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 text-center relative z-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70 hover:text-white mb-6 uppercase tracking-wider transition-colors">
            <ArrowLeft size={14} /> Back to Homepage
          </Link>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 text-[#F59E0B]">
            <Flame size={26} className="animate-pulse" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none mb-4 font-serif">
            Support the Oven Fund
          </h1>
          <p className="text-base sm:text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Help us expand our baking capacity and bring traditional wood-fired artisan breads to our community. Learn about our active campaigns below.
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        
        {/* Campaign Cards Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          
          {/* Campaign 1: Commercial Oven */}
          <div className="bg-white border border-[#EBE3D5] rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#8C6D58]" />
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-[#8C6D58]/10 text-[#8C6D58] px-2.5 py-1 rounded-full">
                  Primary Goal
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  {pct1}% Complete
                </span>
              </div>
              <h2 className="text-2xl font-bold font-serif text-[#4E3629] mb-3 leading-tight">
                {title1}
              </h2>
              <p className="text-sm text-[#6B5A50] leading-relaxed mb-6">
                {description1}
              </p>

              {/* Progress Tracker */}
              <div className="bg-[#FAF8F5] border border-[#F0EAE1] rounded-2xl p-5 mb-8">
                <div className="flex justify-between text-xs font-semibold text-[#8C6D58] uppercase mb-2">
                  <span>Raised: ${raised1.toLocaleString()}</span>
                  <span>Goal: ${goal1.toLocaleString()}</span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-3.5 bg-[#EBE3D5] rounded-full overflow-hidden mb-3">
                  <div 
                    className="h-full bg-[#8C6D58] rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${pct1}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-[#6B5A50]">
                  <span>{pct1}% Funded</span>
                  <span>{remaining1 > 0 ? `$${remaining1.toLocaleString()} remaining` : 'Goal Reached!'}</span>
                </div>
              </div>

              {/* Roadmap Milestones */}
              <div className="space-y-4 mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C6D58] mb-3">Milestone Roadmap</h3>
                {CAMPAIGN_1_MILESTONES.map((ms, idx) => {
                  const isFunded = raised1 >= ms.target;
                  const prevTarget = idx > 0 ? CAMPAIGN_1_MILESTONES[idx - 1].target : 0;
                  const isActive = raised1 >= prevTarget && raised1 < ms.target;

                  return (
                    <div 
                      key={ms.target} 
                      className={`flex gap-3.5 p-3.5 rounded-2xl border transition-colors ${
                        isFunded 
                          ? 'bg-emerald-50/40 border-emerald-100/60' 
                          : isActive 
                            ? 'bg-[#FAF8F5] border-[#8C6D58] shadow-sm' 
                            : 'bg-gray-50/50 border-gray-100 opacity-60'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${
                        isFunded 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : isActive 
                            ? 'bg-[#8C6D58] text-white' 
                            : 'bg-[#EBE3D5] text-[#8C6D58]'
                      }`}>
                        {isFunded ? <ShieldCheck size={16} /> : idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-[#4E3629]">{ms.label}</span>
                          <span className="text-[10px] font-bold text-[#8C6D58]">(${ms.target})</span>
                        </div>
                        <p className="text-xs text-[#6B5A50] mt-0.5 leading-relaxed">{ms.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Campaign 2: Outdoor Oven */}
          <div className="bg-white border border-[#EBE3D5] rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#C27D38]" />
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-[#C27D38]/10 text-[#C27D38] px-2.5 py-1 rounded-full">
                  Community Project
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  {pct2}% Complete
                </span>
              </div>
              <h2 className="text-2xl font-bold font-serif text-[#4E3629] mb-3 leading-tight">
                {title2}
              </h2>
              <p className="text-sm text-[#6B5A50] leading-relaxed mb-6">
                {description2}
              </p>

              {/* Progress Tracker */}
              <div className="bg-[#FAF8F5] border border-[#F0EAE1] rounded-2xl p-5 mb-8">
                <div className="flex justify-between text-xs font-semibold text-[#C27D38] uppercase mb-2">
                  <span>Raised: ${raised2.toLocaleString()}</span>
                  <span>Goal: ${goal2.toLocaleString()}</span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-3.5 bg-[#EBE3D5] rounded-full overflow-hidden mb-3">
                  <div 
                    className="h-full bg-[#C27D38] rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${pct2}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-[#6B5A50]">
                  <span>{pct2}% Funded</span>
                  <span>{remaining2 > 0 ? `$${remaining2.toLocaleString()} remaining` : 'Goal Reached!'}</span>
                </div>
              </div>

              {/* Roadmap Milestones */}
              <div className="space-y-4 mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#C27D38] mb-3">Milestone Roadmap</h3>
                {CAMPAIGN_2_MILESTONES.map((ms, idx) => {
                  const isFunded = raised2 >= ms.target;
                  const prevTarget = idx > 0 ? CAMPAIGN_2_MILESTONES[idx - 1].target : 0;
                  const isActive = raised2 >= prevTarget && raised2 < ms.target;

                  return (
                    <div 
                      key={ms.target} 
                      className={`flex gap-3.5 p-3.5 rounded-2xl border transition-colors ${
                        isFunded 
                          ? 'bg-emerald-50/40 border-emerald-100/60' 
                          : isActive 
                            ? 'bg-[#FAF8F5] border-[#C27D38] shadow-sm' 
                            : 'bg-gray-50/50 border-gray-100 opacity-60'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${
                        isFunded 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : isActive 
                            ? 'bg-[#C27D38] text-white' 
                            : 'bg-[#EBE3D5] text-[#C27D38]'
                      }`}>
                        {isFunded ? <ShieldCheck size={16} /> : idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-[#4E3629]">{ms.label}</span>
                          <span className="text-[10px] font-bold text-[#C27D38]">(${ms.target})</span>
                        </div>
                        <p className="text-xs text-[#6B5A50] mt-0.5 leading-relaxed">{ms.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Support Tiers Title */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold font-serif text-[#4E3629] tracking-tight">Oven Fund Support Tiers</h2>
          <p className="text-[#6B5A50] text-sm mt-2 max-w-lg mx-auto">Every dollar contributes directly to materials, equipment, and building capacity.</p>
        </div>

        {/* Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {SUPPORT_TIERS.map((tier) => (
            <div 
              key={tier.amount} 
              className="bg-[#FAF8F5] border border-[#EBE3D5] hover:border-[#8C6D58] rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 hover:shadow-sm"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-[#4E3629] font-serif">{tier.title}</h3>
                  <span className="bg-[#8C6D58] text-white font-black px-3.5 py-1 rounded-xl text-base">
                    ${tier.amount === 100 ? '100+' : tier.amount}
                  </span>
                </div>
                <p className="text-[#6B5A50] text-sm leading-relaxed mb-6">
                  {tier.desc}
                </p>
              </div>
              <div className="border-t border-[#EBE3D5] pt-4 mt-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D58] block mb-1">
                  Estimated Project Impact
                </span>
                <p className="text-[#4E3629] text-xs font-semibold">
                  {tier.impact}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Contribution Portal Info */}
        <div className="bg-white border border-[#EBE3D5] rounded-[2.5rem] p-8 md:p-12 text-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-[#8C6D58]" />
          <div className="w-12 h-12 rounded-full bg-[#8C6D58]/10 text-[#8C6D58] flex items-center justify-center mx-auto mb-6">
            <Landmark size={24} />
          </div>
          <h3 className="text-2xl font-bold font-serif text-[#4E3629] tracking-tight mb-3">
            How to Support the Oven Fund
          </h3>
          <p className="text-[#6B5A50] text-sm leading-relaxed max-w-xl mx-auto mb-8">
            To keep Oven Fund contributions separate from our daily bakery store transactions, we coordinate all support manually. You can contribute via:
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left max-w-2xl mx-auto mb-8">
            <div className="bg-[#FAF8F5] border border-[#EBE3D5] rounded-2xl p-5">
              <span className="font-bold text-[#4E3629] text-sm block mb-1">💸 Interac E-Transfer</span>
              <p className="text-xs text-[#6B5A50] leading-relaxed">
                Send your contribution to <span className="font-semibold text-[#8C6D58]">{settings?.etransfer_email || 'kirstinsparks@hotmail.com'}</span> (please add &quot;Oven Fund&quot; in the transfer notes).
              </p>
            </div>
            <div className="bg-[#FAF8F5] border border-[#EBE3D5] rounded-2xl p-5">
              <span className="font-bold text-[#4E3629] text-sm block mb-1">🍞 Cash or Cheque</span>
              <p className="text-xs text-[#6B5A50] leading-relaxed">
                Contributions can be accepted in person during weekly bread pickups or seasonal homestead visits.
              </p>
            </div>
          </div>

          {/* Legal Disclaimer Box */}
          <div className="max-w-xl mx-auto bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-2xl p-4 flex gap-3 text-left mb-8">
            <Info size={20} className="text-[#D97706] shrink-0 mt-0.5" />
            <p className="text-xs text-[#8F5B1E] leading-relaxed font-medium">
              Oven Fund contributions are voluntary support for Cedar & Sage Homestead equipment and growth. They are not charitable donations and no charitable tax receipt will be issued.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C6D58] uppercase tracking-wider">
            <Heart size={12} className="text-[#D97706] animate-pulse" /> Thank you for helping build our homestead capacity!
          </div>
        </div>
      </div>
    </div>
  );
}
