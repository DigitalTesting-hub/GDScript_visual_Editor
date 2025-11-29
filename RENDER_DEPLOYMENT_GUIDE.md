# Render Deployment Guide

## Visual GDScript Generator - Production Deployment

This guide covers deploying the Visual GDScript Generator to Render.com, a modern cloud platform for building and scaling web applications.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Deploying to Render](#deploying-to-render)
4. [Post-Deployment Configuration](#post-deployment-configuration)
5. [Troubleshooting](#troubleshooting)
6. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ A [Render.com](https://render.com) account (free tier available)
- ✅ GitHub account with this repository pushed to a public/private repo
- ✅ Google Gemini API key (required)
  - Get it from: https://aistudio.google.com/app/apikeys
- ✅ Optional: Groq API key for automatic fallback
  - Get it from: https://console.groq.com/keys
- ✅ Generated session secret (random string)

---

## Environment Setup

### 1. Generate Session Secret

Create a secure random string for session management:

**Option A: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option B: Using OpenSSL**
```bash
openssl rand -hex 32
```

**Option C: Using Python**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Save this value - you'll need it in the next step.

### 2. Prepare API Keys

You'll need:

- **GEMINI_API_KEY** (Required)
  - Visit: https://aistudio.google.com/app/apikeys
  - Click "Create API Key"
  - Copy the generated key (keep it secret!)

- **GROQ_API_KEY** (Optional)
  - Visit: https://console.groq.com/keys
  - Generate a new API key
  - This enables automatic fallback when Gemini is rate-limited

---

## Deploying to Render

### Step 1: Push Code to GitHub

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### Step 2: Create Render Web Service

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository:
   - Select "GitHub" as the source
   - Authorize Render to access your GitHub account
   - Choose this repository
4. Configure the service:

   | Field | Value |
   |-------|-------|
   | **Name** | `gdscript-generator` (or your preferred name) |
   | **Environment** | `Node` |
   | **Region** | Choose closest to your users |
   | **Branch** | `main` |
   | **Build Command** | `npm run build` |
   | **Start Command** | `npm start` |

5. Click **"Create Web Service"**

### Step 3: Set Environment Variables

After the service is created, configure environment variables:

1. In the Render Dashboard, go to your service
2. Click **"Environment"** tab
3. Add the following environment variables:

   ```
   NODE_ENV=production
   GEMINI_API_KEY=your_gemini_api_key_here
   SESSION_SECRET=your_generated_session_secret_here
   GROQ_API_KEY=your_groq_api_key_here  (optional)
   ```

   > **Security Note:** Never commit API keys to your repository. Always use environment variables.

4. Click **"Save"**

### Step 4: Deploy

The deployment will start automatically:

1. Render will pull your code from GitHub
2. Run `npm run build`
3. Start the application with `npm start`
4. Watch the logs for any build/startup issues

Expected deployment time: 3-5 minutes

---

## Post-Deployment Configuration

### 1. Verify Deployment

Once deployed, Render will provide a URL like:
```
https://gdscript-generator.onrender.com
```

Visit this URL to verify:
- ✅ Page loads successfully
- ✅ AI Mode tab responds (generates code)
- ✅ All tabs load without errors
- ✅ No 500 errors in browser console

### 2. Test AI Features

1. Open **AI Mode** tab
2. Try generating simple GDScript code:
   - Prompt: `"Create a simple player movement script for a 3D character"`
   - Should return valid GDScript code

3. If Groq fallback is enabled:
   - Monitor initial requests to ensure Gemini is working
   - Test rate limit recovery by making rapid requests

### 3. Set Up Custom Domain (Optional)

To use a custom domain instead of `onrender.com`:

1. In Render Dashboard, go to your service
2. Click **"Settings"** → **"Custom Domains"**
3. Add your domain (e.g., `gdscript-generator.dev`)
4. Follow DNS configuration instructions provided by Render
5. Wait for SSL certificate (auto-generated, usually 5-15 minutes)

### 4. Enable Auto-Deploy

To automatically redeploy when you push to GitHub:

1. Go to service **"Settings"**
2. **"Auto-Deploy"** should already be enabled
3. Any push to `main` branch will trigger a new deployment

---

## Troubleshooting

### Build Fails

**Error:** `npm ERR! command failed`

**Solution:**
1. Check Render build logs for specific error
2. Verify `package.json` exists in root directory
3. Ensure Node version is 18+
4. Run locally: `npm run build` to test build process

### Application Won't Start

**Error:** `Cannot find module` or `Service failed to start`

**Solution:**
1. Check the start logs in Render Dashboard
2. Verify `npm start` works locally: `npm start`
3. Confirm all environment variables are set correctly
4. Check for typos in `SESSION_SECRET` or API keys

### API Errors in Production

**Error:** `GEMINI_API_KEY not configured` or `Failed to generate code`

**Solution:**

1. **Verify API key is set:**
   - Go to service → **Environment**
   - Check `GEMINI_API_KEY` is present and correct
   - Re-paste the key from aistudio.google.com if unsure

2. **Check API key validity:**
   - Test locally with the same key:
     ```bash
     GEMINI_API_KEY=your_key npm start
     ```
   - Try generating code in AI Mode

3. **Rate limiting (Gemini):**
   - Render will automatically use Groq fallback if configured
   - Check logs: `[AI] Groq succeeded (fallback)`
   - Upgrade Gemini plan if needed: https://aistudio.google.com/pricing

4. **Groq fallback not working:**
   - Verify `GROQ_API_KEY` is set in environment
   - Check Groq key validity at https://console.groq.com/dashboard

### "Cannot GET /" Error

**Cause:** Frontend not being served properly

**Solution:**
1. Check Render logs for build errors
2. Verify build command ran successfully
3. Redeploy:
   - Push a commit to trigger redeploy
   - Or click **"Manual Deploy"** in Render Dashboard

### High Memory Usage

**Symptom:** Service keeps restarting or slow performance

**Solution:**
1. Default Render free tier = 512MB
2. Upgrade to Starter plan ($7/month) for 1GB+ RAM
3. No code changes needed - just upgrade the plan

---

## Monitoring & Maintenance

### 1. View Logs

In Render Dashboard:
1. Go to your service
2. Click **"Logs"** tab
3. View real-time application output

Key logs to watch for:
```
[AI] ✓ Gemini succeeded
[AI] ✓ Groq succeeded (fallback)
[Gemini Error] ...
[Groq Error] ...
```

### 2. Performance Metrics

Monitor in Render Dashboard:
- **CPU Usage:** Should be <50% idle
- **Memory Usage:** Should be <80% of allocated
- **Requests:** Monitor in logs

### 3. Uptime Monitoring

Render provides uptime monitoring. To receive alerts:
1. Go to **Settings** → **Notifications**
2. Enable notifications for downtime events
3. Provide email address for alerts

### 4. Regular Checks

- **Weekly:** Check deployment logs for errors
- **Monthly:** Test all AI features (AI Mode, Scratch Blocks, Code Analyzer, etc.)
- **Monthly:** Verify API keys haven't expired
- **Quarterly:** Review Render pricing to optimize costs

### 5. Update Dependencies

To update packages safely:

```bash
npm update
npm audit fix
git commit -m "Update dependencies"
git push origin main
```

Render will automatically redeploy. Test thoroughly!

---

## Performance Optimization

### 1. Cold Start Times

First request after deployment can be slow (10-15 seconds):
- This is normal for Node.js on Render's free tier
- Upgrade to Starter+ for faster performance

### 2. Caching Strategy

The app uses aggressive caching:
- Godot 4.4 node data is cached
- API responses cached with `staleTime: Infinity`
- No automatic refetching (manual refresh only)

This reduces API calls and improves performance.

### 3. Database Considerations

Current setup uses in-memory storage. If you need persistence:

1. Add Render PostgreSQL database
2. Update `server/storage.ts` to use database
3. Add `DATABASE_URL` environment variable
4. Run migrations via Drizzle ORM

---

## Costs & Billing

### Free Tier (Current)

- ✅ 512MB RAM
- ✅ Shared CPU
- ✅ Auto-pause after 15 mins inactivity
- ✅ Free SSL certificate
- ✅ 750 free hours/month
- ❌ Can be slow due to auto-pause

**Cost:** $0/month

### Starter Plan

- ✅ 1GB RAM (no auto-pause!)
- ✅ Dedicated CPU
- ✅ 24/7 uptime
- ✅ All free tier features

**Cost:** $7/month (billed monthly)

### With Database (Starter + PostgreSQL)

- 1GB RAM Web Service: $7
- PostgreSQL Database: $15
- **Total:** $22/month

---

## Rollback to Previous Version

If deployment breaks production:

1. In Render Dashboard, go to **"Events"** tab
2. Find the last working deployment
3. Click **"Re-deploy"** next to it
4. Or push a previous git commit: `git revert HEAD && git push`

---

## Support & Resources

- **Render Docs:** https://render.com/docs
- **Node.js on Render:** https://render.com/docs/deploy-node-js-app
- **Environment Variables:** https://render.com/docs/environment-variables
- **Troubleshooting:** https://render.com/docs/troubleshooting

For app-specific issues:
- Check `RENDER_DEPLOYMENT_GUIDE.md` (this file)
- Review application logs in Render Dashboard
- Test locally: `npm run dev`

---

## Quick Reference

### Essential Commands

```bash
# Build locally
npm run build

# Start locally
npm start

# Development mode
npm run dev

# Install dependencies
npm install

# Update packages
npm update
```

### Environment Variables Checklist

- [ ] `NODE_ENV=production`
- [ ] `GEMINI_API_KEY=<your_key>`
- [ ] `SESSION_SECRET=<generated_secret>`
- [ ] `GROQ_API_KEY=<optional_key>` (optional)

### Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Environment variables set in Render
- [ ] Application loads at provided URL
- [ ] AI Mode generates code successfully
- [ ] Scratch Blocks works
- [ ] Code Analyzer responds
- [ ] No errors in browser console

---

## Next Steps

1. ✅ Follow steps 1-4 in [Deploying to Render](#deploying-to-render)
2. ✅ Verify deployment works
3. ✅ Test AI features
4. ✅ (Optional) Set up custom domain
5. ✅ Monitor logs and performance

**Your app is now live! 🚀**

---

**Last Updated:** November 29, 2025  
**For:** Visual GDScript Generator (Godot 4.4)  
**Framework:** Node.js + React + TypeScript  
**License:** MIT
