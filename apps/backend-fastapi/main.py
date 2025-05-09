from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import sys
import threading
import os

app = FastAPI(title="FAST Tauri Backend")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 배포 시에는 프론트엔드 주소로 제한해야 함.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api")
async def read_root():
    return {"message": "Hello from FAST Tauri Backend!"}

@app.get("/api/status")
async def get_status():
    return {"status": "Backend is running", "version": "1.0.0"}

def listen_for_shutdown_command():
    print("[FastAPI] Stdin listener for shutdown command started.", flush=True)
    for line in sys.stdin:
        print(f"[FastAPI] Received from stdin: {line.strip()}", flush=True)
        if line.strip() == "sidecar shutdown":
            print("[FastAPI] Shutdown command received. Exiting...", flush=True)
            # A more graceful shutdown for uvicorn might be needed if running programmatically
            # For a PyInstaller .exe, os._exit might be acceptable.
            os._exit(0) # Force exit the process

if __name__ == "__main__":
    # Start the stdin listener in a separate thread
    # So it doesn't block uvicorn
    shutdown_thread = threading.Thread(target=listen_for_shutdown_command, daemon=True)
    shutdown_thread.start()

    print("[FastAPI] Starting uvicorn server.", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=4040) 