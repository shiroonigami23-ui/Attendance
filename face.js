// face.js

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';
let faceApiLoaded = false;
let faceMatcher = null;

/**
 * Loads the face-api.js models.
 * @returns {Promise<boolean>} True if models loaded successfully, false otherwise.
 */
async function loadModels() {
    if (faceApiLoaded) return true;
    try {
        ui.showLoading(true, 'Loading Face Recognition Models...');
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        faceApiLoaded = true;
        ui.updateSystemStatus('faceApiStatus', 'Ready', 'active');
        ui.showToast('Face models loaded successfully!', 'success');
        return true;
    } catch (error) {
        console.error('Error loading face-api models:', error);
        ui.updateSystemStatus('faceApiStatus', 'Error', 'inactive');
        ui.showToast('Failed to load face models. Check network.', 'error');
        return false;
    } finally {
        ui.showLoading(false);
    }
}

/**
 * Detects a single face and computes its descriptor from an image.
 * @param {HTMLImageElement|HTMLVideoElement} image - The image or video element.
 * @returns {Promise<Float32Array|null>} The face descriptor or null if no face is detected.
 */
async function getFaceDescriptor(image) {
    if (!faceApiLoaded) {
        ui.showToast('Face models not loaded yet.', 'error');
        return null;
    }
    try {
        const detection = await faceapi.detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        return detection ? detection.descriptor : null;
    } catch (error) {
        console.error('Error getting face descriptor:', error);
        return null;
    }
}

/**
 * Creates a FaceMatcher for recognizing faces.
 * @param {Array} students - An array of student objects with face descriptors.
 */
function createFaceMatcher(students) {
    if (students.length === 0) {
        faceMatcher = null;
        return;
    }
    const labeledFaceDescriptors = students
        .filter(student => student.faceDescriptor)
        .map(student => new faceapi.LabeledFaceDescriptors(
            student.id,
            [Float32Array.from(student.faceDescriptor)]
        ));

    if (labeledFaceDescriptors.length > 0) {
        faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
    } else {
        faceMatcher = null;
    }
}

/**
 * Finds the best match for a face descriptor.
 * @param {Float32Array} descriptor - The face descriptor to match.
 * @returns {Object|null} The best match result or null.
 */
function findBestMatch(descriptor) {
    if (!faceMatcher) return null;
    return faceMatcher.findBestMatch(descriptor);
}

// Make face recognition functions available globally
window.face = {
    loadModels,
    getFaceDescriptor,
    createFaceMatcher,
    findBestMatch,
};
