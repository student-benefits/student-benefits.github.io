#!/usr/bin/env node
/**
 * Creates a GitHub App programmatically using the manifest flow
 * Usage: node scripts/setup-github-app.js
 */

const http = require('http');
const { execSync } = require('child_process');

const REPO = 'agentivo/student-benefits-hub';
const APP_NAME = 'student-benefits-hub-bot';
const HOMEPAGE = 'https://agentivo.github.io/student-benefits-hub/';
const PORT = 3456;

const manifest = {
  name: APP_NAME,
  url: HOMEPAGE,
  hook_attributes: { active: false },
  public: false,
  default_permissions: {
    contents: 'write',
    issues: 'write',
    pull_requests: 'write',
    models: 'read'
  },
  default_events: []
};

async function main() {
  console.log('Creating GitHub App:', APP_NAME);
  console.log('');

  // Start local server to catch the redirect
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get('code');

    if (!code) {
      res.writeHead(400);
      res.end('Missing code parameter');
      return;
    }

    console.log('Received code, exchanging for credentials...');

    // Exchange code for app credentials
    try {
      const response = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'StudentBenefitsHub'
        }
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const app = await response.json();

      console.log('');
      console.log('GitHub App created successfully!');
      console.log('');
      console.log('App ID:', app.id);
      console.log('App Name:', app.name);
      console.log('');

      // Save credentials
      console.log('Adding secrets to repository...');

      try {
        execSync(`echo "${app.id}" | gh secret set APP_ID`, { stdio: 'inherit' });
        execSync(`echo '${app.pem.replace(/'/g, "'\\''")}' | gh secret set APP_PRIVATE_KEY`, { stdio: 'inherit' });
        console.log('');
        console.log('Secrets added successfully!');
      } catch (e) {
        console.log('');
        console.log('Could not add secrets automatically. Add them manually:');
        console.log('');
        console.log('APP_ID:', app.id);
        console.log('');
        console.log('APP_PRIVATE_KEY:');
        console.log(app.pem);
      }

      // Install the app
      console.log('');
      console.log('Now install the app on your repository:');
      console.log(`https://github.com/settings/apps/${app.slug}/installations`);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>GitHub App Created!</h1>
            <p>App ID: <strong>${app.id}</strong></p>
            <p>Secrets have been added to the repository.</p>
            <p><a href="https://github.com/settings/apps/${app.slug}/installations">Install the app</a></p>
            <p>You can close this window.</p>
          </body>
        </html>
      `);

      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);

    } catch (e) {
      console.error('Error:', e.message);
      res.writeHead(500);
      res.end('Error creating app: ' + e.message);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT, () => {
    const redirectUri = `http://localhost:${PORT}`;
    const manifestEncoded = encodeURIComponent(JSON.stringify({
      ...manifest,
      redirect_url: redirectUri
    }));

    const url = `https://github.com/settings/apps/new?manifest=${manifestEncoded}`;

    console.log('Opening browser to create the app...');
    console.log('');
    console.log('Click "Create GitHub App" in the browser.');
    console.log('');

    // Open browser
    const openCmd = process.platform === 'darwin' ? 'open' :
                    process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
      execSync(`${openCmd} "${url}"`);
    } catch {
      console.log('Could not open browser. Please visit:');
      console.log(url);
    }
  });
}

main().catch(console.error);
