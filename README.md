# Student Benefits Hub

A student discounts directory where Grant, an AI agent, searches the web each week for new benefits. **[→ student-benefits.github.io](https://student-benefits.github.io)**

---

## How it works

Content enters through multiple paths. Humans submit issues; Grant validates and opens a PR. A separate discover-benefits workflow searches the web weekly and opens issues for new programs. A discover-events workflow finds upcoming student events and creates PRs, removing expired entries automatically. A human reviews and merges. Grant cannot publish directly. The merge is the trust boundary.

The **[/agent/](https://student-benefits.github.io/agent/)** page exposes Grant's run log, tool trace, and architecture so the system can be understood and replicated.

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
