import { useState, useEffect } from 'react';
import type { Benefit } from '../data/benefits';

interface BenefitCardProps {
  benefit: Benefit;
}

const CACHE_KEY = 'github-stars-cache';
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getStarsCache(): Record<string, { stars: number; ts: number }> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setStarsCache(repo: string, stars: number) {
  const cache = getStarsCache();
  cache[repo] = { stars, ts: Date.now() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function formatStars(stars: number): string {
  if (stars >= 1000) {
    return (stars / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return stars.toString();
}

const BenefitCard = ({ benefit }: BenefitCardProps) => {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    if (!benefit.repo) return;

    const cache = getStarsCache();
    const cached = cache[benefit.repo];

    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setStars(cached.stars);
      return;
    }

    fetch(`https://api.github.com/repos/${benefit.repo}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.stargazers_count) {
          setStars(data.stargazers_count);
          setStarsCache(benefit.repo!, data.stargazers_count);
        }
      })
      .catch(() => {});
  }, [benefit.repo]);

  return (
    <div className="group relative flex flex-col h-full bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 overflow-hidden">

      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="p-6 flex-grow relative z-10">
        <div className="flex justify-between items-start mb-4">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-700/50 text-indigo-300 border border-slate-600/50">
            {benefit.category}
          </span>
          {stars !== null && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {formatStars(stars)}
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-indigo-200 transition-colors">
          {benefit.name}
        </h3>

        <p className="text-slate-400 text-sm mb-6 leading-relaxed line-clamp-3">
          {benefit.description}
        </p>

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
