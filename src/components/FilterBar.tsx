import { categories } from '../data/benefits';

interface FilterBarProps {
  activeCategory: string;
  setActiveCategory: (category: string) => void;
}

function FilterBar({ activeCategory, setActiveCategory }: FilterBarProps) {
  return (
    <div role="tablist" aria-label="Filter by category" className="flex flex-wrap gap-2 justify-center max-w-4xl mx-auto">
      {categories.map(category => (
        <button
          key={category}
          role="tab"
          aria-selected={activeCategory === category}
          onClick={() => setActiveCategory(category)}
          className={`px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors border ${
            activeCategory === category
              ? 'bg-white text-slate-900 border-white shadow-lg shadow-black/20'
              : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white hover:border-slate-600'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

export default FilterBar;
