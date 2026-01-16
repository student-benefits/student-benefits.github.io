export interface Benefit {
  id: string;
  name: string;
  category: string;
  description: string;
  link: string;
  tags: string[];
  popularity: number; // 1-10, higher = more popular
  repo?: string; // GitHub repo for star count (e.g., "microsoft/vscode")
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

export const benefits: Benefit[] = [
  {
    id: "github-student-pack",
    name: "GitHub Student Developer Pack",
    category: "AI & Dev Tools",
    description: "The best free developer tools in one place. Includes Copilot, Canva, Namecheap, and more.",
    link: "https://education.github.com/pack",
    tags: ["Free Tools", "Dev Pack", "Essential"],
    popularity: 10
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    category: "AI & Dev Tools",
    description: "AI pair programmer that helps you write code faster and with less work. Free for students.",
    link: "https://github.com/features/copilot",
    tags: ["AI", "Coding", "GitHub"],
    popularity: 10
  },
  {
    id: "gemini-pro",
    name: "Google Gemini Pro",
    category: "AI & Dev Tools",
    description: "Access Google's advanced AI models through developer programs and student offers.",
    link: "https://ai.google.dev/",
    tags: ["AI", "Google", "LLM"],
    popularity: 8
  },
  {
    id: "jetbrains-ides",
    name: "JetBrains IDEs",
    category: "AI & Dev Tools",
    description: "Free access to all JetBrains professional desktop IDEs (IntelliJ IDEA, PyCharm, WebStorm, etc.).",
    link: "https://www.jetbrains.com/community/education/#students",
    tags: ["IDE", "Programming", "Java", "Python"],
    popularity: 9,
    repo: "JetBrains/intellij-community"
  },
  {
    id: "digitalocean",
    name: "DigitalOcean Credits",
    category: "Cloud & Hosting",
    description: "$200 in credit for new users for 1 year (via GitHub Student Pack).",
    link: "https://www.digitalocean.com/students",
    tags: ["Cloud", "VPS", "Hosting"],
    popularity: 8
  },
  {
    id: "aws-educate",
    name: "AWS Educate",
    category: "Cloud & Hosting",
    description: "Access to free AWS credits, cloud labs, and learning pathways for students.",
    link: "https://aws.amazon.com/education/awseducate/",
    tags: ["AWS", "Cloud", "Learning"],
    popularity: 9
  },
  {
    id: "azure-credits",
    name: "Microsoft Azure $100 Credits",
    category: "Cloud & Hosting",
    description: "Get $100 in free Azure credits plus popular free services for students—no credit card required.",
    link: "https://azure.microsoft.com/en-us/free/students/",
    tags: ["Azure", "Microsoft", "Cloud"],
    popularity: 8
  },
  {
    id: "google-cloud-credits",
    name: "Google Cloud Credits",
    category: "Cloud & Hosting",
    description: "Get free credits for Google Cloud Platform to build and scale your projects.",
    link: "https://cloud.google.com/edu",
    tags: ["GCP", "Google", "Cloud"],
    popularity: 8
  },
  {
    id: "mongodb-atlas",
    name: "MongoDB Atlas Credits",
    category: "Cloud & Hosting",
    description: "$50 in credits and free access to MongoDB University (via GitHub Pack).",
    link: "https://www.mongodb.com/students",
    tags: ["Database", "NoSQL", "Cloud"],
    popularity: 7,
    repo: "mongodb/mongo"
  },
  {
    id: "heroku",
    name: "Heroku Credits",
    category: "Cloud & Hosting",
    description: "$13 per month for 12 months for students to host applications.",
    link: "https://www.heroku.com/github-students",
    tags: ["PaaS", "Hosting", "GitHub"],
    popularity: 6
  },
  {
    id: "vercel",
    name: "Vercel Pro Features",
    category: "Cloud & Hosting",
    description: "Free access to Vercel Pro features for students to deploy high-performance websites.",
    link: "https://vercel.com/docs/accounts/plans/pro/student-benefits",
    tags: ["Frontend", "Deployment", "Next.js"],
    popularity: 9,
    repo: "vercel/next.js"
  },
  {
    id: "netlify",
    name: "Netlify Enhanced Limits",
    category: "Cloud & Hosting",
    description: "Special student tier with increased limits for hosting and CI/CD.",
    link: "https://www.netlify.com/students/",
    tags: ["Hosting", "JAMstack"],
    popularity: 7,
    repo: "netlify/cli"
  },
  {
    id: "railway",
    name: "Railway Student Discount",
    category: "Cloud & Hosting",
    description: "Credits and priority support for students building projects on Railway.",
    link: "https://railway.app/",
    tags: ["Deployment", "PaaS"],
    popularity: 7,
    repo: "railwayapp/cli"
  },
  {
    id: "namecheap",
    name: "Namecheap Free Domain",
    category: "Domains & Security",
    description: "One free .me domain name and SSL certificate for one year.",
    link: "https://nc.me/",
    tags: ["Domain", "SSL", "Security"],
    popularity: 8
  },
  {
    id: "cloudflare",
    name: "Cloudflare Pro",
    category: "Domains & Security",
    description: "Access to Cloudflare Pro features to secure and speed up your applications.",
    link: "https://www.cloudflare.com/students/",
    tags: ["Security", "CDN", "DNS"],
    popularity: 8
  },
  {
    id: "figma",
    name: "Figma Education",
    category: "Design",
    description: "Free access to Figma Professional for students and educators.",
    link: "https://www.figma.com/education/",
    tags: ["Design", "UI/UX", "Collaboration"],
    popularity: 10
  },
  {
    id: "canva",
    name: "Canva for Education",
    category: "Design",
    description: "Free access to Canva's premium features for students (available via GitHub Pack).",
    link: "https://www.canva.com/education/",
    tags: ["Design", "Graphics", "Marketing"],
    popularity: 9
  },
  {
    id: "autodesk",
    name: "Autodesk",
    category: "Design",
    description: "Free access to AutoCAD, Revit, Maya, 3ds Max, and more for students.",
    link: "https://www.autodesk.com/education/free-software/overview",
    tags: ["3D", "CAD", "Engineering"],
    popularity: 8
  },
  {
    id: "notion",
    name: "Notion Education",
    category: "Productivity",
    description: "Free Personal Pro Plan for students—keep all your notes and projects in one place.",
    link: "https://www.notion.so/students",
    tags: ["Notes", "Planning", "Knowledge"],
    popularity: 10
  },
  {
    id: "grammarly",
    name: "Grammarly EDU",
    category: "Productivity",
    description: "Advanced writing assistance for students through institutional or special offers.",
    link: "https://www.grammarly.com/edu",
    tags: ["Writing", "AI", "Grammar"],
    popularity: 8
  },
  {
    id: "microsoft-365",
    name: "Microsoft 365 Education",
    category: "Productivity",
    description: "Free access to Word, Excel, PowerPoint, OneNote, and Microsoft Teams.",
    link: "https://www.microsoft.com/en-us/education/products/office",
    tags: ["Office", "Documents", "Microsoft"],
    popularity: 9
  },
  {
    id: "spotify-student",
    name: "Spotify Premium Student",
    category: "Lifestyle",
    description: "Premium music at a discounted rate, often bundled with Hulu and SHOWTIME.",
    link: "https://www.spotify.com/us/student/",
    tags: ["Music", "Streaming", "Entertainment"],
    popularity: 10
  },
  {
    id: "amazon-prime-student",
    name: "Amazon Prime Student",
    category: "Lifestyle",
    description: "6-month trial followed by 50% off Prime subscription for students.",
    link: "https://www.amazon.com/student",
    tags: ["Shopping", "Shipping", "Movies"],
    popularity: 10
  },
  {
    id: "unidays",
    name: "UNiDAYS",
    category: "Lifestyle",
    description: "Access hundreds of student discounts on fashion, tech, and food.",
    link: "https://www.myunidays.com/",
    tags: ["Discounts", "Shopping"],
    popularity: 8
  },
  {
    id: "apple-education",
    name: "Apple Education Pricing",
    category: "Lifestyle",
    description: "Save on a new Mac or iPad with Apple education pricing. Available to current and newly accepted college students.",
    link: "https://www.apple.com/us-edu/store",
    tags: ["Hardware", "Apple", "MacBook"],
    popularity: 9
  },
  {
    id: "linkedin-learning",
    name: "LinkedIn Learning",
    category: "Learning",
    description: "Access thousands of expert-led courses to develop your professional skills.",
    link: "https://learning.linkedin.com/",
    tags: ["Courses", "Professional", "Skills"],
    popularity: 8
  },
  {
    id: "coursera",
    name: "Coursera Financial Aid",
    category: "Learning",
    description: "Free or discounted certificates for thousands of courses via student programs.",
    link: "https://www.coursera.org/for-university-and-college-students",
    tags: ["Online Courses", "Certificates"],
    popularity: 9
  },
  {
    id: "perplexity",
    name: "Perplexity Pro Student",
    category: "AI & Dev Tools",
    description: "Enhanced AI search capabilities with special student offers.",
    link: "https://www.perplexity.ai/pro",
    tags: ["AI", "Search", "Research"],
    popularity: 8
  },
  {
    id: "cursor-pro",
    name: "Cursor Pro",
    category: "AI & Dev Tools",
    description: "AI-powered code editor with student discounts available for the Pro plan.",
    link: "https://cursor.com/",
    tags: ["AI", "Editor", "IDE"],
    popularity: 9,
    repo: "getcursor/cursor"
  },
  {
    id: "arc-browser",
    name: "Arc Browser",
    category: "Productivity",
    description: "The browser that thinks with you. Special perks for students and educators.",
    link: "https://arc.net/",
    tags: ["Browser", "UI"],
    popularity: 7
  },
  {
    id: "obsidian",
    name: "Obsidian for Students",
    category: "Productivity",
    description: "Powerful knowledge base that works on top of a local folder of plain text Markdown files.",
    link: "https://obsidian.md/",
    tags: ["Notes", "Markdown", "PKM"],
    popularity: 9,
    repo: "obsidianmd/obsidian-releases"
  },
  {
    id: "linear",
    name: "Linear Student Plan",
    category: "Productivity",
    description: "The issue tracker for high-performance teams. Free for students and teachers.",
    link: "https://linear.app/education",
    tags: ["Project Management", "Agile"],
    popularity: 8,
    repo: "linear/linear"
  }
];
