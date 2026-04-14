// User Management Module
import { collection, doc, getDoc, getDocs, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { showToast } from './utils.js';



// Team data mapping (from team.json)
const TEAM_MAPPING = {
    "azwadriyan@gmail.com": {
        name: "MD. Azwad Riyan",
        photoUrl: "/assets/images/team/Riyan.jpg",
        title: "Co-founder, Technology & Visualization",
        telegramId: "1276130679"
    },
    "nusaiba.mamun20@gmail.com": {
        name: "Nusaiba Binte Mamun",
        photoUrl: "/assets/images/team/Nusaiba.jpg",
        title: "Co-founder, Client Relations & Management",
        telegramId: "1617312734"
    },
    "abdullahmubasshir25@gmail.com": {
        name: "Abdullah Mubasshir",
        photoUrl: "/assets/images/team/Mubasshir.jpg",
        title: "Co-founder, Lead Designer",
        telegramId: "5243994015"
    },
    "shariarhassan2002@gmail.com": {
        name: "Shariar Hassan",
        photoUrl: "/assets/images/team/Shariar.png",
        title: "Co-founder, Art Direction & Styling",
        telegramId: "1367897356"
    }
};

// Get all admins (replaces getAllUsers for internal team view)
export async function getAllAdmins() {
    try {
        const querySnapshot = await getDocs(collection(db, "admins"));
        const admins = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            admins.push({ id: doc.id, ...data });
        });

        return admins;
    } catch (error) {
        console.error("Error fetching admins:", error);
        return [];
    }
}

// Alias for UI compatibility
export const getAllUsers = getAllAdmins;

// Get single user profile (checks admins first, then customer_profiles)
export async function getUserProfile(uid) {
    try {
        // Try Admin first
        const adminRef = doc(db, "admins", uid);
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists()) return { id: uid, type: 'admin', ...adminSnap.data() };

        // Then Customer
        const customerRef = doc(db, "customers", uid);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) return { id: uid, type: 'customer', ...customerSnap.data() };

        // Finally Founders
        const founderRef = doc(db, "founders", uid);
        const founderSnap = await getDoc(founderRef);
        if (founderSnap.exists()) return { id: uid, type: 'founder', ...founderSnap.data() };

        return null;
    } catch (error) {
        console.error("Error fetching profile:", error);
        return null;
    }
}

/**
 * Unified Profile Sync Logic
 * Splits data into:
 * 1. users/{uid} - Core Auth Base
 * 2. admins/{uid} - Internal Team (if whitelisted)
 * 3. customer_profiles/{uid} - Public User (if not admin)
 */
export async function syncUserProfile(authUser) {
    try {
        const uid = authUser.uid;
        const email = authUser.email;
        const displayName = authUser.displayName || email.split('@')[0];
        const timestamp = serverTimestamp();

        // 0. Name splitting logic for internal table compatibility
        const parts = displayName.trim().split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';

        // 0. Check Founder Status First (Enterprise Founders bypass Whitelist)
        const founderRef = doc(db, "founders", uid);
        const founderSnap = await getDoc(founderRef);
        
        if (founderSnap.exists()) {
            const existing = founderSnap.data();
            const founderData = {
                uid: uid,
                email: email,
                name: authUser.displayName || email,
                role: "founder",
                beautiful: existing.beautiful || false, // Must be manually enabled in DB
                lastActive: timestamp
            };
            return founderData;
        }

        // 1. Update/Create Core Auth Base (users/{uid})
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        const teamData = TEAM_MAPPING[email] || null;
        const isAdmin = !!teamData;

        const authData = {
            email: email,
            role: isAdmin ? "admin" : "customer",
            provider: authUser.providerId || "google",
            lastActive: timestamp,
            status: "active"
        };

        if (!userSnap.exists()) {
            authData.createdAt = timestamp;
            await setDoc(userRef, authData);
        } else {
            await updateDoc(userRef, { lastActive: timestamp });
        }

        // 2. Handle Profile Specifics
        if (isAdmin) {
            // ADMIN / INTERNAL TEAM
            const adminRef = doc(db, "admins", uid);
            const adminSnap = await getDoc(adminRef);

            if (adminSnap.exists()) {
                const existing = adminSnap.data();
                return {
                    uid: uid,
                    email: email,
                    name: existing.name || teamData.name || authUser.displayName || email,
                    photoUrl: existing.photoUrl || teamData.photoUrl || authUser.photoURL || null,
                    title: existing.title || teamData.title || "Team Member",
                    role: existing.role || "employee",
                    beautiful: existing.beautiful || false,
                    permissions: existing.permissions || { orders: false, finance: false, users: false, settings: false },
                    status: "active"
                };
            }
            
            // If they are whitelisted in TEAM_MAPPING but no admin document exists,
            // they are treated as unauthorized until manually added by a Super Admin.
            console.warn(`Admin account for ${email} is not fully provisioned in Firestore.`);
            return { email, role: 'customer', beautiful: false };
        } else {
            // PUBLIC CUSTOMER — Use 'customers' collection
            const customerRef = doc(db, "customers", uid);
            const customerSnap = await getDoc(customerRef);
            const existing = customerSnap.exists() ? customerSnap.data() : {};
            
            const customerData = {
                uid: uid,
                name: existing.name || displayName,
                firstName: existing.firstName || firstName,
                lastName: existing.lastName || lastName,
                email: email,
                photoUrl: authUser.photoURL || existing.photoUrl || null,
                phone: existing.phone || null,
                lastActiveAt: timestamp,
                role: 'customer',
                isActive: existing.isActive !== false
            };

            if (!customerSnap.exists()) {
                customerData.createdAt = timestamp;
                customerData.totalOrders = 0;
                customerData.totalSpent = 0;
                customerData.loyaltyPoints = 0;
            }
            
            await setDoc(customerRef, customerData, { merge: true });
            return customerData;
        }
    } catch (error) {
        console.error("Error in unified syncUserProfile:", error);
        throw error;
    }
}

// Update user role (admin only - updates the 'admins' collection)
export async function updateUserRole(uid, newRole) {
    try {
        if (window.CuteState.role !== 'admin') {
            throw new Error("Permission denied");
        }

        const adminRef = doc(db, "admins", uid);
        const adminSnap = await getDoc(adminRef);
        const oldRole = adminSnap.exists() ? adminSnap.data().role : 'unknown';

        await updateDoc(adminRef, {
            role: newRole,
            updatedAt: serverTimestamp()
        });

        // Log to Admin Logs
        try {
            const { logSystemAction } = await import('./db.js');
            await logSystemAction('role_update', `Updated internal role for ${uid} from ${oldRole} to ${newRole}`, {
                targetUid: uid,
                oldRole: oldRole,
                newRole: newRole
            });
        } catch (e) { }

        showToast("Team role updated", "success");
        
        // Zero Trust Alert
        alert(`⚠️ Internal role changed to ${newRole}.\n\nYou MUST also run the backend script to grant real Auth claims:\n\nnode public-site/scripts/set-admin-claim.js ${uid} true`);
    } catch (error) {
        console.error("Error updating admin role:", error);
        showToast("Failed to update role", "error");
        throw error;
    }
}

// Get admin by email
export async function getAdminByEmail(email) {
    try {
        const admins = await getAllAdmins();
        return admins.find(u => u.email === email);
    } catch (error) {
        console.error("Error finding admin:", error);
        return null;
    }
}

// Get team members for assignment dropdown
export async function getTeamMembers() {
    try {
        const admins = await getAllAdmins();
        return admins.filter(u => u.status === 'active').map(u => ({
            uid: u.id,
            name: u.name,
            email: u.email,
            photoUrl: u.photoUrl,
            role: u.role
        }));
    } catch (error) {
        console.error("Error fetching team members:", error);
        return [];
    }
}
