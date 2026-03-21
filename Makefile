.DEFAULT_GOAL := deploy

.PHONY: help deploy purge-runs purge-deployments review

help:
	@echo ""
	@echo "\033[2mWorkflows\033[0m"
	@echo "  \033[36mdeploy\033[0m       Trigger deploy workflow"
	@echo "  \033[36mreview\033[0m       Run Claude review on a PR: make review PR=<number>"
	@echo ""
	@echo "\033[2mMaintenance\033[0m"
	@echo "  \033[36mpurge-runs\033[0m         Delete all completed workflow run history"
	@echo "  \033[36mpurge-deployments\033[0m  Delete all deployment history"
	@echo ""

deploy: purge-runs purge-deployments
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

purge-deployments:
	@REPO=$$(gh repo view --json nameWithOwner -q .nameWithOwner); \
		gh api "/repos/$$REPO/deployments" --paginate -q '.[].id' | \
		while read -r id; do \
			gh api -X POST "/repos/$$REPO/deployments/$$id/statuses" -f state=inactive --silent; \
			gh api -X DELETE "/repos/$$REPO/deployments/$$id" --silent && echo "Deleted deployment $$id"; \
		done
