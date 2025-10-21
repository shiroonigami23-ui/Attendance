/**
 * database.js
 * Handles all Firestore operations and image uploads to PythonAnywhere.
 */
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ui } from './ui.js';

export const dbHandler = {

    /**
     * Uploads an image to the PythonAnywhere backend.
     * @param {string} backendUrl - The base URL of the PythonAnywhere server.
     * @param {string} studentId - The student's ID for the filename.
     * @param {string} base64Image - The base64 data URL of the image.
     * @returns {Promise<string|null>} The public URL of the uploaded image or null.
     */
    async uploadImage(backendUrl, studentId, base64Image) {
        if (!backendUrl || !studentId || !base64Image) {
            console.error("Missing parameters for image upload.");
            return null;
        }
        
        const uploadUrl = `${backendUrl}/upload`;

        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64Image,
                    filename: studentId 
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            // The python app returns a relative URL like "/static/uploads/file.jpg"
            // We combine it with the base URL to make it a full, absolute URL.
            return `${backendUrl}${result.url}`;

        } catch (error) {
            console.error("Error uploading image to PythonAnywhere:", error);
            ui.showToast("Failed to upload photo to backend server.", "error");
            return null;
        }
    },

    /**
     * Saves the entire application state to Firestore.
     * @param {string} adminId - The admin's user ID.
     * @param {Object} state - The main application state.
     */
    async save(adminId, state) {
        if (!adminId) return;
        const db = getFirestore();
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

    /**
     * Loads all data for an admin from Firestore.
     * @param {string} adminId - The admin's user ID.
     * @returns {Promise<Object>} The loaded state.
     */
    async load(adminId) {
        if (!adminId) return { students: [], attendanceRecords: [], settings: {} };
        const db = getFirestore();
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

    /**
     * Deletes a student from Firestore. The backend should handle image deletion if necessary.
     * @param {string} adminId - The admin's user ID.
     * @param {string} studentId - The ID of the student to delete.
     */
    async deleteStudent(adminId, studentId) {
        if (!adminId || !studentId) return;
        const db = getFirestore();
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

/**
 * Handles checking and managing the global list of admins.
 */
export const adminListHandler = {
    async getAdmins() {
        const db = getFirestore();
        const adminsSnapshot = await getDocs(collection(db, "adminsList"));
        return adminsSnapshot.docs.map(doc => doc.data());
    },
    
    async addAdmin(user) {
        if (!user || !user.uid) return;
        const db = getFirestore();
        const adminRef = doc(db, "adminsList", user.uid);
        await setDoc(adminRef, {
            email: user.email,
            uid: user.uid,
            registeredAt: new Date().toISOString()
        });
    }
};
