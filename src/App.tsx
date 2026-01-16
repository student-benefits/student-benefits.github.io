import { useState, useMemo, useEffect, useRef } from 'react';
import { benefits } from './data/benefits';
import BenefitCard from './components/BenefitCard';
import FilterBar from './components/FilterBar';
import { useGitHubStars } from './hooks/useGitHubStars';

const repos = benefits.map(b => b.repo);

function App() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const starsMap = useGitHubStars(repos);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredBenefits = useMemo(() => {
    return benefits
      .filter(benefit => {
        const matchesCategory = activeCategory === 'All' || benefit.category === activeCategory;
        const matchesSearch = benefit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             benefit.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             benefit.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const starsA = a.repo ? (starsMap[a.repo] || 0) : 0;
        const starsB = b.repo ? (starsMap[b.repo] || 0) : 0;
        // Sort by stars first, then by popularity as tiebreaker
        if (starsB !== starsA) return starsB - starsA;
        return b.popularity - a.popularity;
      });
  }, [activeCategory, searchQuery, starsMap]);

  return (
    <div className="min-h-screen w-full py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">

      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 mix-blend-screen animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl -z-10 mix-blend-screen animate-pulse delay-1000"></div>

      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <header className="text-center mb-16 relative">
                    <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">
            Student <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">Benefits Hub</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            A curated collection of exclusive offers, free tools, and resources to power your education.
          </p>

          {/* Search Input */}
          <div className="relative max-w-xl mx-auto mb-10 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search tools, categories, or tags..."
              className="block w-full pl-11 pr-4 py-4 border border-slate-700/50 rounded-2xl leading-5 bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:bg-slate-800 transition-all duration-300 shadow-lg shadow-black/20 backdrop-blur-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <FilterBar activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
        </header>

        {/* Results Info */}
        <div className="mb-6 flex justify-between items-end border-b border-slate-800 pb-4">
          <span className="text-slate-400 font-medium">
            Found <span className="text-white">{filteredBenefits.length}</span> {filteredBenefits.length === 1 ? 'perk' : 'perks'}
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
            >
              <span>Clear search</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Grid Section */}
        {filteredBenefits.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBenefits.map(benefit => (
              <BenefitCard
                key={benefit.id}
                benefit={benefit}
                stars={benefit.repo ? starsMap[benefit.repo] : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-slate-800/30 rounded-3xl border border-dashed border-slate-700">
            <div className="text-6xl mb-6 opacity-50">🔍</div>
            <h2 className="text-2xl font-bold text-white mb-2">No benefits found</h2>
            <p className="text-slate-400">Try adjusting your search terms or selecting a different category.</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-24 pt-10 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-sm">
            Curated with 💜 for students. <a href="https://github.com/agentivo/student-benefits-hub/issues/new?template=new-benefit.yml" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors">Submit a benefit</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
