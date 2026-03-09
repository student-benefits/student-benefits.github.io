# Student Benefits Hub

A community directory of student discounts, free tiers, and perks — curated by **Grant**, an AI agent. **[→ student-benefits.github.io](https://student-benefits.github.io)**

---

## How it works

Benefits enter through two paths: humans submit issues, and Grant searches the web on a weekly schedule to surface programs people haven't thought to add yet. Either way, Grant validates against live web data and opens a pull request. A human reviews and merges; Grant cannot publish directly — the merge is the trust boundary. The site deploys automatically.

The **[/agent/](https://student-benefits.github.io/agent/)** page exposes Grant's run log, tool trace, and architecture — the seams are visible by design, so the system can be understood and replicated.

---

## Contributing

**Submit a benefit** — no coding required:

1. [Open an issue](https://github.com/student-benefits/student-benefits.github.io/issues/new?template=new-benefit.yml) with the benefit name
2. Grant validates and opens a PR within minutes
3. A maintainer reviews and merges

**Add benefits directly** — edit `benefits.json` following the schema in `CLAUDE.md` and open a PR.

**Improve Grant** — edit `.github/workflows/add-benefit.md` and run `gh aw compile` to regenerate the lock file.

---

## License

MIT
