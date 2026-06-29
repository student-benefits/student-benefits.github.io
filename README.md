# Student Benefits Hub

**Grant — an agentic system powered by Claude — curates a directory of student benefits that help you build, learn, and ship.**

Grant is a set of workflows, a deterministic validation gate, and a human who merges — not one autonomous agent. It discovers new programs each week, validates community submissions opened as issues, and audits link health. Every change is checked by the gate and approved by a person before it goes live — the merge is the trust boundary. Run logs and tool traces are open. **[→ student-benefits.github.io](https://student-benefits.github.io)**

[![Live](https://img.shields.io/badge/live-student--benefits.github.io-blue)](https://student-benefits.github.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

---

## How it works

Content enters through multiple paths: humans submit issues and Grant validates them, while scheduled workflows discover new programs and events, audit link health, and scout Reddit on their own. Whatever the path, Grant opens a PR; a human reviews and merges. The full roster of workflows (triggers and what each does) is the table in [`CLAUDE.md`](CLAUDE.md#automated-workflows) — the canonical source.

The **[/agent/](https://student-benefits.github.io/agent/)** page exposes Grant's run log, tool trace, and architecture so the system can be understood and replicated.

---

## Contributing

**Submit a benefit** — no coding required:

1. [Open an issue](https://github.com/student-benefits/student-benefits.github.io/issues/new?template=new-benefit.yml) with the benefit name
2. Grant validates and opens a PR within minutes
3. A maintainer reviews and merges

**Add benefits directly** — edit `data/benefits.json` following the schema in `CLAUDE.md` and open a PR.

**Improve Grant** — edit a workflow's `prompt:` in `.github/workflows/*.yml` directly. No compile step.

---

## License

MIT — see [LICENSE](LICENSE).
