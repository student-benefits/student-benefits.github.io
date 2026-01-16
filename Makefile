.PHONY: help install dev build preview lint clean deploy setup-github setup-reddit discover test-issue runs stats
.DEFAULT_GOAL := help

# ─────────────────────────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────────────────────────

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

preview: build
	npm run preview

lint:
	npm run lint

clean:
	rm -rf dist node_modules/.vite

# ─────────────────────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────────────────────

setup-github:
	python3 scripts/setup-github-app.py

setup-reddit:
	python3 scripts/setup-reddit-app.py

# ─────────────────────────────────────────────────────────────────────────────
# Workflows
# ─────────────────────────────────────────────────────────────────────────────

deploy:
	git push origin main

discover:
	gh workflow run discover-benefits.yml
	@echo "Workflow triggered. View at: https://github.com/agentivo/student-benefits-hub/actions"

test-issue:
	@read -p "Benefit to test (e.g., 'Notion free for students'): " benefit; \
	gh issue create --title "[Benefit]: $$benefit" --body "### Describe the benefit\n\n$$benefit" --label new-benefit

runs:
	gh run list --limit 5

stats:
	@echo "Benefits: $$(grep -c 'id:' src/data/benefits.ts)"
	@echo "Categories: $$(grep -c 'category:' src/data/benefits.ts | head -1)"

# ─────────────────────────────────────────────────────────────────────────────
# Help
# ─────────────────────────────────────────────────────────────────────────────

help:
	@echo "Development:"
	@echo "  make install       Install dependencies"
	@echo "  make dev           Start dev server"
	@echo "  make build         Build for production"
	@echo "  make preview       Preview production build"
	@echo "  make lint          Run linter"
	@echo "  make clean         Remove build artifacts"
	@echo ""
	@echo "Setup:"
	@echo "  make setup-github  Configure GitHub App for Models API"
	@echo "  make setup-reddit  Configure Reddit API for discovery"
	@echo ""
	@echo "Workflows:"
	@echo "  make deploy        Push to main (triggers GitHub Pages deploy)"
	@echo "  make discover      Trigger Reddit scraping workflow"
	@echo "  make test-issue    Create test issue to trigger add-benefit workflow"
	@echo "  make runs          View recent workflow runs"
	@echo "  make stats         Show benefits count"
