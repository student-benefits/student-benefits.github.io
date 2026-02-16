import benefitsData from './benefits.json';

export interface Benefit {
  id: string;
  name: string;
  category: string;
  description: string;
  link: string;
  tags: string[];
  popularity: number;
  repo?: string;
}

export const categories = [
  "All",
  "AI & Dev Tools",
  "Cloud & Hosting",
  "Learning",
  "Design",
  "Productivity",
  "Lifestyle",
  "Domains & Security",
  "Other"
];

export const benefits: Benefit[] = benefitsData;
