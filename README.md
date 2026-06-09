# Student Benefits Hub

**Grant — a production AI agent powered by Claude — curates a public directory of student discounts.**

Grant discovers new programs each week, validates community submissions opened as issues, and audits link health. Humans approve every merge — the merge is the trust boundary. Run logs and tool traces are open. **[→ student-benefits.github.io](https://student-benefits.github.io)**

[![Live](https://img.shields.io/badge/live-student--benefits.github.io-blue)](https://student-benefits.github.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

---

## How it works

Content enters through multiple paths: humans submit issues and Grant validates them, while scheduled workflows discover new programs and events, audit link health, and scout Reddit on their own. Whatever the path, Grant opens a PR — a human reviews and merges. Grant cannot publish directly. The merge is the trust boundary. The full roster of workflows (triggers and what each does) is the table in [`CLAUDE.md`](CLAUDE.md#automated-workflows) — the canonical source.

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
