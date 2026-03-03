.DEFAULT_GOAL := help

.PHONY: help deploy purge-runs review

help:
	@echo ""
	@echo "\033[2mWorkflows\033[0m"
	@echo "  \033[36mdeploy\033[0m       Trigger deploy workflow"
	@echo "  \033[36mreview\033[0m       Run Claude review on a PR: make review PR=<number>"
	@echo ""
	@echo "\033[2mMaintenance\033[0m"
	@echo "  \033[36mpurge-runs\033[0m   Delete all completed workflow run history"
	@echo ""

deploy: purge-runs
	gh workflow run deploy.yml

review:
	@[ -n "$(PR)" ] || { echo "Usage: make review PR=<number>"; exit 1; }
	gh workflow run claude-review.yml -f pr_number=$(PR)

purge-runs:
	@gh run list --limit 100 --json databaseId,status \
		--jq '.[] | select(.status != "in_progress") | .databaseId' | \
		while read -r id; do \
			gh run delete $$id; \
		done
