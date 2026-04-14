# 🛠️ Firebase Authentication Setup Guide

The "Login failed" and "Reading settings" errors usually happen because the public website isn't yet connected to your Firebase project. Follow these 3 steps to fix it.

## 1. Enable Auth Providers in Firebase Console

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Select your **ArcZen** project.
3.  In the left sidebar, click **Build** → **Authentication**.
4.  Click the **Sign-in method** tab.
5.  **Enable Email/Password**:
    *   Click "Add new provider" → **Email/Password**.
    *   Enable it and click **Save**.
6.  **Enable Google** (Optional but recommended):
    *   Click "Add new provider" → Google.
    *   Enable it, select your project support email, and click **Save**.

## 2. Get your Web App Configuration

1.  In the Firebase Console, click the ⚙️ (cog icon) next to "Project Overview" and select **Project settings**.
2.  Scroll down to the **Your apps** section.
3.  If you don't see a "Web App" (icon looks like `</>`), click **Add app** and select the Web platform.
4.  Once created, you will see a `firebaseConfig` object that looks like this:
    ```javascript
    const firebaseConfig = {
      apiKey: "AIza...",
      authDomain: "your-project.firebaseapp.com",
      projectId: "your-project",
      storageBucket: "your-project.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abc123"
    };
    ```

## 3. Update your `.env` File

1.  In your code editor, go to the `public-site` folder.
2.  Create a new file named `.env` (or update it if it exists).
3.  Copy and paste your values from Step 2 into this file:

```bash
# ─── Firebase (Client-side) ─────────────
PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY_HERE
PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID

# ─── Site Config ────────────────────────
PUBLIC_SITE_URL=https://arczen.store
PUBLIC_SITE_NAME=ArcZen
```

> [!IMPORTANT]
> After saving the `.env` file, you must **restart your local server** (run `npm run dev` again) for the changes to take effect.
