import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from "./utils.js";

// Init Storage
import { firebaseConfig } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
const app = initializeApp(firebaseConfig); // Re-init to be safe/consistent
const storage = getStorage(app);
const db = getFirestore(app);

// --- Photo Upload ---

export async function uploadProfilePhoto(file, user) {
    if (!file) return;

    // 1. Client-side validation (Size < 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast("Image too large. Max 2MB.", "error");
        return;
    }

    try {
        const path = `profile_photos/${user.uid}.jpg`; // Force JPG for consistency
        const storageRef = ref(storage, path);

        showToast("Uploading...", "neutral");

        // 2. Upload
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        // 3. Update Auth Profile
        await updateProfile(user, { photoURL: url });

        // 4. Update Firestore User Doc
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { photoUrl: url });

        showToast("Profile photo updated!", "success");
        return url;

    } catch (error) {
        console.error("Upload failed", error);
        showToast("Upload failed: " + error.message, "error");
    }
}

// --- Password Management ---

export async function changeUserPassword(user, currentPass, newPass) {
    const credential = EmailAuthProvider.credential(user.email, currentPass);

    try {
        // 1. Re-authenticate (Security Requirement)
        await reauthenticateWithCredential(user, credential);

        // 2. Update Password
        await updatePassword(user, newPass);

        showToast("Password changed successfully", "success");
        return true;
    } catch (error) {
        console.error("Password change failed", error);
        showToast("Error: " + error.message, "error");
        return false;
    }
}
