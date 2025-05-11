# FAST-Tauri Project (Tauri + FastAPI + React + Next.js)

This project is a Proof of Concept (POC) for building a desktop application using the Tauri framework, with a FastAPI (Python) backend and multiple frontend options (React and Next.js), structured as a monorepo.

## Features Implemented So Far

*   **Monorepo Structure**: Managed with `pnpm`.
    *   `apps/backend-fastapi`: Python FastAPI backend server.
    *   `apps/frontend-react`: Tauri + React frontend application.
    *   `apps/frontend-nextjs`: Tauri + Next.js frontend application.
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
*   **Tauri + Next.js Frontend**:
    *   Next.js based project.
    *   Similar functionality to the React frontend:
        *   Manages FastAPI sidecar through Tauri Rust core.
        *   Direct API communication using axios.
        *   Shows FastAPI server status and logs.
        *   Provides UI to control the sidecar and make API calls.
    *   Properly configured to work with Tauri in a browser-compatible way.
    *   Dynamic import of Tauri API for browser compatibility.
    *   Fixed import paths for `invoke` function from `@tauri-apps/api/core`.
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
    *   `apps/frontend-nextjs/package.json`: Next.js app dependencies.
    *   `apps/frontend-nextjs/src/pages/index.js`: Next.js frontend main page.
    *   `apps/frontend-nextjs/src/utils/api.js`: API utility module for Next.js app.
    *   `apps/frontend-nextjs/src-tauri/Cargo.toml`: Rust dependencies for Next.js app.
    *   `apps/frontend-nextjs/src-tauri/src/main.rs`: Tauri logic for Next.js app.

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
*   **Next.js + Tauri Frontend**:
    *   `pnpm copy-sidecar:nextjs`: Copy the built FastAPI .exe file to the Next.js project's Tauri folder.
    *   `pnpm frontend-nextjs:install`: Install Next.js app dependencies.
    *   `pnpm frontend-nextjs:dev`: Run Tauri development environment (Next.js frontend + Rust core).

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
3.  Setup Next.js + Tauri Frontend:
    ```bash
    pnpm copy-sidecar:nextjs
    pnpm frontend-nextjs:install
    pnpm frontend-nextjs:dev
    ```

## HTTP Communication in Frontend

The project uses a direct client-side solution with axios:

*   **Using Axios for Direct API Requests:** The `axios` library is used to directly communicate with the FastAPI server.
*   **API Utility Module:** A dedicated utility module (`src/utils/api.js`) configures an axios instance and provides wrapper functions for common HTTP methods.
*   **Benefits:**
    *   Clean architecture with no intermediate layers
    *   Standard JavaScript/TypeScript HTTP client approach familiar to web developers
    *   Straightforward error handling and response processing
    *   Easy integration with React hooks or state management libraries

## Troubleshooting: HTTP Communication

We initially attempted to use Tauri's built-in HTTP client (`@tauri-apps/api/http`) for frontend-to-backend communication, but encountered Vite module resolution issues. After exploring several solutions including routing HTTP requests through Rust commands, we ultimately chose to use axios for direct HTTP communication. This approach proved simpler, more reliable, and better aligned with standard web development practices.

## Tauri Integration Notes

*   **Importing Tauri APIs**: When using Tauri API functions like `invoke`, use the correct import path:
    ```javascript
    // Correct way to import invoke
    import { invoke } from '@tauri-apps/api/core';
    // Or dynamically:
    const { invoke } = await import('@tauri-apps/api/core');
    ```
*   **Sidecar Process Management**: The Rust backend manages sidecar processes with the `tauri-plugin-shell` crate.
*   **Event System**: The project uses Tauri's event system to communicate between the Rust backend and JavaScript frontend, especially for sidecar stdout/stderr streaming.

## Future Plans

*   Add and integrate a Svelte frontend project.
*   Manage shared packages (utilizing a `packages/` directory).
*   Explore more advanced Tauri features (menus, state management, filesystem access, etc.).
*   Test final distribution builds.
*   Upgrade Python packaging: Replace current packaging with `uv` + `pyproject.toml` for modern Python dependency management.
*   Improve cross-platform compatibility: Replace pip commands with platform-agnostic alternatives for better macOS and Linux support.

## Acknowledgements / References

This project was developed by referencing the following architectures and examples:

*   **example-tauri-v2-python-server-sidecar by @dieharders:**
    *   [https://github.com/dieharders/example-tauri-v2-python-server-sidecar](https://github.com/dieharders/example-tauri-v2-python-server-sidecar)
    *   This repository provided a valuable example of a Tauri v2 application bundling a Next.js frontend with a Python API server as a sidecar, demonstrating key concepts for sidecar management and communication.

*   **monotron by @changjoon-park:**
    *   [https://github.com/changjoon-park/monotron](https://github.com/changjoon-park/monotron)
    *   This project served as an additional reference for structuring and implementing Tauri applications with various backends.

*   **tauri-nextjs-api-routes by @srsholmes:**
    *   [https://github.com/srsholmes/tauri-nextjs-api-routes](https://github.com/srsholmes/tauri-nextjs-api-routes)
    *   This project demonstrates how to use Next.js with Tauri together, including how to handle Next.js API routes in a Tauri application and sharing code between web and desktop deployments.
