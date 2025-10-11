# GitHub Setup Guide

This guide will help you push your ITS Business Core project to GitHub.

---

## 📋 Prerequisites

1. GitHub account (create one at https://github.com if needed)
2. Git installed on your machine (check with `git --version`)
3. GitHub Desktop (optional, easier for Windows users)

---

## 🚀 Quick Setup (Recommended for Windows Users)

### Option A: Using GitHub Desktop (Easiest)

1. **Download GitHub Desktop**
   - Visit https://desktop.github.com/
   - Install and sign in with your GitHub account

2. **Add Repository**
   - Open GitHub Desktop
   - Click `File` → `Add Local Repository`
   - Browse to `C:\VSCodeProjects\its-business-core`
   - Click `Add Repository`

3. **Create Repository on GitHub**
   - Click `Publish repository` button
   - Name: `its-business-core`
   - Description: `ITS Business Core - Lightweight SMB Management System`
   - **Important**: Uncheck "Keep this code private" only if you want it public
   - Click `Publish repository`

4. **Done!** Your code is now on GitHub

5. **Future Updates**
   - Make changes to your code
   - Open GitHub Desktop
   - Review changes in the "Changes" tab
   - Add a commit message (e.g., "Fixed budget dashboard")
   - Click `Commit to main`
   - Click `Push origin` to upload to GitHub

---

## 🔧 Option B: Using Command Line (Git Bash)

### Step 1: Initialize Git Repository

```bash
cd its-business-core
git init
```

### Step 2: Create Repository on GitHub

1. Go to https://github.com
2. Click the `+` icon → `New repository`
3. Repository name: `its-business-core`
4. Description: `ITS Business Core - Lightweight SMB Management System`
5. Choose **Private** or **Public**
6. **Do NOT initialize** with README, .gitignore, or license
7. Click `Create repository`

### Step 3: Add Files and Commit

```bash
# Add all files (respecting .gitignore)
git add .

# Commit with message
git commit -m "Initial commit: ITS Business Core v1.0"
```

### Step 4: Link to GitHub and Push

Replace `YOUR_USERNAME` with your GitHub username:

```bash
# Link to GitHub
git remote add origin https://github.com/YOUR_USERNAME/its-business-core.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

### Step 5: Enter Credentials

- Username: Your GitHub username
- Password: **Use a Personal Access Token** (not your GitHub password)
  - Generate token at: https://github.com/settings/tokens
  - Click `Generate new token (classic)`
  - Select scopes: `repo` (full control)
  - Copy the token and use it as your password

---

## 🔐 Setting Up Personal Access Token (PAT)

If you're using command line, you'll need a PAT:

1. Go to https://github.com/settings/tokens
2. Click `Generate new token (classic)`
3. Give it a name: `ITS Business Core Development`
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click `Generate token`
6. **COPY THE TOKEN** (you won't see it again!)
7. Use this token as your password when pushing

---

## 📁 ITSCoreDocker Setup (Separate Repository)

You can either:

### Option 1: Keep in Same Repo (Recommended)
- ITSCoreDocker is already included in your project
- It will be pushed automatically with everything else

### Option 2: Separate Repository
If you want ITSCoreDocker as a separate repo:

```bash
cd C:\VSCodeProjects\ITSCoreDocker
git init
git add .
git commit -m "Initial commit: ITS Business Core Docker deployment"
git remote add origin https://github.com/YOUR_USERNAME/its-business-core-docker.git
git branch -M main
git push -u origin main
```

---

## ✅ Verify Upload

1. Go to https://github.com/YOUR_USERNAME/its-business-core
2. You should see all your files
3. Check that these files are **NOT** uploaded (in .gitignore):
   - ❌ `node_modules/`
   - ❌ `.next/`
   - ❌ `.env`
   - ❌ `*.db` files
   - ❌ `/uploads/`

---

## 🔄 Daily Workflow

### After Making Changes

**Using GitHub Desktop:**
1. Open GitHub Desktop
2. Review changes
3. Write commit message
4. Click `Commit to main`
5. Click `Push origin`

**Using Command Line:**
```bash
cd its-business-core

# Check what changed
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Added expense tracking feature"

# Push to GitHub
git push
```

---

## 🐛 Common Issues

### Issue: "Permission denied (publickey)"
**Solution:** Use HTTPS URL instead of SSH:
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/its-business-core.git
```

### Issue: "Authentication failed"
**Solution:** Use a Personal Access Token instead of password

### Issue: "Large files rejected"
**Solution:** Check if you accidentally included `node_modules/` or database files
```bash
# Remove from Git cache
git rm -r --cached node_modules
git rm --cached *.db

# Commit the removal
git commit -m "Remove ignored files"
git push
```

### Issue: "Repository not found"
**Solution:** Check the remote URL:
```bash
git remote -v

# If wrong, update it:
git remote set-url origin https://github.com/YOUR_USERNAME/its-business-core.git
```

---

## 🔒 Security Checklist

Before pushing to GitHub, verify:

- [ ] `.env` file is in `.gitignore` ✅
- [ ] Database files (`*.db`) are in `.gitignore` ✅
- [ ] `uploads/` directory is in `.gitignore` ✅
- [ ] No hardcoded passwords in code
- [ ] No API keys in code
- [ ] Using `.env.example` for environment variable templates

---

## 🌐 Clone on Another Machine

Once on GitHub, you can clone anywhere:

```bash
# On any machine with Git
git clone https://github.com/YOUR_USERNAME/its-business-core.git
cd its-business-core
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev
```

---

## 📊 Next Steps After GitHub Setup

1. **Deploy with Docker from GitHub**
   - Update ITSCoreDocker to clone from GitHub
   - Deploy to Synology NAS directly from GitHub

2. **Enable GitHub Actions** (Optional)
   - Automated testing
   - Automated Docker builds
   - Automated deployments

3. **Collaborate**
   - Invite team members
   - Use branches for features
   - Create pull requests for code review

---

## 📝 Recommended Commit Message Format

```
feat: Add budget dashboard with year-over-year comparison
fix: Correct YoY calculation division by zero
docs: Update README with deployment instructions
refactor: Optimize database queries for performance
chore: Update dependencies to latest versions
```

---

**Need Help?**
- GitHub Documentation: https://docs.github.com
- GitHub Desktop Guide: https://docs.github.com/en/desktop
- Git Basics: https://git-scm.com/book/en/v2
