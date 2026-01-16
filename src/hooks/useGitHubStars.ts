import { useState, useEffect } from 'react';

const CACHE_KEY = 'github-stars-cache';
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

type StarsCache = Record<string, { stars: number; ts: number }>;

function getStarsCache(): StarsCache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function useGitHubStars(repos: (string | undefined)[]) {
  const [starsMap, setStarsMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const cache = getStarsCache();
    const reposToFetch: string[] = [];
    const initialStars: Record<string, number> = {};

    repos.forEach(repo => {
      if (!repo) return;
      const cached = cache[repo];
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        initialStars[repo] = cached.stars;
      } else {
        reposToFetch.push(repo);
      }
    });

    setStarsMap(initialStars);

    reposToFetch.forEach(repo => {
      fetch(`https://api.github.com/repos/${repo}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.stargazers_count) {
            const stars = data.stargazers_count;
            setStarsMap(prev => ({ ...prev, [repo]: stars }));
            const newCache = getStarsCache();
            newCache[repo] = { stars, ts: Date.now() };
            localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
          }
        })
        .catch(err => {
          console.warn(`Failed to fetch GitHub stars for ${repo}:`, err.message);
        });
    });
  }, [repos]);

  return starsMap;
}
