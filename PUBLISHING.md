# Publishing to Azure Artifacts - Setup Guide

This guide explains how to set up and publish the `bruno-api-schema-validator` package to Azure Artifacts.

## 🔧 Prerequisites

- Node.js 14+ installed
- Access to Azure DevOps organization: `enecomanagedcloud`
- Access to the `vpp-npm-feed` Azure Artifacts feed

## 📦 Azure Artifacts Feed

**Feed URL:** https://dev.azure.com/enecomanagedcloud/Myriad%20-%20VPP/_artifacts/feed/vpp-npm-feed

**Registry URL:** https://pkgs.dev.azure.com/enecomanagedcloud/a7ef9a24-213c-4c4c-85f4-c20a7db60c43/_packaging/vpp-npm-feed/npm/registry/

## 🚀 Local Publishing Setup

### Step 1: Install vsts-npm-auth

```bash
npm install -g vsts-npm-auth
```

### Step 2: Create .npmrc (Already Created)

The `.npmrc` file is already included in this project with the correct registry configuration:

```
registry=https://pkgs.dev.azure.com/enecomanagedcloud/a7ef9a24-213c-4c4c-85f4-c20a7db60c43/_packaging/vpp-npm-feed/npm/registry/
always-auth=true
```

### Step 3: Authenticate with Azure Artifacts

Run this command in the project directory:

```bash
vsts-npm-auth -config .npmrc
```

This will open a browser window for authentication and add your token to the `.npmrc` file.

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Run Tests (Optional)

```bash
npm test
```

### Step 6: Publish to Azure Artifacts

```bash
npm publish
```

## 🤖 GitHub Actions Pipeline

The project includes a GitHub Actions workflow (`.github/workflows/publish.yml`) that automatically:
- Builds the package on every push and pull request
- Runs tests
- Publishes to Azure Artifacts when code is pushed to the `main` branch

### Setting up GitHub Secrets

You need to add the following secret to your GitHub repository:

1. Go to your GitHub repository: https://github.com/Vikaseneco/api-schema-validator
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secret:

**Name:** `AZURE_ARTIFACTS_TOKEN`

**Value:** Your Azure DevOps Personal Access Token (PAT)

#### Creating an Azure DevOps PAT:

1. Go to https://dev.azure.com/enecomanagedcloud
2. Click on **User Settings** (icon in top right) → **Personal Access Tokens**
3. Click **New Token**
4. Configure:
   - **Name:** GitHub Actions - api-schema-validator
   - **Organization:** enecomanagedcloud
   - **Scopes:** Select **Packaging** → **Read, write, & manage**
5. Click **Create**
6. **Copy the token** (you won't be able to see it again!)
7. Add this token as the `AZURE_ARTIFACTS_TOKEN` secret in GitHub

### Pipeline Workflow

```
┌─────────────────────────────────────────────────────────┐
│  Push to main branch                                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Build Job                                               │
│  ├─ Checkout code                                        │
│  ├─ Setup Node.js 18                                     │
│  ├─ Install dependencies                                 │
│  └─ Run tests                                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Publish Job (only on main branch)                       │
│  ├─ Checkout code                                        │
│  ├─ Setup Node.js 18                                     │
│  ├─ Configure npm authentication                         │
│  ├─ Install dependencies                                 │
│  └─ Publish to Azure Artifacts                           │
└─────────────────────────────────────────────────────────┘
```

## 📝 Version Management

Before publishing, update the version in `package.json`:

```bash
# Patch version (1.0.0 → 1.0.1)
npm version patch

# Minor version (1.0.0 → 1.1.0)
npm version minor

# Major version (1.0.0 → 2.0.0)
npm version major
```

Then commit and push:

```bash
git add package.json
git commit -m "Bump version to x.x.x"
git push origin main
```

The GitHub Actions pipeline will automatically publish the new version.

## 🔍 Verifying Publication

After publishing, you can verify the package at:

https://dev.azure.com/enecomanagedcloud/Myriad%20-%20VPP/_artifacts/feed/vpp-npm-feed/npm/bruno-api-schema-validator

## 📥 Installing from Azure Artifacts

In other projects, to install this package:

1. Create a `.npmrc` file in your project:
   ```
   registry=https://pkgs.dev.azure.com/enecomanagedcloud/a7ef9a24-213c-4c4c-85f4-c20a7db60c43/_packaging/vpp-npm-feed/npm/registry/
   always-auth=true
   ```

2. Authenticate:
   ```bash
   vsts-npm-auth -config .npmrc
   ```

3. Install the package:
   ```bash
   npm install bruno-api-schema-validator
   ```

## 🛠️ Troubleshooting

### "Unable to authenticate" error

- Make sure you've run `vsts-npm-auth -config .npmrc`
- Check that your Azure DevOps account has access to the feed
- Verify your PAT hasn't expired

### "Package already exists" error

- You're trying to publish a version that already exists
- Update the version in `package.json` before publishing

### GitHub Actions fails with authentication error

- Verify the `AZURE_ARTIFACTS_TOKEN` secret is set correctly in GitHub
- Check that the PAT has the correct permissions (Packaging: Read, write, & manage)
- Ensure the PAT hasn't expired

## 📞 Support

For issues with:
- **Package functionality:** Create an issue on GitHub
- **Azure Artifacts access:** Contact your Azure DevOps administrator
- **Publishing issues:** Check the troubleshooting section above

---

**Happy Publishing! 🎉**

