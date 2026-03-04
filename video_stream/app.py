from flask import Flask, Response
import cv2, time, atexit, os

app = Flask(__name__)

CAMERA_URL = os.getenv("CAMERA_URL", "0")
camera = cv2.VideoCapture(int(CAMERA_URL)) if CAMERA_URL.isdigit() else cv2.VideoCapture(CAMERA_URL)

def gen_frames():
    while True:
        ok, frame = camera.read()
        if not ok:
            time.sleep(0.05)
            continue
        ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if not ret:
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        time.sleep(0.03)  # ~30fps

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/')
def index():
    return "Camera stream running at /video_feed"

def cleanup():
    try:
        camera.release()
    except:
        pass

atexit.register(cleanup)
