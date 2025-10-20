# Quick Guide: Merging PR to Publish Version 1.0.1

## ✅ What's Been Done

1. **Version bumped** from 1.0.0 → 1.0.1
2. **Repository URL fixed** in package.json (npm warning resolved)
3. **CHANGELOG.md added** to track version history
4. **Changes pushed** to `feature/test_lib` branch
5. **GitHub Actions ready** to publish on merge to main

## 🚀 Next Steps

### 1. Create Pull Request on GitHub

Go to: https://github.com/Vikaseneco/api-schema-validator/pulls

Click **"New Pull Request"** or **"Compare & pull request"** if available

- **Base branch:** `main`
- **Compare branch:** `feature/test_lib`
- **Title:** `Release v1.0.1 - Add CI/CD pipeline and fix package.json`
- **Description:**
  ```markdown
  ## Changes in v1.0.1
  
  ### Added
  - GitHub Actions CI/CD pipeline for automated publishing
  - PUBLISHING.md guide for Azure Artifacts setup
  - CHANGELOG.md for version tracking
  
  ### Fixed
  - Repository URL format in package.json
  - Added .npmrc to .gitignore for security
  
  This will be automatically published to Azure Artifacts upon merge.
  ```

### 2. Review and Merge PR

1. Review the changes in the PR
2. Ensure all checks pass (build job will run)
3. Click **"Merge pull request"**
4. Choose **"Create a merge commit"** or **"Squash and merge"**
5. Confirm the merge

### 3. Automatic Publishing

Once merged to `main`, the GitHub Actions workflow will:

```
┌─────────────────────────────────────────┐
│  PR Merged to main                       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Build Job (runs automatically)          │
│  ├─ Checkout code                        │
│  ├─ Setup Node.js                        │
│  ├─ Install dependencies                 │
│  └─ Run tests ✓                          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Publish Job (only on main branch)       │
│  ├─ Checkout code                        │
│  ├─ Setup Node.js                        │
│  ├─ Configure Azure authentication       │
│  ├─ Install dependencies                 │
│  └─ npm publish v1.0.1 ✓                │
└─────────────────────────────────────────┘
```

### 4. Verify Publication

After the workflow completes:

1. Go to GitHub Actions: https://github.com/Vikaseneco/api-schema-validator/actions
2. Check that the "Build and Publish to Azure Artifacts" workflow succeeded
3. Verify in Azure Artifacts:
   - URL: https://dev.azure.com/enecomanagedcloud/Myriad%20-%20VPP/_artifacts/feed/vpp-npm-feed
   - Look for: `@eneco/api-schema-validator@1.0.1`

## 📦 What Gets Published

The package will include:
- ✅ All source code (`lib/index.js`)
- ✅ Documentation (README.md, SETUP_GUIDE.md, etc.)
- ✅ Examples (`examples/`)
- ✅ Tests (`test/`)
- ✅ GitHub Actions workflow (`.github/workflows/`)
- ✅ CHANGELOG.md
- ✅ Fixed package.json

## 🔍 Files Changed in This PR

```
Modified:
  - package.json (version: 1.0.0 → 1.0.1, fixed repository URL)
  - package-lock.json (version updated)

Added:
  - CHANGELOG.md
  - .github/workflows/publish.yml
  - PUBLISHING.md
  - .npmrc.example

Updated:
  - .gitignore (added .npmrc)
```

## ⚠️ Important Prerequisites

Before merging, ensure:
- ✅ `AZURE_ARTIFACTS_TOKEN` secret is set in GitHub repository settings
- ✅ PAT token has "Packaging: Read, write, & manage" permissions
- ✅ PAT token hasn't expired

## 🎉 After Merge

Once published, install the new version in other projects:

```bash
npm install @eneco/api-schema-validator@1.0.1
```

Or update existing installation:

```bash
npm update @eneco/api-schema-validator
```

## 🐛 If Something Goes Wrong

### Workflow fails with authentication error
- Check the `AZURE_ARTIFACTS_TOKEN` secret in GitHub Settings → Secrets
- Verify the PAT hasn't expired in Azure DevOps
- Regenerate PAT if needed and update the secret

### Package already exists error
- This shouldn't happen since we bumped to 1.0.1
- If it does, check Azure Artifacts to confirm version doesn't exist
- Bump version again if needed: `npm version patch`

### Build fails
- Check the Actions logs for detailed error messages
- Most likely causes: dependency installation or test failures
- Fix the issue and push another commit to the PR

---

**Ready to merge!** 🚀 Once you merge the PR, version 1.0.1 will be automatically published to Azure Artifacts.
