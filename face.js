/**
 * face.js
 * Handles all face-api.js interactions and Gemini API for quality control.
 */

const face = {
    isLoaded: false,
    faceMatcher: null,
    MODEL_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/',

    /**
     * Loads all necessary face recognition models.
     */
    async loadModels() {
        if (this.isLoaded) return;
        ui.showLoading(true, 'Loading Face Models...');
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(this.MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL),
            ]);
            this.isLoaded = true;
            ui.updateSystemStatus('faceApiStatus', 'Ready', 'active');
        } catch (error) {
            console.error("Error loading face models:", error);
            ui.updateSystemStatus('faceApiStatus', 'Error', 'inactive');
            ui.showToast('Failed to load face models.', 'error');
        } finally {
            ui.showLoading(false);
        }
    },

    /**
     * Creates a face descriptor from an image element.
     * @param {HTMLImageElement|HTMLVideoElement} imageEl - The image or video to process.
     * @returns {Promise<Float32Array|null>} The descriptor or null if not found.
     */
    async getDescriptor(imageEl) {
        if (!this.isLoaded) return null;
        const detection = await faceapi
            .detectSingleFace(imageEl, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        return detection ? detection.descriptor : null;
    },
    
    /**
     * Analyzes the quality of a registration photo using the Gemini API.
     * @param {string} apiKey - The Gemini API key.
     * @param {string} imageBase64 - The base64 encoded image data.
     * @returns {Promise<Object>} An object with a `success` flag and a `reason`.
     */
    async analyzeImageQualityWithGemini(apiKey, imageBase64) {
        if (!apiKey) {
            return { success: false, reason: "Gemini API key is not set. Skipping quality check." };
        }
        ui.showLoading(true, 'AI analyzing photo quality...');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{
                parts: [{
                    text: `Analyze this user portrait for a facial recognition system. Is it a high-quality photo for this purpose? Check for these specific issues: 
                    1. Blur: Is the face sharp and in focus?
                    2. Obstruction: Are there any objects like hands, hair, or sunglasses covering key facial features (eyes, nose, mouth)?
                    3. Lighting: Is the face evenly lit without harsh shadows or being too dark or bright?
                    4. Angle: Is the person looking mostly straight ahead?
                    
                    Respond ONLY with a JSON object in this exact format: {"isGoodQuality": boolean, "reason": "A brief explanation for your decision."}. For example: {"isGoodQuality": false, "reason": "The face is blurry and partially covered by hair."} or {"isGoodQuality": true, "reason": "The photo is clear, well-lit, and unobstructed."}`
                }, {
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: imageBase64.split(',')[1] // Remove the data URI prefix
                    }
                }]
            }]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorBody = await response.json();
                console.error("Gemini API Error:", errorBody);
                throw new Error(`API request failed: ${response.statusText}`);
            }
            const result = await response.json();
            const textResponse = result.candidates[0].content.parts[0].text;
            const jsonResponse = JSON.parse(textResponse);

            ui.showLoading(false);
            return {
                success: jsonResponse.isGoodQuality,
                reason: jsonResponse.reason
            };
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            ui.showLoading(false);
            // Bypass check if API fails, but warn the user
            return { success: true, reason: "AI quality check failed. Bypassing." };
        }
    },

    /**
     * Creates a FaceMatcher instance from the list of registered students.
     * @param {Array} students - The array of student objects.
     * @param {number} threshold - The recognition distance threshold.
     */
    createMatcher(students, threshold = 0.6) {
        if (!students || students.length === 0) {
            this.faceMatcher = null;
            return;
        }
        const labeledDescriptors = students
            .filter(s => s.faceDescriptor && s.faceDescriptor.length > 0)
            .map(s => new faceapi.LabeledFaceDescriptors(
                s.id,
                [Float32Array.from(Object.values(s.faceDescriptor))]
            ));
        
        if (labeledDescriptors.length > 0) {
            this.faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
        } else {
            this.faceMatcher = null;
        }
    },

    /**
     * Finds the best match for a given descriptor.
     * @param {Float32Array} descriptor - The descriptor to match.
     * @returns {faceapi.FaceMatch|null} The best match or null.
     */
    findBestMatch(descriptor) {
        if (!this.faceMatcher || !descriptor) return null;
        return this.faceMatcher.findBestMatch(descriptor);
    }
};
