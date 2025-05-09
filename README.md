# Monotauri Project (Tauri + FastAPI + React)

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
    *   Controls the sidecar and relays HTTP requests via Tauri commands defined in Rust.
        *   `start_sidecar`: Requests to start the sidecar.
        *   `shutdown_sidecar`: Requests to shut down the sidecar.
        *   `make_http_request`: Sends HTTP requests to the FastAPI server via Rust and returns the result.
    *   Displays stdout/stderr logs from the FastAPI sidecar in the frontend UI.
    *   UI features to check FastAPI server status and call its API.
*   **Key Configuration Files**:
    *   `package.json` (root): Build/run scripts for the entire project and individual apps.
    *   `apps/backend-fastapi/requirements.txt`: Python dependencies.
    *   `apps/backend-fastapi/main.py`: FastAPI server logic.
    *   `apps/frontend-react/package.json`: React app dependencies.
    *   `apps/frontend-react/vite.config.js`: Vite configuration (including HTTP headers, `optimizeDeps`).
    *   `apps/frontend-react/src-tauri/Cargo.toml`: Rust dependencies (including tauri-plugin-shell, tauri-plugin-http, reqwest, tokio).
    *   `apps/frontend-react/src-tauri/tauri.conf.json`: Tauri configuration (including externalBin, plugins, capabilities reference).
    *   `apps/frontend-react/src-tauri/capabilities/default.json`: Tauri app permission settings.
    *   `apps/frontend-react/src-tauri/src/main.rs`: Tauri Rust logic (sidecar management, HTTP relay command, etc.).
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

## Key Issue Resolved: HTTP Communication in React Frontend

A significant challenge encountered was enabling HTTP communication from the React frontend (specifically, using `fetch` from `@tauri-apps/api/http`) to the FastAPI sidecar.

**Initial Approach & Problem:**
The initial attempt was to have the React components directly import and use `fetch` from `@tauri-apps/api/http` to make API calls to the FastAPI server running as a sidecar. However, this consistently resulted in a Vite build/dev server error: `Failed to resolve import "@tauri-apps/api/http" from "src/App.jsx"`.

**Troubleshooting Steps Undertaken:**

1.  **Verified `@tauri-apps/api` Installation:** Confirmed that `@tauri-apps/api` (which includes the `http` module) was correctly listed in `apps/frontend-react/package.json` and that `pnpm install` completed successfully.
2.  **Vite Configuration (`vite.config.js`):**
    *   Added Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP) headers to the Vite development server's `server.headers` configuration, as recommended by Tauri documentation for enabling certain browser features.
    *   Explicitly included `@tauri-apps/api/http` (and other related API modules) in `optimizeDeps.include` to aid Vite's dependency pre-bundling.
3.  **Tauri Configuration (`tauri.conf.json`):**
    *   Adjusted `plugins.http` settings (initially with a `scope`, then as an empty object `{}`, and finally removed entirely from `plugins` to defer to capabilities).
    *   Added `http:default` permission to `apps/frontend-react/src-tauri/capabilities/default.json` and ensured `tauri.conf.json` referenced these capabilities via `app.security.capabilities`.
4.  **Rust Backend (Tauri Core):**
    *   Added `tauri-plugin-http` as a dependency in `apps/frontend-react/src-tauri/Cargo.toml`.
    *   Initialized the HTTP plugin in `apps/frontend-react/src-tauri/src/main.rs` using `.plugin(tauri_plugin_http::init())`.
5.  **Node Modules & Cache:** Performed complete removal of `node_modules` and `pnpm-lock.yaml` in the `apps/frontend-react` directory, followed by a fresh `pnpm install`, to rule out caching or corrupted dependency issues.

**Resolution - Relaying HTTP Requests via Rust:**

Despite the above efforts, the Vite module resolution error for `@tauri-apps/api/http` persisted.

To overcome this and ensure stable communication, the approach was modified:

*   **Removed Direct HTTP Calls from React:** The `import { fetch } from "@tauri-apps/api/http";` and its direct usage were removed from `App.jsx`.
*   **Created a Rust Command for HTTP Requests:** A new Tauri command, `make_http_request`, was implemented in `main.rs`. This Rust function uses the `reqwest` crate to perform HTTP requests to the FastAPI sidecar. It takes the URL and request options (like method) as arguments from the frontend.
*   **Invoking Rust Command from React:** The React frontend now calls `invoke("make_http_request", { url: "...", options: {...} })` to send API requests. The Rust command handles the actual HTTP communication and returns the response (or error) as a string to the frontend, which then parses it (e.g., `JSON.parse`) if necessary.

This revised architecture successfully bypasses the Vite module resolution issue and establishes reliable communication between the React frontend and the FastAPI sidecar, mediated by the Tauri Rust core. While it introduces an extra step (Rust मध्यस्थ), it provides a robust solution and centralizes HTTP request logic within the Rust backend if desired.

## Future Plans

*   Add and integrate a Next.js frontend project.
*   Add and integrate a Svelte frontend project.
*   Manage shared packages (utilizing a `packages/` directory).
*   Explore more advanced Tauri features (menus, state management, filesystem access, etc.).
*   Test final distribution builds.

  ## Acknowledgements / References

This project was developed by referencing the following a
rchitectures and examples:

*   **example-tauri-v2-python-server-sidecar by @dieharders:**
    *   [https://github.com/dieharders/example-tauri-v2-python-server-sidecar](https://github.com/dieharders/example-tauri-v2-python-server-sidecar)
    *   This repository provided a valuable example of a Tauri v2 application bundling a Next.js frontend with a Python API server as a sidecar, demonstrating key concepts for sidecar management and communication.

*   **monotron by @changjoon-park:**
    *   [https://github.com/changjoon-park/monotron](https://github.com/changjoon-park/monotron)
    *   This project served as an inspiration or a reference point (details of reference can be added if specific aspects were used).
