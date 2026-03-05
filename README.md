# Student Benefits Hub

[![Deploy](https://github.com/student-benefits/student-benefits.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/student-benefits/student-benefits.github.io/actions/workflows/deploy.yml)

A community directory of student discounts, free tiers, and perks — curated by **Grant**, an AI agent. **[→ student-benefits.github.io](https://student-benefits.github.io)**

---

## How it works

Submissions come in as GitHub Issues. Grant — an AI agent running on Claude Sonnet 4 — picks them up, validates them against live web data, and opens a pull request if the benefit checks out. A human reviews and merges. The site deploys automatically.

The **[/agent/](https://student-benefits.github.io/agent/)** page exposes Grant's run log, tool trace, and architecture.

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
