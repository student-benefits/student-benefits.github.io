# Student Benefits Hub

**100+ free and discounted dev tools, cloud credits, AI platforms, and design software for students — everything that helps you build, learn, and ship. No streaming, no shopping coupons.**

**[→ student-benefits.github.io](https://student-benefits.github.io)** · every benefit is also plain JSON at [`data/benefits.json`](data/benefits.json), MIT-licensed and free to reuse.

A program earns an entry only if it advances building, learning, shipping, or research. That bar is the whole product: a genuine, well-priced music subscription is still a reject.

The directory is kept current by **Grant** — a set of GitHub Actions workflows running Claude and a deterministic validation gate. It discovers new programs twice a month, validates community submissions opened as issues, and audits link health weekly. Grant merges its own PRs; no change merges unless `scripts/validate_data.py` passes, and that gate is the only check. Run logs and tool traces are open at [/agent/](https://student-benefits.github.io/agent/).

[![Live](https://img.shields.io/badge/live-student--benefits.github.io-blue)](https://student-benefits.github.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

---

## How it works

Content enters through multiple paths: humans submit issues and Grant validates them, while scheduled workflows discover new programs and events and audit link health on their own. Whatever the path, Grant opens a PR, runs the gate until it passes, and merges; the change is live on merge. A submission that fails twice is labeled `needs-manual-review` for the maintainer. The full roster of workflows (triggers and what each does) is the table in [`AGENTS.md`](AGENTS.md#automated-workflows) — the canonical source.

The **[/agent/](https://student-benefits.github.io/agent/)** page shows the loop, every workflow with its live run status, the PR and gate ledger read from the GitHub API, and the last real run trace — so the system can be checked, not just described.

---

## Contributing

**Submit a benefit** — no coding required:

1. [Open an issue](https://github.com/student-benefits/student-benefits.github.io/issues/new?template=new-benefit.yml) with the benefit name
2. Grant validates it, opens a PR, and merges it once the gate passes, usually within minutes

**Add benefits directly** — edit `data/benefits.json` following the schema in `AGENTS.md` and open a PR.

**Improve Grant** — edit a workflow's `prompt:` in `.github/workflows/*.yml` directly. No compile step.

---

## License

MIT — see [LICENSE](LICENSE).
