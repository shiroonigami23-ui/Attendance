/**
 * face.js
 * This module handles all face-api.js interactions and Gemini API for quality control.
 */
import { ui } from './ui.js';

const faceapi = window.faceapi;

export const face = {
    isLoaded: false,
    faceMatcher: null,
    MODEL_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/',

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
        } catch (error) {
            console.error("Model load error:", error);
            ui.showToast('Failed to load face models.', 'error');
        } finally {
            ui.showLoading(false);
        }
    },

    async getDescriptor(imageEl) {
        if (!this.isLoaded) return null;
        try {
            const detection = await faceapi
                .detectSingleFace(imageEl, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            return detection ? detection.descriptor : null;
        } catch (error) {
            console.error("Error getting face descriptor:", error);
            return null;
        }
    },

    async analyzeImageQualityWithGemini(apiKey, imageBase64) {
        if (!apiKey) return { success: true, reason: "API key not set. Skipping quality check." };
        
        ui.showLoading(true, 'AI analyzing photo quality...');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: `Is this a high-quality, clear, well-lit, and unobstructed portrait photo suitable for a facial recognition system? Respond ONLY with a JSON object in this exact format: {"isGoodQuality": boolean, "reason": "A brief explanation."}`}, { inline_data: { mime_type: "image/jpeg", data: imageBase64.split(',')[1] }}]}]
        };

        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
            const result = await response.json();
            const jsonResponse = JSON.parse(result.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim());
            return { success: jsonResponse.isGoodQuality, reason: jsonResponse.reason };
        } catch (error) {
            console.error("Gemini API Error:", error);
            return { success: true, reason: "AI quality check failed or returned invalid format. Bypassing." };
        } finally {
            ui.showLoading(false);
        }
    },

    createMatcher(students, threshold = 0.5) {
        this.faceMatcher = null; // Reset matcher
        if (!this.isLoaded || !students || students.length === 0) return;
        
        const labeledDescriptors = students
            .filter(s => s.faceDescriptor && s.faceDescriptor.length > 0)
            .map(s => new faceapi.LabeledFaceDescriptors(s.id, [Float32Array.from(Object.values(s.faceDescriptor))]));
        
        if (labeledDescriptors.length > 0) {
            this.faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
        }
    },

    findBestMatch(descriptor) {
        if (!this.faceMatcher || !descriptor) return null;
        return this.faceMatcher.findBestMatch(descriptor);
    }
};
