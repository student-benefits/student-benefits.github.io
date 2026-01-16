import { categories } from '../data/benefits';

interface FilterBarProps {
  activeCategory: string;
  setActiveCategory: (category: string) => void;
}

function FilterBar({ activeCategory, setActiveCategory }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-4xl mx-auto">
      {categories.map(category => (
        <button
          key={category}
          onClick={() => setActiveCategory(category)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
            activeCategory === category
              ? 'bg-white text-indigo-900 border-white shadow-lg shadow-white/10 scale-105'
              : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white hover:border-slate-600'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};

export default FilterBar;