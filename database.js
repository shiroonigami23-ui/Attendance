// database.js
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// This module now uses Firestore instead of localStorage
export const dbHandler = {
    /**
     * Saves or updates the entire application state in Firestore.
     * @param {string} adminId - The UID of the logged-in admin.
     * @param {Object} state - The application state to save.
     */
    async save(adminId, state) {
        if (!adminId) return;
        const db = getFirestore();
        const batch = writeBatch(db);

        // Save settings
        const settingsRef = doc(db, "admins", adminId, "config", "settings");
        batch.set(settingsRef, state.settings);

        // Save students
        state.students.forEach(student => {
            const studentRef = doc(db, "admins", adminId, "students", student.id);
            batch.set(studentRef, student);
        });
        
        // Save attendance records
        state.attendanceRecords.forEach(record => {
             const recordRef = doc(db, "admins", adminId, "attendance", record.id);
             batch.set(recordRef, record);
        });

        try {
            await batch.commit();
        } catch (error) {
            console.error("Error saving data to Firestore:", error);
            ui.showToast("Could not save data.", "error");
        }
    },

    /**
     * Loads the entire application state from Firestore.
     * @param {string} adminId - The UID of the logged-in admin.
     * @returns {Promise<Object>} The loaded state.
     */
    async load(adminId) {
        if (!adminId) return { students: [], attendanceRecords: [], settings: {} };
        const db = getFirestore();
        try {
            // Load settings
            const settingsRef = doc(db, "admins", adminId, "config", "settings");
            const settingsSnap = await getDoc(settingsRef);
            const settings = settingsSnap.exists() ? settingsSnap.data() : {};

            // Load students
            const studentsCol = collection(db, "admins", adminId, "students");
            const studentsSnap = await getDocs(studentsCol);
            const students = studentsSnap.docs.map(doc => doc.data());

            // Load attendance records
            const recordsCol = collection(db, "admins", adminId, "attendance");
            const recordsSnap = await getDocs(recordsCol);
            const attendanceRecords = recordsSnap.docs.map(doc => doc.data());

            return { students, attendanceRecords, settings };
        } catch (error) {
            console.error("Error loading data from Firestore:", error);
            ui.showToast("Failed to load data.", "error");
            return { students: [], attendanceRecords: [], settings: {} };
        }
    },

    /**
     * Deletes a single student from Firestore.
     * @param {string} adminId - The UID of the logged-in admin.
     * @param {string} studentId - The ID of the student to delete.
     */
    async deleteStudent(adminId, studentId) {
        if (!adminId || !studentId) return;
        const db = getFirestore();
        const studentRef = doc(db, "admins", adminId, "students", studentId);
        try {
            await deleteDoc(studentRef);
        } catch(error) {
            console.error("Error deleting student:", error);
        }
    },

    // Backup and restore can remain client-side for simplicity, but operate on data from Firestore
    backup(state) {
        const backupData = {
            students: state.students,
            attendanceRecords: state.attendanceRecords,
            settings: state.settings,
            backupDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `faceattend-backup-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        ui.showToast("Backup created successfully!", "success");
    },
};
