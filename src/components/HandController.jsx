import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { useGameStore } from '../store';
import * as THREE from 'three';

// Gesture types with confidence thresholds
const GESTURES = {
    FIST: { name: 'fist', confidence: 0.85 },
    OPEN_PALM: { name: 'open_palm', confidence: 0.8 },
    POINTING: { name: 'pointing', confidence: 0.75 },
    PEACE: { name: 'peace', confidence: 0.8 },
    THUMBS_UP: { name: 'thumbs_up', confidence: 0.75 },
    THUMBS_DOWN: { name: 'thumbs_down', confidence: 0.75 },
    ROCK: { name: 'rock', confidence: 0.8 },
    OK: { name: 'ok', confidence: 0.8 },
    GUN: { name: 'gun', confidence: 0.7 },
    PINCH: { name: 'pinch', confidence: 0.7 },
    SWIPE_LEFT: { name: 'swipe_left', confidence: 0.6 },
    SWIPE_RIGHT: { name: 'swipe_right', confidence: 0.6 },
    SWIPE_UP: { name: 'swipe_up', confidence: 0.6 },
    SWIPE_DOWN: { name: 'swipe_down', confidence: 0.6 },
    ZOOM_IN: { name: 'zoom_in', confidence: 0.65 },
    ZOOM_OUT: { name: 'zoom_out', confidence: 0.65 },
    ROTATE_CW: { name: 'rotate_cw', confidence: 0.65 },
    ROTATE_CCW: { name: 'rotate_ccw', confidence: 0.65 }
};

// Finger mapping constants
const FINGER_INDICES = {
    THUMB: [1, 2, 3, 4],
    INDEX: [5, 6, 7, 8],
    MIDDLE: [9, 10, 11, 12],
    RING: [13, 14, 15, 16],
    PINKY: [17, 18, 19, 20],
    WRIST: 0
};

class GestureRecognitionEngine {
    constructor() {
        this.gestureHistory = [];
        this.gestureBuffer = new Array(10).fill(null);
        this.bufferIndex = 0;
        this.smoothGesture = null;
        this.gestureStartTime = 0;
        this.gestureHoldDuration = 0;
    }

    // Calculate angle between three points
    static calculateAngle(A, B, C) {
        const AB = Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2));
        const BC = Math.sqrt(Math.pow(B.x - C.x, 2) + Math.pow(B.y - C.y, 2));
        const AC = Math.sqrt(Math.pow(C.x - A.x, 2) + Math.pow(C.y - A.y, 2));
        return Math.acos((BC * BC + AB * AB - AC * AC) / (2 * BC * AB));
    }

    // Calculate distance between two points
    static calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) +
            Math.pow(point2.y - point1.y, 2) +
            Math.pow(point2.z - point1.z, 2)
        );
    }

    // Check if finger is extended
    static isFingerExtended(landmarks, fingerIndices, threshold = 0.85) {
        const tip = landmarks[fingerIndices[3]];
        const base = landmarks[fingerIndices[0]];
        const mid = landmarks[fingerIndices[2]];

        // Calculate extension angle
        const angle = this.calculateAngle(base, mid, tip);
        const distance = this.calculateDistance(tip, base);

        return angle > threshold && distance > 0.15;
    }

    // Detect complex gestures
    detectGestures(landmarks, handedness, previousGesture = null) {
        const gestures = [];

        // Fist detection - all fingers curled
        const allFingersCurled =
            !this.isFingerExtended(landmarks, FINGER_INDICES.INDEX) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.MIDDLE) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.RING) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.PINKY);

        // Open palm detection - all fingers extended
        const allFingersExtended =
            this.isFingerExtended(landmarks, FINGER_INDICES.INDEX) &&
            this.isFingerExtended(landmarks, FINGER_INDICES.MIDDLE) &&
            this.isFingerExtended(landmarks, FINGER_INDICES.RING) &&
            this.isFingerExtended(landmarks, FINGER_INDICES.PINKY);

        // Pointing gesture - only index finger extended
        const pointing =
            this.isFingerExtended(landmarks, FINGER_INDICES.INDEX) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.MIDDLE) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.RING) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.PINKY);

        // Peace sign - index and middle extended
        const peace =
            this.isFingerExtended(landmarks, FINGER_INDICES.INDEX) &&
            this.isFingerExtended(landmarks, FINGER_INDICES.MIDDLE) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.RING) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.PINKY);

        // Thumbs up - thumb extended, others curled
        const thumbExtended = landmarks[4].y < landmarks[3].y;
        const thumbsUp =
            thumbExtended &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.INDEX) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.MIDDLE) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.RING) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.PINKY);

        // Thumbs down
        const thumbsDown =
            landmarks[4].y > landmarks[3].y &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.INDEX) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.MIDDLE) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.RING) &&
            !this.isFingerExtended(landmarks, FINGER_INDICES.PINKY);

        // OK gesture - thumb and index tip touching
        const okDistance = this.calculateDistance(landmarks[4], landmarks[8]);
        const okGesture = okDistance < 0.05;

        // Pinch gesture - thumb and index close
        const pinch = okDistance < 0.08 && okDistance > 0.02;

        // Add gestures with confidence scores
        if (allFingersCurled) gestures.push({ name: 'fist', confidence: 0.9 });
        if (allFingersExtended) gestures.push({ name: 'open_palm', confidence: 0.85 });
        if (pointing) gestures.push({ name: 'pointing', confidence: 0.8 });
        if (peace) gestures.push({ name: 'peace', confidence: 0.8 });
        if (thumbsUp) gestures.push({ name: 'thumbs_up', confidence: 0.75 });
        if (thumbsDown) gestures.push({ name: 'thumbs_down', confidence: 0.75 });
        if (okGesture) gestures.push({ name: 'ok', confidence: 0.85 });
        if (pinch) gestures.push({ name: 'pinch', confidence: 0.7 });

        // Return highest confidence gesture
        return gestures.sort((a, b) => b.confidence - a.confidence)[0] || null;
    }

    // Gesture buffer for smoothing
    bufferGesture(gesture) {
        this.gestureBuffer[this.bufferIndex] = gesture;
        this.bufferIndex = (this.bufferIndex + 1) % this.gestureBuffer.length;

        // Get most common gesture from buffer
        const gestureCount = {};
        this.gestureBuffer.forEach(g => {
            if (g) {
                gestureCount[g.name] = (gestureCount[g.name] || 0) + 1;
            }
        });

        const mostCommon = Object.entries(gestureCount)
            .sort((a, b) => b[1] - a[1])[0];

        if (mostCommon && mostCommon[1] > this.gestureBuffer.length / 2) {
            this.smoothGesture = { name: mostCommon[0], confidence: mostCommon[1] / this.gestureBuffer.length };
            return this.smoothGesture;
        }

        return null;
    }
}

const HandController = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const handLandmarkerRef = useRef(null);
    const streamRef = useRef(null);

    const [loaded, setLoaded] = useState(false);
    const [fps, setFps] = useState(0);
    const [calibrationComplete, setCalibrationComplete] = useState(false);
    const [, setHandedness] = useState('right');
    const [showLandmarks, setShowLandmarks] = useState(true);
    const [sensitivity, setSensitivity] = useState(0.7);
    const [performanceMode, setPerformanceMode] = useState('balanced');

    const gestureEngine = useMemo(() => new GestureRecognitionEngine(), []);

    const frameCount = useRef(0);
    const fpsInterval = useRef(0);

    const setHandPosition = useGameStore((state) => state.setHandPosition);
    const setHandDetected = useGameStore((state) => state.setHandDetected);
    const setGesture = useGameStore((state) => state.setGesture);
    const setGestureConfidence = useGameStore((state) => state.setGestureConfidence);
    const setHandLandmarks = useGameStore((state) => state.setHandLandmarks);
    const fireLaser = useGameStore((state) => state.fireLaser);
    const activatePowerUp = useGameStore((state) => state.activatePowerUp);
    const changeWeapon = useGameStore((state) => state.changeWeapon);
    const pauseGame = useGameStore((state) => state.pauseGame);

    // Calibration data
    const calibrationData = useRef({
        minX: 0,
        maxX: 1,
        minY: 0,
        maxY: 1,
        centerX: 0.5,
        centerY: 0.5,
        deadzone: 0.1
    });

    const calculateFPS = useCallback((currentTime) => {
        frameCount.current++;

        if (currentTime >= fpsInterval.current + 1000) {
            setFps(frameCount.current);
            frameCount.current = 0;
            fpsInterval.current = currentTime;
        }
    }, []);

    const normalizeHandPosition = useCallback((x, y, z = 0) => {
        const { minX, maxX, minY, maxY, centerX, centerY, deadzone } = calibrationData.current;

        // Map to calibrated range
        let normalizedX = (x - minX) / (maxX - minX);
        let normalizedY = (y - minY) / (maxY - minY);

        // Apply deadzone around center
        const dx = normalizedX - centerX;
        const dy = normalizedY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < deadzone) {
            normalizedX = centerX;
            normalizedY = centerY;
        }

        // Apply sensitivity curve
        const applySensitivity = (value) => {
            return Math.sign(value) * Math.pow(Math.abs(value), sensitivity);
        };

        // Convert to game coordinates (-1 to 1)
        const gameX = applySensitivity((normalizedX - 0.5) * 2);
        const gameY = applySensitivity((0.5 - normalizedY) * 2); // Flip Y axis
        const gameZ = z * 2; // Depth mapping

        return { x: gameX, y: gameY, z: gameZ };
    }, [sensitivity]);

    const drawLandmarks = useCallback((landmarks, handedness) => {
        if (!canvasRef.current || !showLandmarks) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Mirror context for front-facing camera
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        // Draw connections
        const connections = HandLandmarker.HAND_CONNECTIONS;
        ctx.strokeStyle = handedness === 'Right' ? '#00ff00' : '#ff0000';
        ctx.lineWidth = 2;

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            if (startPoint && endPoint) {
                ctx.beginPath();
                ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
                ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
                ctx.stroke();
            }
        });

        // Draw landmarks
        landmarks.forEach((landmark, index) => {
            const x = landmark.x * canvas.width;
            const y = landmark.y * canvas.height;

            // Different colors for different parts
            let color = '#ffffff';
            let radius = 3;

            if (index === 0) { // Wrist
                color = '#ff0000';
                radius = 5;
            } else if (index >= 1 && index <= 4) { // Thumb
                color = '#ff9900';
            } else if (index >= 5 && index <= 8) { // Index
                color = '#00ff00';
            } else if (index >= 1 && index <= 12) { // Middle
                color = '#0099ff';
            } else if (index >= 13 && index <= 16) { // Ring
                color = '#ff00ff';
            } else if (index >= 17 && index <= 20) { // Pinky
                color = '#ffff00';
            }

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            // Draw landmark number
            if (showLandmarks) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px Arial';
                ctx.fillText(index.toString(), x - 3, y - 5);
            }
        });

        ctx.restore();

        // Draw FPS counter
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.fillText(`FPS: ${fps.toFixed(1)}`, 10, 20);
        ctx.fillText(`Gesture: ${useGameStore.getState().gesture || 'None'}`, 10, 40);
        ctx.fillText(`Confidence: ${(useGameStore.getState().gestureConfidence * 100).toFixed(0)}%`, 10, 60);
    }, [showLandmarks, fps]);

    // Update calibration bounds
    const updateCalibrationBounds = useCallback((x, y) => {
        const cal = calibrationData.current;
        cal.minX = Math.min(cal.minX, x);
        cal.maxX = Math.max(cal.maxX, x);
        cal.minY = Math.min(cal.minY, y);
        cal.maxY = Math.max(cal.maxY, y);
        cal.centerX = (cal.minX + cal.maxX) / 2;
        cal.centerY = (cal.minY + cal.maxY) / 2;
    }, []);

    // Trigger game actions based on gestures
    const triggerGameAction = useCallback((gesture, confidence) => {
        if (confidence < 0.6) return;

        switch (gesture) {
            case 'fist':
                // Continuous fire while fist is held
                fireLaser('hand_controller');
                break;
            case 'pointing':
                // Single shot
                if (confidence > 0.8) {
                    fireLaser('hand_controller');
                }
                break;
            case 'peace':
                // Activate special weapon
                activatePowerUp('double_shot');
                break;
            case 'thumbs_up':
                // Health power-up
                activatePowerUp('health');
                break;
            case 'thumbs_down':
                // Pause game
                pauseGame();
                break;
            case 'ok':
                // Change weapon
                changeWeapon('next');
                break;
            case 'pinch':
                // Zoom in/aim
                setSensitivity(prev => Math.min(prev + 0.1, 1));
                break;
            case 'swipe_left':
                // Previous weapon
                changeWeapon('previous');
                break;
            case 'swipe_right':
                // Next weapon
                changeWeapon('next');
                break;
            default:
                break;
        }
    }, [fireLaser, activatePowerUp, pauseGame, changeWeapon]);

    const predictWebcam = useCallback(function predictLoop() {
        if (!handLandmarkerRef.current || !videoRef.current) return;

        const startTimeMs = performance.now();
        calculateFPS(startTimeMs);

        // Skip frames for performance
        const skipFrames = performanceMode === 'low' ? 3 :
            performanceMode === 'balanced' ? 2 : 1;

        if (frameCount.current % skipFrames !== 0) {
            animationFrameRef.current = requestAnimationFrame(predictLoop);
            return;
        }

        try {
            const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

            if (results.landmarks && results.landmarks.length > 0) {
                setHandDetected(true);

                // Get primary hand
                const primaryHandIndex = results.handedness[0][0].categoryName === 'Right' ? 0 :
                    results.landmarks.length > 1 ? 1 : 0;
                const landmarks = results.landmarks[primaryHandIndex];
                const handType = results.handedness[primaryHandIndex][0].categoryName;

                setHandedness(handType === 'Right' ? 'right' : 'left');

                // Normalize and set position
                const wrist = landmarks[0];
                const position = normalizeHandPosition(wrist.x, wrist.y, wrist.z);
                setHandPosition(position.x, position.y, position.z);

                // Detect gestures
                const detectedGesture = gestureEngine.detectGestures(landmarks, handType, useGameStore.getState().gesture);
                const smoothedGesture = gestureEngine.bufferGesture(detectedGesture);

                if (smoothedGesture) {
                    setGesture(smoothedGesture.name);
                    setGestureConfidence(smoothedGesture.confidence);

                    // Trigger game actions based on gesture
                    triggerGameAction(smoothedGesture.name, smoothedGesture.confidence);
                }

                // Store landmarks for game use
                setHandLandmarks(landmarks);

                // Draw landmarks if enabled
                if (canvasRef.current) {
                    drawLandmarks(landmarks, handType);
                }

                // Update calibration bounds dynamically
                updateCalibrationBounds(wrist.x, wrist.y);
            } else {
                setHandDetected(false);
                setGesture(null);
                setGestureConfidence(0);
            }
        } catch (error) {
            console.error("Prediction error:", error);
        }

        animationFrameRef.current = requestAnimationFrame(predictLoop);
    }, [calculateFPS, performanceMode, normalizeHandPosition, drawLandmarks, gestureEngine, setGesture, setGestureConfidence, setHandDetected, setHandLandmarks, setHandPosition, triggerGameAction, updateCalibrationBounds]);

    // Initialize MediaPipe


    // Start webcam
    const startWebcam = useCallback(async () => {
        try {
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user'
                }
            };

            streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoRef.current) {
                videoRef.current.srcObject = streamRef.current;
                await new Promise(resolve => {
                    videoRef.current.onloadedmetadata = resolve;
                });

                console.log("📹 Webcam started:", {
                    width: videoRef.current.videoWidth,
                    height: videoRef.current.videoHeight,
                    frameRate: 30
                });

                // Start prediction loop
                predictWebcam();
            }
        } catch (err) {
            console.error("❌ Webcam access error:", err);
            alert(`Camera access denied: ${err.message}\n\nPlease allow camera access to play with hand gestures.`);
        }
    }, []);

    // Start calibration
    const startCalibration = useCallback(() => {
        console.log("🎯 Starting calibration...");
        setTimeout(() => {
            setCalibrationComplete(true);
            console.log("✅ Calibration complete");
            startWebcam();
        }, 2000);
    }, [startWebcam]);

    // Normalize hand position with calibration


    // Draw landmarks on canvas


    // Calculate FPS




    // Update calibration bounds


    // Reset calibration
    const resetCalibration = useCallback(() => {
        calibrationData.current = {
            minX: 0.5,
            maxX: 0.5,
            minY: 0.5,
            maxY: 0.5,
            centerX: 0.5,
            centerY: 0.5,
            deadzone: 0.1
        };
        setCalibrationComplete(false);
        startCalibration();
    }, [startCalibration]);

    // Initialize MediaPipe - Memoized and stable
    const initializeMediaPipe = useCallback(async () => {
        if (handLandmarkerRef.current) return; // Prevent double init

        try {
            console.log("🚀 Initializing MediaPipe Hand Tracking...");

            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );

            const modelPath = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

            handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: modelPath,
                    delegate: performanceMode === 'high' ? "GPU" : "CPU"
                },
                runningMode: "VIDEO",
                numHands: 2,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            console.log("✅ MediaPipe initialized successfully");
            setLoaded(true);

            // Start calibration sequence ONLY after successful init
            startCalibration();
        } catch (error) {
            console.error("❌ MediaPipe initialization failed:", error);
            alert(`Failed to load AI Vision: ${error.message}\n\nPlease ensure:\n1. Webcam is connected\n2. Camera permissions are granted\n3. Stable internet connection`);
        }
    }, [performanceMode, startCalibration]);

    // Main cleanup and setup effect
    useEffect(() => {
        let isActive = true;

        if (isActive) {
            initializeMediaPipe();
        }

        return () => {
            isActive = false;
            // Cleanup resources
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            if (handLandmarkerRef.current) {
                try {
                    handLandmarkerRef.current.close();
                } catch (e) {
                    console.warn("Error closing landmarker", e);
                }
                handLandmarkerRef.current = null;
            }
            setLoaded(false);
        };
    }, [initializeMediaPipe]);

    // Handle performance mode changes without full re-mount loops
    useEffect(() => {
        if (loaded && handLandmarkerRef.current) {
            // If mode changes, we might need to recreate, but let's just log for now to avoid complexity in this beta fix
            console.log("Performance mode changed to:", performanceMode);
        }
    }, [performanceMode, loaded]);

    return (
        <div style={styles.container}>
            {/* Video and Canvas Overlay */}
            <div style={styles.videoContainer}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={styles.video}
                />
                <canvas
                    ref={canvasRef}
                    style={styles.canvas}
                    width={640}
                    height={480}
                />
            </div>

            {/* Control Panel */}
            <div style={styles.controlPanel}>
                <h3 style={styles.panelTitle}>🎮 Hand Controller</h3>

                <div style={styles.statusRow}>
                    <div style={styles.statusIndicator(loaded)}>
                        {loaded ? '✅ Connected' : '❌ Disconnected'}
                    </div>
                    <div style={styles.fpsDisplay}>
                        FPS: {fps}
                    </div>
                </div>

                <div style={styles.settingsSection}>
                    <label style={styles.label}>
                        Performance Mode:
                        <select
                            value={performanceMode}
                            onChange={(e) => setPerformanceMode(e.target.value)}
                            style={styles.select}
                        >
                            <option value="high">High (GPU, 60fps)</option>
                            <option value="balanced">Balanced (30fps)</option>
                            <option value="low">Low (15fps)</option>
                        </select>
                    </label>

                    <label style={styles.label}>
                        Sensitivity:
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={sensitivity}
                            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                            style={styles.slider}
                        />
                        <span style={styles.sliderValue}>{sensitivity.toFixed(1)}</span>
                    </label>

                    <label style={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={showLandmarks}
                            onChange={(e) => setShowLandmarks(e.target.checked)}
                            style={styles.checkbox}
                        />
                        Show Landmarks
                    </label>
                </div>

                <div style={styles.gestureList}>
                    <h4>Active Gestures:</h4>
                    {Object.entries(GESTURES).map(([key, gesture]) => {
                        const currentGesture = useGameStore.getState().gesture;
                        const isActive = currentGesture === gesture.name;
                        return (
                            <div
                                key={key}
                                style={styles.gestureItem(isActive)}
                            >
                                {gesture.name.replace('_', ' ')} {isActive && '✅'}
                            </div>
                        );
                    })}
                </div>

                <div style={styles.actions}>
                    <button
                        onClick={resetCalibration}
                        style={styles.button}
                    >
                        🔄 Recalibrate
                    </button>
                    <button
                        onClick={() => setShowLandmarks(!showLandmarks)}
                        style={styles.button}
                    >
                        {showLandmarks ? '👁️ Hide' : '👁️ Show'} Landmarks
                    </button>
                </div>

                {!calibrationComplete && (
                    <div style={styles.calibrationOverlay}>
                        <div style={styles.calibrationMessage}>
                            <h3>🎯 Calibration Mode</h3>
                            <p>Move your hand around the camera view to calibrate tracking...</p>
                            <div style={styles.calibrationAnimation}></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tutorial Tips */}
            <div style={styles.tutorial}>
                <h4>🎮 Gesture Controls:</h4>
                <ul style={styles.tipsList}>
                    <li>✊ <strong>Fist:</strong> Continuous Fire</li>
                    <li>👆 <strong>Pointing:</strong> Single Shot</li>
                    <li>✌️ <strong>Peace:</strong> Special Weapon</li>
                    <li>👍 <strong>Thumbs Up:</strong> Power-up</li>
                    <li>👎 <strong>Thumbs Down:</strong> Pause Game</li>
                    <li>👌 <strong>OK:</strong> Change Weapon</li>
                    <li>🤏 <strong>Pinch:</strong> Zoom/Aim</li>
                </ul>
            </div>
        </div>
    );


};

// Styles
const styles = {
    container: {
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 340,
        zIndex: 1000,
        background: 'rgba(0, 0, 20, 0.9)',
        backdropFilter: 'blur(10px)',
        borderRadius: '15px',
        border: '1px solid rgba(0, 255, 255, 0.3)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
    },
    videoContainer: {
        position: 'relative',
        width: '100%',
        height: 240,
        overflow: 'hidden',
        borderBottom: '1px solid rgba(0, 255, 255, 0.3)',
    },
    video: {
        width: '100%',
        height: '100%',
        transform: 'scaleX(-1)',
        objectFit: 'cover',
    },
    canvas: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
    },
    controlPanel: {
        padding: '15px',
    },
    panelTitle: {
        margin: '0 0 15px 0',
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#00ffff',
        textShadow: '0 0 10px rgba(0, 255, 255, 0.5)',
    },
    statusRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px',
    },
    statusIndicator: (loaded) => ({
        padding: '5px 10px',
        background: loaded ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
        border: `1px solid ${loaded ? '#00ff00' : '#ff0000'}`,
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold',
    }),
    fpsDisplay: {
        padding: '5px 10px',
        background: 'rgba(0, 150, 255, 0.2)',
        border: '1px solid #0096ff',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold',
    },
    settingsSection: {
        marginBottom: '15px',
    },
    label: {
        display: 'block',
        marginBottom: '10px',
        fontSize: '12px',
        color: '#cccccc',
    },
    select: {
        width: '100%',
        padding: '5px',
        marginTop: '5px',
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(0, 255, 255, 0.5)',
        borderRadius: '5px',
        color: '#ffffff',
    },
    slider: {
        width: '70%',
        margin: '5px 10px 5px 0',
        verticalAlign: 'middle',
    },
    sliderValue: {
        display: 'inline-block',
        width: '20%',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'center',
        marginTop: '10px',
    },
    checkbox: {
        marginRight: '8px',
    },
    gestureList: {
        marginBottom: '15px',
    },
    gestureItem: (isActive) => ({
        display: 'inline-block',
        padding: '3px 8px',
        margin: '2px',
        background: isActive ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
        border: `1px solid ${isActive ? '#00ff00' : 'rgba(255, 255, 255, 0.3)'}`,
        borderRadius: '12px',
        fontSize: '10px',
        textTransform: 'capitalize',
    }),
    actions: {
        display: 'flex',
        gap: '10px',
    },
    button: {
        flex: 1,
        padding: '8px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
    },
    calibrationOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
    },
    calibrationMessage: {
        textAlign: 'center',
        padding: '20px',
        background: 'rgba(0, 20, 40, 0.9)',
        borderRadius: '10px',
        border: '2px solid #00ffff',
    },
    calibrationAnimation: {
        width: '50px',
        height: '50px',
        margin: '20px auto',
        border: '3px solid #00ffff',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
    tutorial: {
        padding: '15px',
        background: 'rgba(0, 20, 40, 0.5)',
        borderTop: '1px solid rgba(0, 255, 255, 0.3)',
    },
    tipsList: {
        margin: 0,
        paddingLeft: '20px',
        fontSize: '11px',
        lineHeight: 1.6,
    },
};

export default HandController;
