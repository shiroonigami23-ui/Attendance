/**
 * database.js
 * Handles all Firestore operations.
 * It relies on the global window.firebase object initialized in index.html
 */
import { ui } from './ui.js';

// All the firebase functions we need are now on the window object
const { db, doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc } = window.firebase;

export const dbHandler = {
    async uploadImage(backendUrl, studentId, base64Image) {
        if (!backendUrl || !studentId || !base64Image) {
            console.error("Missing parameters for image upload.");
            return null;
        }
        const uploadUrl = `${backendUrl}/upload`;
        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image, filename: studentId }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            return `${backendUrl}${result.url}`;
        } catch (error) {
            console.error("Error uploading image to PythonAnywhere:", error);
            ui.showToast("Failed to upload photo to backend server.", "error");
            return null;
        }
    },

    async save(adminId, state) {
        if (!adminId) return;
        const batch = writeBatch(db);

        const settingsRef = doc(db, "admins", adminId, "config", "settings");
        batch.set(settingsRef, state.settings);

        state.students.forEach(student => {
            const studentRef = doc(db, "admins", adminId, "students", student.id);
            batch.set(studentRef, student);
        });
        
        state.attendanceRecords.forEach(record => {
             const recordRef = doc(db, "admins", adminId, "attendance", record.id);
             batch.set(recordRef, record);
        });

        await batch.commit().catch(e => console.error("Firestore Save Error:", e));
    },

    async load(adminId) {
        if (!adminId) return { students: [], attendanceRecords: [], settings: {} };
        try {
            const settingsSnap = await getDoc(doc(db, "admins", adminId, "config", "settings"));
            const settings = settingsSnap.exists() ? settingsSnap.data() : {};
            const studentsSnap = await getDocs(collection(db, "admins", adminId, "students"));
            const students = studentsSnap.docs.map(doc => doc.data());
            const recordsSnap = await getDocs(collection(db, "admins", adminId, "attendance"));
            const attendanceRecords = recordsSnap.docs.map(doc => doc.data());
            return { students, attendanceRecords, settings };
        } catch (error) {
            console.error("Error loading data from Firestore:", error);
            ui.showToast("Failed to load data.", "error");
            return { students: [], attendanceRecords: [], settings: {} };
        }
    },

    async deleteStudent(adminId, studentId) {
        if (!adminId || !studentId) return;
        await deleteDoc(doc(db, "admins", adminId, "students", studentId));
    },

    backup(state) {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `faceattend-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    },
};

export const adminListHandler = {
    async getAdmins() {
        const adminsSnapshot = await getDocs(collection(db, "adminsList"));
        return adminsSnapshot.docs.map(doc => doc.data());
    },
    
    async isAdmin(uid) {
        if (!uid) return false;
        const adminRef = doc(db, "adminsList", uid);
        const adminSnap = await getDoc(adminRef);
        return adminSnap.exists();
    },
    
    async addAdmin(user) {
        if (!user || !user.uid) return;
        const adminRef = doc(db, "adminsList", user.uid);
        await setDoc(adminRef, {
            email: user.email,
            uid: user.uid,
            registeredAt: new Date().toISOString()
        });
    }
};
