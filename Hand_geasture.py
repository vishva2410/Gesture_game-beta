import cv2
import mediapipe as mp
import time 

cap = cv2.VideoCapture(0)
mpHands = mp.solutions.hands
hands = mpHands.Hands(max_num_hands=2)
mpDraw = mp.solutions.drawing_utils
mpPose = mp.solutions.pose
pose = mpPose.Pose()
pTime = 0

while True:
    success, img = cap.read()
    if not success:
        break

    imgRGB = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = hands.process(imgRGB)
    results2 = pose.process(imgRGB)
    if results2.pose_landmarks:
      mpDraw.draw_landmarks(img, results2.pose_landmarks, mpPose.POSE_CONNECTIONS)
      for id,lm in enumerate(results2.pose_landmarks.landmark):
          h, w, c = img.shape
          cx, cy = int(lm.x * w), int(lm.y * h)
          print(id,gcx,cy)
          cv2. circle(img, (cx, cy), 5, (255, 0, 0), cv2.FILLED)

    if results.multi_hand_landmarks:
        for handLms in results.multi_hand_landmarks:
            mpDraw.draw_landmarks(img, handLms, mpHands.HAND_CONNECTIONS)

    cTime = time.time()
    fps = 1 / (cTime - pTime + 1e-6) 
    pTime = cTime
    cv2.putText(img, f'FPS: {int(fps)}', (450, 70), cv2.FONT_HERSHEY_SIMPLEX,
                2, (0, 255, 0), 3)

    cv2.imshow("Image", img)

    if cv2.waitKey(1) & 0xFF == ord('e'):
        break

cap.release()
cv2.destroyAllWindows()
