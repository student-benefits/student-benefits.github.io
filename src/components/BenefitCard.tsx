import { useState } from 'react';
import type { Benefit } from '../data/benefits';

interface BenefitCardProps {
  benefit: Benefit;
  stars?: number;
}

function formatStars(stars: number): string {
  if (stars >= 1000) {
    return (stars / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return stars.toString();
}

function BenefitCard({ benefit, stars }: BenefitCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group relative flex flex-col h-full bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="p-6 flex-grow relative z-10">
        <div className="flex justify-between items-start mb-4">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-700/50 text-indigo-300 border border-slate-600/50">
            {benefit.category}
          </span>
          {stars !== undefined && benefit.repo && (
            <a
              href={`https://github.com/${benefit.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-yellow-400 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {formatStars(stars)}
            </a>
          )}
        </div>

        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-indigo-200 transition-colors">
          {benefit.name}
        </h3>

        <p
          className={`text-slate-400 text-sm mb-2 leading-relaxed cursor-pointer ${expanded ? '' : 'line-clamp-3'}`}
          onClick={() => setExpanded(!expanded)}
        >
          {benefit.description}
        </p>
        {benefit.description.length > 120 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-400 hover:text-indigo-300 mb-4"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        <div className="flex flex-wrap gap-2 mt-auto">
          {benefit.tags.map(tag => (
            <span key={tag} className="text-xs text-slate-500 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/50">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="p-4 bg-slate-900/30 border-t border-slate-700/50 relative z-10">
        <a
          href={benefit.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all duration-200 group-hover:shadow-lg group-hover:shadow-indigo-500/20"
        >
          <span>Get Deal</span>
          <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
    </div>
  );
};

export default BenefitCard;
