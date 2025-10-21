/**
 * database.js
 * Handles all Firestore operations.
 * It does NOT initialize firebase. It receives the 'db' instance from app.js
 */
import { ui } from './ui.js';

export const dbHandler = {
    // This function does not interact with firebase, so it's unchanged.
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

    // MODIFIED: Now accepts 'firebase' object as first argument
    async save(firebase, adminId, state) {
        if (!adminId) return;
        const { db, writeBatch, doc } = firebase;
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

    // MODIFIED: Now accepts 'firebase' object as first argument
    async load(firebase, adminId) {
        if (!adminId) return { students: [], attendanceRecords: [], settings: {} };
        const { db, getDoc, getDocs, collection, doc } = firebase;
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

    // MODIFIED: Now accepts 'firebase' object as first argument
    async deleteStudent(firebase, adminId, studentId) {
        if (!adminId || !studentId) return;
        const { db, deleteDoc, doc } = firebase;
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
    // MODIFIED: Now accepts 'firebase' object as first argument
    async getAdmins(firebase) {
        const { db, getDocs, collection } = firebase;
        const adminsSnapshot = await getDocs(collection(db, "adminsList"));
        return adminsSnapshot.docs.map(doc => doc.data());
    },
    
    // MODIFIED: Now accepts 'firebase' object as first argument
    async isAdmin(firebase, uid) {
        if (!uid) return false;
        const { db, getDoc, doc } = firebase;
        const adminRef = doc(db, "adminsList", uid);
        const adminSnap = await getDoc(adminRef);
        return adminSnap.exists();
    },
    
    // MODIFIED: Now accepts 'firebase' object as first argument
    async addAdmin(firebase, user) {
        if (!user || !user.uid) return;
        const { db, setDoc, doc } = firebase;
        const adminRef = doc(db, "adminsList", user.uid);
        await setDoc(adminRef, {
            email: user.email,
            uid: user.uid,
            registeredAt: new Date().toISOString()
        });
    }
};
