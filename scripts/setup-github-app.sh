#!/bin/bash
# Creates a GitHub App for GitHub Models access
# Usage: ./scripts/setup-github-app.sh

set -e

APP_NAME="student-benefits-hub-bot"
REPO="agentivo/student-benefits-hub"

echo "Creating GitHub App: $APP_NAME"
echo ""

# Create the app manifest
MANIFEST=$(cat <<EOF
{
  "name": "$APP_NAME",
  "url": "https://github.com/$REPO",
  "hook_attributes": {
    "active": false
  },
  "public": false,
  "default_permissions": {
    "contents": "write",
    "issues": "write",
    "pull_requests": "write",
    "models": "read"
  },
  "default_events": []
}
EOF
)

echo "Step 1: Create the GitHub App"
echo "=============================="
echo ""
echo "Go to: https://github.com/settings/apps/new"
echo ""
echo "Fill in:"
echo "  - GitHub App name: $APP_NAME"
echo "  - Homepage URL: https://github.com/$REPO"
echo "  - Uncheck 'Active' under Webhook"
echo ""
echo "Permissions needed:"
echo "  - Repository permissions:"
echo "    - Contents: Read and write"
echo "    - Issues: Read and write"
echo "    - Pull requests: Read and write"
echo "    - Models: Read"
echo ""
echo "  - Where can this GitHub App be installed?"
echo "    - Only on this account"
echo ""
echo "Click 'Create GitHub App'"
echo ""
read -p "Press Enter after creating the app..."

echo ""
echo "Step 2: Generate a Private Key"
echo "==============================="
echo ""
echo "On the app settings page, scroll to 'Private keys'"
echo "Click 'Generate a private key'"
echo "Save the .pem file"
echo ""
read -p "Press Enter after downloading the private key..."

echo ""
echo "Step 3: Install the App"
echo "========================"
echo ""
echo "Go to: https://github.com/settings/apps/$APP_NAME/installations"
echo "Click 'Install' and select the repository: $REPO"
echo ""
read -p "Press Enter after installing..."

echo ""
echo "Step 4: Add Secrets to Repository"
echo "==================================="
echo ""
echo "You need to add these secrets to $REPO:"
echo ""
echo "1. APP_ID - Found on your app's settings page"
echo "2. APP_PRIVATE_KEY - Contents of the .pem file"
echo ""

read -p "Enter your App ID: " APP_ID

echo ""
echo "Now paste your private key (the entire contents of the .pem file)."
echo "When done, press Ctrl+D on a new line:"
echo ""
PRIVATE_KEY=$(cat)

echo ""
echo "Adding secrets to repository..."

echo "$APP_ID" | gh secret set APP_ID
echo "$PRIVATE_KEY" | gh secret set APP_PRIVATE_KEY

echo ""
echo "Done! Secrets added."
echo ""
echo "The workflows will now use the GitHub App for authentication."
