# FAST-Tauri Project (Tauri + FastAPI + React)

This project is a Proof of Concept (POC) for building a desktop application using the Tauri framework, with a FastAPI (Python) backend and a React frontend, structured as a monorepo.

## Features Implemented So Far

*   **Monorepo Structure**: Managed with `pnpm`.
    *   `apps/backend-fastapi`: Python FastAPI backend server.
    *   `apps/frontend-react`: Tauri + React frontend application.
*   **FastAPI Backend**:
    *   Built into a single executable file (.exe) using PyInstaller.
    *   Runs with Uvicorn, serving an API on port 4040 (`/api`, `/api/status`).
    *   Implemented functionality to safely shut down by receiving a "sidecar shutdown" command via `stdin` from Tauri.
*   **Tauri + React Frontend**:
    *   Vite-based React project.
    *   Manages the FastAPI sidecar (.exe) through the Tauri Rust core (start/stop).
        *   Automatically starts the FastAPI sidecar on application launch.
        *   Automatically sends a shutdown command to the FastAPI sidecar on application exit.
    *   Direct API communication using axios:
        *   Reusable API utility module (`src/utils/api.js`)
        *   Standard HTTP methods implementation (GET, POST, PUT, DELETE)
        *   Simplified API interaction without additional layers
    *   Displays stdout/stderr logs from the FastAPI sidecar in the frontend UI.
    *   UI features to check FastAPI server status and call its API.
*   **Key Configuration Files**:
    *   `package.json` (root): Build/run scripts for the entire project and individual apps.
    *   `apps/backend-fastapi/requirements.txt`: Python dependencies.
    *   `apps/backend-fastapi/main.py`: FastAPI server logic.
    *   `apps/frontend-react/package.json`: React app dependencies.
    *   `apps/frontend-react/vite.config.js`: Vite configuration (including HTTP headers, `optimizeDeps`).
    *   `apps/frontend-react/src-tauri/Cargo.toml`: Rust dependencies (including tauri-plugin-shell, reqwest, tokio).
    *   `apps/frontend-react/src-tauri/tauri.conf.json`: Tauri configuration (including externalBin, plugins, capabilities reference).
    *   `apps/frontend-react/src-tauri/capabilities/default.json`: Tauri app permission settings.
    *   `apps/frontend-react/src-tauri/src/main.rs`: Tauri Rust logic (sidecar management, etc.).
    *   `apps/frontend-react/src/App.jsx`: React frontend UI and logic.

## Main Commands (run from the root directory)

*   **FastAPI Backend**:
    *   `pnpm backend:venv`: Create Python virtual environment.
    *   `pnpm backend:install`: Install Python dependencies (requires virtual environment).
    *   `pnpm backend:dev`: Run FastAPI development server (uvicorn, default port 8000).
    *   `pnpm backend:build`: Build FastAPI server into an .exe file (output in `apps/backend-fastapi/dist/`).
*   **React + Tauri Frontend**:
    *   `pnpm copy-sidecar:react`: Copy the built FastAPI .exe file to the React project's Tauri folder.
    *   `pnpm frontend-react:install`: Install React app dependencies.
    *   `pnpm frontend-react:dev`: Run Tauri development environment (React frontend + Rust core).

## Setup Order (For Initial Run)

1.  Setup FastAPI Backend:
    ```bash
    pnpm backend:venv
    # Activate virtual environment in PowerShell/CMD (e.g., apps\backend-fastapi\.venv\Scripts\activate.bat)
    pnpm backend:install
    pnpm backend:build
    ```
2.  Setup React + Tauri Frontend:
    ```bash
    pnpm copy-sidecar:react
    pnpm frontend-react:install
    pnpm frontend-react:dev
    ```

## HTTP Communication in React Frontend

Earlier, the project faced challenges with HTTP communication between the React frontend and the FastAPI sidecar. After exploring different approaches, a direct client-side solution was implemented using axios:

*   **Using Axios for Direct API Requests:** The `axios` library was added to the frontend to directly communicate with the FastAPI server.
*   **API Utility Module:** A dedicated utility module (`src/utils/api.js`) was created that configures an axios instance and provides wrapper functions for common HTTP methods.
*   **Benefits:**
    *   Clean architecture with no intermediate layers
    *   Standard JavaScript/TypeScript HTTP client approach familiar to web developers
    *   Straightforward error handling and response processing
    *   Easy integration with React hooks or state management libraries

This approach establishes a direct and efficient communication channel between the React frontend and the FastAPI sidecar.

## Future Plans

*   Add and integrate a Next.js frontend project.
*   Add and integrate a Svelte frontend project.
*   Manage shared packages (utilizing a `packages/` directory).
*   Explore more advanced Tauri features (menus, state management, filesystem access, etc.).
*   Test final distribution builds.

## Acknowledgements / References

This project was developed by referencing the following architectures and examples:

*   **example-tauri-v2-python-server-sidecar by @dieharders:**
    *   [https://github.com/dieharders/example-tauri-v2-python-server-sidecar](https://github.com/dieharders/example-tauri-v2-python-server-sidecar)
    *   This repository provided a valuable example of a Tauri v2 application bundling a Next.js frontend with a Python API server as a sidecar, demonstrating key concepts for sidecar management and communication.

*   **monotron by @changjoon-park:**
    *   [https://github.com/changjoon-park/monotron](https://github.com/changjoon-park/monotron)
    *   This project served as an additional reference for structuring and implementing Tauri applications with various backends. 
a