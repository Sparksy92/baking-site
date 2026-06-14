import { Flame, Landmark, Heart, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function OvenFundPage() {
  const goal = 2500;
  const raised = 1620;
  const percentage = Math.round((raised / goal) * 100);

  const tiers = [
    {
      amount: 10,
      title: 'Flour & Pantry Support',
      description: 'Helps us purchase high-quality local organic grains, flour, and initial pantry supplies for baking runs.',
      impact: 'Covers the flour for about 5 loaves of artisan bread.',
    },
    {
      amount: 25,
      title: 'Baking Day Support',
      description: 'Funds the basic ingredients (yeast, butter, salt, sugar) and cooking utilities required for a full baking morning.',
      impact: 'Covers ingredient costs for a dozen custom cinnamon rolls.',
    },
    {
      amount: 50,
      title: 'Equipment Fund Support',
      description: 'Contributes to essential baking accessories like sourdough proofing bannetons, dough scrapers, and sheet pans.',
      impact: 'Buys 2 premium wicker proofing baskets.',
    },
    {
      amount: 100,
      title: 'Oven Fund Support',
      description: 'Directly funds the down payment for our custom stone-deck bread oven to increase our batch capacity.',
      impact: 'Directly purchases brick and mortar materials for the deck.',
    },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Header banner */}
      <div className="bg-brand text-white py-16 sm:py-20 border-b border-sand/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(200,162,168,0.12),transparent_50%)]" aria-hidden="true" />
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white mb-6 uppercase tracking-wider transition-colors">
            <ArrowLeft size={14} /> Back to Homepage
          </Link>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 text-brand-secondary">
            <Flame size={26} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-4">
            The Homestead Oven Fund
          </h1>
          <p className="text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
            Help Cedar & Sage Homestead build capacity with better equipment to feed our local community.
          </p>
        </div>
      </div>

      {/* Main content grid */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Progress Card */}
        <div className="bg-white border border-sand/50 rounded-3xl p-8 md:p-10 shadow-sm mb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-2">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-brand">Oven Fund Progress</span>
              <h2 className="text-3xl font-black text-earth tracking-tight mt-1">
                ${raised.toLocaleString()} <span className="text-muted-earth text-lg font-medium">raised of ${goal.toLocaleString()} goal</span>
              </h2>
            </div>
            <span className="bg-brand/10 text-brand text-sm font-black px-4 py-1.5 rounded-full">
              {percentage}% Complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-5 bg-sand/30 rounded-full overflow-hidden mb-6 border border-sand/10">
            <div 
              className="h-full bg-brand rounded-full transition-all duration-1000 ease-out relative"
              style={{ width: `${percentage}%` }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-pulse" />
            </div>
          </div>

          <p className="text-muted-earth text-sm leading-relaxed">
            Our current home kitchen limits us to baking just two loaves of sourdough at a time. Meeting this goal allows us to install a multi-deck stone baking oven, increasing our capacity to 12 loaves per bake, and bringing sourdough to more families every weekend.
          </p>
        </div>

        {/* Support Tiers Title */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-earth tracking-tight">Select a Support Tier</h2>
          <p className="text-muted-earth text-sm mt-2">Every contribution gets us closer to fresh-baked goods for the whole community.</p>
        </div>

        {/* Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {tiers.map((tier) => (
            <div 
              key={tier.amount} 
              className="bg-warm border border-sand hover:border-brand rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 hover:shadow-md"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-earth">{tier.title}</h3>
                  <span className="bg-brand text-white font-black px-3 py-1 rounded-xl text-lg">
                    ${tier.amount}
                  </span>
                </div>
                <p className="text-muted-earth text-sm leading-relaxed mb-6">
                  {tier.description}
                </p>
              </div>
              <div className="border-t border-sand/40 pt-4 mt-auto">
                <span className="text-[10px] font-black uppercase tracking-wider text-brand block mb-1">
                  Your Impact
                </span>
                <p className="text-earth text-xs font-semibold">
                  {tier.impact}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Contribution Instructions */}
        <div className="bg-white border border-brand/20 rounded-[2.5rem] p-8 md:p-12 text-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-brand" />
          <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto mb-6">
            <Landmark size={24} />
          </div>
          <h3 className="text-2xl font-black text-earth tracking-tight mb-3">
            How to Contribute
          </h3>
          <p className="text-muted-earth text-sm leading-relaxed max-w-xl mx-auto mb-8">
            To keep donation-funded support completely separate from daily shop checkout transactions, we handle contributions manually. You can support the Oven Fund via:
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left max-w-lg mx-auto mb-8">
            <div className="bg-warm border border-sand/60 rounded-2xl p-5">
              <span className="font-bold text-earth text-sm block mb-1">💸 Interac E-Transfer</span>
              <p className="text-xs text-muted-earth leading-relaxed">
                Send your support to <span className="font-semibold text-brand">hello@cedarandsage.ca</span> (please add &quot;Oven Fund&quot; in the notes).
              </p>
            </div>
            <div className="bg-warm border border-sand/60 rounded-2xl p-5">
              <span className="font-bold text-earth text-sm block mb-1">🍞 Cash or Cheque</span>
              <p className="text-xs text-muted-earth leading-relaxed">
                Contributions can also be made in person during your weekly sourdough or cinnamon roll pickup times.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-wider">
            <Heart size={12} className="text-brand animate-pulse" /> Thank you for supporting local bakeries!
          </div>
        </div>
      </div>
    </div>
  );
}
