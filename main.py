import cv2
import numpy as np
import time
import math
from collections import deque
from ultralytics import YOLO
from datetime import datetime

# --- CONFIGURATION ---
class Config:
    MODEL_NAME = 'yolo11n-pose.pt'  # Will auto-download
    CONFIDENCE = 0.5
    FALL_THRESHOLD = 45  # Degrees inclination
    SQUAT_THRESHOLD = 110 # Degrees for knee bend
    UI_COLOR = (0, 255, 255) # Cyberpunk Yellow
    ALERT_COLOR = (0, 0, 255) # Red

# --- MATHEMATICAL UTILITIES ---
class Geometry:
    @staticmethod
    def calculate_angle(a, b, c):
        """Calculates angle between three points (a, b, c)"""
        a = np.array(a) # First
        b = np.array(b) # Mid
        c = np.array(c) # End
        
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        
        if angle > 180.0:
            angle = 360-angle
        return angle

# --- MAIN SYSTEM ---
class TitanPoseSystem:
    def __init__(self):
        print(f"🚀 Initializing TitanPose with {Config.MODEL_NAME}...")
        self.model = YOLO(Config.MODEL_NAME)
        
        # Camera Setup
        self.cap = cv2.VideoCapture(0)
        self.cap.set(3, 1280)
        self.cap.set(4, 720)
        
        # Analytics State
        self.squat_state = {}  # Tracks "UP" or "DOWN" for each person ID
        self.squat_count = {}  # Tracks count for each ID
        self.alert_timer = 0
        self.current_alert = ""

    def draw_cyberpunk_hud(self, image, fps):
        """Draws a futuristic overlay"""
        h, w, _ = image.shape
        
        # 1. Side Bars (Transparent)
        overlay = image.copy()
        cv2.rectangle(overlay, (0, 0), (250, h), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.4, image, 0.6, 0, image)
        
        # 2. Border Lines
        cv2.line(image, (250, 0), (250, h), Config.UI_COLOR, 2)
        
        # 3. System Stats
        cv2.putText(image, "TITAN OS v2.0", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, Config.UI_COLOR, 2)
        cv2.putText(image, f"FPS: {int(fps)}", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 1)
        cv2.putText(image, f"MODE: ACTIVE", (20, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 1)
        
        # 4. Alert Box
        if self.current_alert and self.alert_timer > 0:
            cv2.rectangle(image, (w//2 - 200, 50), (w//2 + 200, 150), (0,0,0), -1)
            cv2.rectangle(image, (w//2 - 200, 50), (w//2 + 200, 150), Config.ALERT_COLOR, 2)
            cv2.putText(image, "WARNING", (w//2 - 60, 90), cv2.FONT_HERSHEY_SIMPLEX, 1, Config.ALERT_COLOR, 2)
            cv2.putText(image, self.current_alert, (w//2 - 150, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)
            self.alert_timer -= 1
        else:
            self.current_alert = ""

    def process_pose(self, image, results):
        """Analyzes skeleton, counts squats, detects falls"""
        if len(results) == 0 or results[0].keypoints is None:
            return image

        boxes = results[0].boxes
        keypoints = results[0].keypoints.data
        
        # Check if we have tracking IDs (required for counting)
        if boxes.id is None:
            ids = [-1] * len(boxes) # Fallback if no tracking
        else:
            ids = boxes.id.cpu().numpy().astype(int)

        for i, kps in enumerate(keypoints):
            person_id = ids[i]
            kps = kps.cpu().numpy() # Convert to numpy
            
            # --- INDEX MAPPING (COCO) ---
            # 5: L-Shoulder, 6: R-Shoulder, 11: L-Hip, 12: R-Hip
            # 13: L-Knee, 14: R-Knee, 15: L-Ankle, 16: R-Ankle
            
            if len(kps) < 17: continue

            # 1. Get Coordinates
            l_shldr, r_shldr = kps[5][:2], kps[6][:2]
            l_hip, r_hip = kps[11][:2], kps[12][:2]
            l_knee, r_knee = kps[13][:2], kps[14][:2]
            l_ankle, r_ankle = kps[15][:2], kps[16][:2]
            
            # 2. Draw Skeleton (Neon Style)
            for point in [l_shldr, r_shldr, l_hip, r_hip, l_knee, r_knee]:
                if point[0] > 0 and point[1] > 0:
                    cv2.circle(image, (int(point[0]), int(point[1])), 6, Config.UI_COLOR, -1)

            # 3. ANALYSIS: FALL DETECTION (Body Inclination)
            # Midpoint of shoulders vs Midpoint of hips
            mid_shoulder = (l_shldr + r_shldr) / 2
            mid_hip = (l_hip + r_hip) / 2
            
            # Calculate angle of torso vs vertical axis
            dx = mid_shoulder[0] - mid_hip[0]
            dy = mid_shoulder[1] - mid_hip[1]
            inclination = abs(math.degrees(math.atan2(dx, dy)))
            
            # If torso is horizontal (> 45 degrees deviation from vertical)
            if inclination > Config.FALL_THRESHOLD:
                self.current_alert = f"FALL DETECTED (ID {person_id})"
                self.alert_timer = 30
                
            # 4. ANALYSIS: SQUAT COUNTER
            # Calculate Knee Angle (Hip -> Knee -> Ankle)
            # Using Right Leg for calculation
            knee_angle = Geometry.calculate_angle(r_hip, r_knee, r_ankle)
            
            # Initialize ID stats
            if person_id not in self.squat_state:
                self.squat_state[person_id] = "UP"
                self.squat_count[person_id] = 0
            
            # Logic
            if knee_angle < Config.SQUAT_THRESHOLD:
                self.squat_state[person_id] = "DOWN"
            if knee_angle > 160 and self.squat_state[person_id] == "DOWN":
                self.squat_state[person_id] = "UP"
                self.squat_count[person_id] += 1
            
            # 5. Draw Info on Person
            cx, cy = int(l_shldr[0]), int(l_shldr[1]) - 30
            
            # Draw Count
            cv2.putText(image, f"Squats: {self.squat_count[person_id]}", (cx, cy), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Draw Angle (Debugging)
            cv2.putText(image, f"{int(knee_angle)} deg", (int(r_knee[0]), int(r_knee[1])), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

        return image

    def run(self):
        prev_time = 0
        
        while True:
            success, frame = self.cap.read()
            if not success: break
            
            # 1. Run YOLO Tracking
            # persist=True is CRITICAL for counting squats over time
            results = self.model.track(frame, persist=True, verbose=False, conf=Config.CONFIDENCE)
            
            # 2. Draw HUD (Background)
            current_time = time.time()
            fps = 1 / (current_time - prev_time)
            prev_time = current_time
            self.draw_cyberpunk_hud(frame, fps)
            
            # 3. Process Pose & Draw Skeleton
            frame = self.process_pose(frame, results)
            
            # 4. Show Result
            cv2.imshow("TitanPose Advanced", frame)
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
        self.cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    try:
        app = TitanPoseSystem()
        app.run()
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        print("Tip: Make sure you installed: pip install ultralytics")