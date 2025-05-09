// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_http;
use serde::Deserialize;

#[derive(Deserialize, Debug)] // For deserializing options from JS
struct HttpRequestOptions {
    method: Option<String>,
    // body: Option<String>, // Add if you need to send bodies
    // headers: Option<std::collections::HashMap<String, String>>, // Add for custom headers
}

#[tauri::command]
async fn make_http_request(url: String, options: Option<HttpRequestOptions>) -> Result<String, String> {
    println!("[tauri] Received make_http_request for URL: {}", url);
    if let Some(opts) = &options {
        println!("[tauri] With options: {:?}", opts);
    }

    let client = reqwest::Client::new();
    let method = match options.as_ref().and_then(|o| o.method.as_deref()) {
        Some("POST") => reqwest::Method::POST,
        Some("PUT") => reqwest::Method::PUT,
        Some("DELETE") => reqwest::Method::DELETE,
        // Add other methods as needed
        _ => reqwest::Method::GET, // Default to GET
    };

    let mut request_builder = client.request(method, &url);

    // Example for adding body and headers if you extend HttpRequestOptions
    // if let Some(opts) = options {
    //     if let Some(body_str) = opts.body {
    //         request_builder = request_builder.body(body_str);
    //     }
    //     if let Some(headers_map) = opts.headers {
    //         for (key, value) in headers_map {
    //             request_builder = request_builder.header(&key, &value);
    //         }
    //     }
    // }

    match request_builder.send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(text) => {
                    if status.is_success() {
                        Ok(text)
                    } else {
                        Err(format!("HTTP Error: {} - {}", status, text))
                    }
                }
                Err(e) => Err(format!("Failed to get response text: {} (Status: {})", e, status)),
            }
        }
        Err(e) => Err(format!("Failed to send request: {}", e)),
    }
}

#[tauri::command]
fn toggle_fullscreen(window: tauri::Window) {
    if let Ok(is_fullscreen) = window.is_fullscreen() {
        window.set_fullscreen(!is_fullscreen).unwrap();
    }
}

// Helper function to spawn the sidecar and monitor its stdout/stderr
fn spawn_and_monitor_sidecar(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Check if a sidecar process already exists
    if let Some(state) = app_handle.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        let child_process_lock = state.lock().unwrap();
        if child_process_lock.is_some() {
            // A sidecar is already running, do not spawn a new one
            println!("[tauri] Sidecar is already running. Skipping spawn.");
            return Ok(()); // Exit early since sidecar is already running
        }
    }
    // Spawn sidecar
    // The first argument is the command name registered in tauri.conf.json under shell.scope
    // For sidecars, it's usually the binary name (without .exe) if it's in externalBin
    // or a script name from shell.scope if not a direct sidecar.
    // In your tauri.conf.json, you have: { "name": "run-api-server", "cmd": "bin/api/api.exe", "args": true }
    // However, the .sidecar() method expects the binary name directly from externalBin if it's a true sidecar.
    // Let's assume "api.exe" is the name and it's in a path Tauri can find via externalBin.
    // The `main` in `.sidecar("main")` should match the binary name in `externalBin` (without extension usually on non-Windows, with .exe for clarity if needed)
    // Your externalBin is ["bin/api/api.exe"], so "bin/api/api" or "api" might be expected depending on how Tauri resolves this.
    // Given the tauri.conf.json `externalBin: ["bin/api/api.exe"]`, using "bin/api/api" as the sidecar identifier might be more robust.
    // Or, if "main" is intended to be an alias defined elsewhere or a convention, ensure it maps to "bin/api/api.exe".
    // For simplicity, let's assume the `sidecar` method correctly resolves "api.exe" if it's named `api` in `externalBin` or if we use the path.
    // The example uses `.sidecar("main")`. Let's verify your `externalBin` setup.
    // It's `["bin/api/api.exe"]`. The `sidecar` method looks for a binary name. So, `api` or `api.exe`.
    // Let's try "api" as the sidecar name, assuming Tauri finds "bin/api/api.exe".
    let sidecar_command = app_handle
        .shell()
        .sidecar("api") // This should refer to "bin/api/api.exe"
        .map_err(|e| e.to_string())?;
    let (mut rx, child) = sidecar_command.spawn().map_err(|e| e.to_string())?;
    // Store the child process in the app state
    if let Some(state) = app_handle.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        *state.lock().unwrap() = Some(child);
    } else {
        return Err("Failed to access app state".to_string());
    }

    // Spawn an async task to handle sidecar communication
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    println!("Sidecar stdout: {}", line);
                    // Emit the line to the frontend
                    app_handle
                        .emit("sidecar-stdout", line.to_string())
                        .expect("Failed to emit sidecar stdout event");
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    eprintln!("Sidecar stderr: {}", line);
                    // Emit the error line to the frontend
                    app_handle
                        .emit("sidecar-stderr", line.to_string())
                        .expect("Failed to emit sidecar stderr event");
                }
                _ => {}
            }
        }
    });

    Ok(())
}

// Define a command to shutdown sidecar process
#[tauri::command]
fn shutdown_sidecar(app_handle: tauri::AppHandle) -> Result<String, String> {
    println!("[tauri] Received command to shutdown sidecar.");
    // Access the sidecar process state
    if let Some(state) = app_handle.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        let mut child_process_lock = state
            .lock()
            .map_err(|_| "[tauri] Failed to acquire lock on sidecar process.")?;

        if let Some(mut process) = child_process_lock.take() {
            let command_to_send = "sidecar shutdown\n"; // Ensure newline is correctly escaped for string literal then as_bytes

            // Attempt to write the command to the sidecar's stdin
            if let Err(err) = process.write(command_to_send.as_bytes()) {
                println!("[tauri] Failed to write to sidecar stdin: {}", err);
                // Restore the process reference if shutdown fails
                *child_process_lock = Some(process);
                return Err(format!("Failed to write to sidecar stdin: {}", err));
            }

            println!("[tauri] Sent 'sidecar shutdown' command to sidecar.");
            Ok("'sidecar shutdown' command sent.".to_string())
        } else {
            println!("[tauri] No active sidecar process to shutdown.");
            Err("No active sidecar process to shutdown.".to_string())
        }
    } else {
        Err("Sidecar process state not found.".to_string())
    }
}

// Define a command to start sidecar process.
#[tauri::command]
fn start_sidecar(app_handle: tauri::AppHandle) -> Result<String, String> {
    println!("[tauri] Received command to start sidecar.");
    spawn_and_monitor_sidecar(app_handle)?;
    Ok("Sidecar spawned and monitoring started.".to_string())
}

fn main() {
    tauri::Builder::default()
        // Add any necessary plugins
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Store the initial sidecar process in the app state
            app.manage(Arc::new(Mutex::new(None::<CommandChild>)));
            // Clone the app handle for use elsewhere
            let app_handle = app.handle().clone();
            // Spawn the Python sidecar on startup
            println!("[tauri] Creating sidecar on app setup...");
            if let Err(e) = spawn_and_monitor_sidecar(app_handle) {
                eprintln!("[tauri] Failed to spawn sidecar on setup: {}", e);
            }
            Ok(())
        })
        // Register the shutdown_server command
        .invoke_handler(tauri::generate_handler![
            start_sidecar,
            shutdown_sidecar,
            toggle_fullscreen,
            make_http_request
        ])
        .build(tauri::generate_context!())
        .expect("Error while running tauri application")
        .run(|app_handle, event| match event {
            // Ensure the Python sidecar is killed when the app is closed
            RunEvent::ExitRequested { .. } => {
                println!("[tauri] Exit requested. Attempting to shutdown sidecar gracefully.");
                if let Some(state) = app_handle.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
                    if let Ok(mut child_lock) = state.lock() {
                        if let Some(mut process) = child_lock.take() { // take() removes it from Option
                            let command = "sidecar shutdown\n";
                            if let Err(e) = process.write(command.as_bytes()) {
                                eprintln!("[tauri] Failed to send shutdown command to sidecar stdin: {}", e);
                                // If sending command fails, try to kill directly as a fallback
                                if let Err(kill_err) = process.kill() {
                                    eprintln!("[tauri] Failed to kill sidecar process: {}", kill_err);
                                } else {
                                    println!("[tauri] Sidecar process killed directly after stdin write failure.");
                                }
                            } else {
                                println!("[tauri] Shutdown command sent to sidecar via stdin. Process will be dropped.");
                                // Process is dropped here, which should also attempt to terminate it if not already.
                            }
                        } else {
                            println!("[tauri] No active sidecar process found during exit.");
                        }
                    } else {
                        eprintln!("[tauri] Could not acquire lock on sidecar state during exit.");
                    }
                } else {
                    eprintln!("[tauri] Sidecar state not found during exit.");
                }
            }
            _ => {}
        });
}
