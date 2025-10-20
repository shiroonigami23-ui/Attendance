// camera.js

let currentStream = null;

/**
 * Starts the camera and displays the video feed.
 * @param {string} videoElementId - The ID of the video element.
 * @returns {Promise<MediaStream|null>} The camera stream or null on error.
 */
async function startCamera(videoElementId) {
    try {
        if (currentStream) {
            stopCamera();
        }
        const video = document.getElementById(videoElementId);
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        video.srcObject = stream;
        currentStream = stream;
        ui.updateSystemStatus('cameraStatus', 'Active', 'active');
        return stream;
    } catch (error) {
        console.error('Error starting camera:', error);
        ui.showToast('Failed to start camera. Please check permissions.', 'error');
        ui.updateSystemStatus('cameraStatus', 'Error', 'inactive');
        return null;
    }
}

/**
 * Stops the current camera stream.
 */
function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
        ui.updateSystemStatus('cameraStatus', 'Inactive', 'inactive');
    }
}

/**
 * Captures a photo from a video element.
 * @param {string} videoElementId - The ID of the video element.
 * @param {string} canvasElementId - The ID of the canvas element.
 * @returns {string|null} The captured photo as a data URL, or null.
 */
function capturePhoto(videoElementId, canvasElementId) {
    const video = document.getElementById(videoElementId);
    const canvas = document.getElementById(canvasElementId);
    if (video.readyState < 2) {
        ui.showToast('Camera not ready, please wait.', 'warning');
        return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
}

// Make camera functions available globally
window.camera = {
    startCamera,
    stopCamera,
    capturePhoto,
};
