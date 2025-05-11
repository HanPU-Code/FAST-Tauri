// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::{Manager, RunEvent, Emitter};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

// Greet function implementation
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Next.js + Tauri!", name)
}

// Helper function to spawn the sidecar and monitor its stdout/stderr
fn spawn_and_monitor_sidecar(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Check if a sidecar process already exists
    if let Some(state) = app_handle.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        let child_process_lock = state.lock().unwrap();
        if child_process_lock.is_some() {
            // A sidecar is already running, do not spawn a new one
            println!("[tauri] Sidecar is already running. Not starting a new one.");
            return Ok(());
        }
    }
    
    // Spawn sidecar
    let sidecar_command = app_handle
        .shell()
        .sidecar("api") // points to "bin/api/api.exe" defined in externalBin
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
                        .expect("Failed to send sidecar stdout event");
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    eprintln!("Sidecar stderr: {}", line);
                    // Emit the error line to the frontend
                    app_handle
                        .emit("sidecar-stderr", line.to_string())
                        .expect("Failed to send sidecar stderr event");
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
    println!("[tauri] Received shutdown sidecar command.");
    // Access the sidecar process state
    if let Some(state) = app_handle.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        let mut child_process_lock = state
            .lock()
            .map_err(|_| "[tauri] Failed to acquire lock on sidecar process")?;

        if let Some(mut process) = child_process_lock.take() {
            let command_to_send = "sidecar shutdown\n";

            // Attempt to write the command to the sidecar's stdin
            if let Err(err) = process.write(command_to_send.as_bytes()) {
                println!("[tauri] Failed to write to sidecar stdin: {}", err);
                // Restore the process reference if shutdown fails
                *child_process_lock = Some(process);
                return Err(format!("Failed to write to sidecar stdin: {}", err));
            }

            println!("[tauri] Sent 'sidecar shutdown' command to sidecar.");
            Ok("'sidecar shutdown' command sent".to_string())
        } else {
            println!("[tauri] No active sidecar process to shutdown.");
            Err("No active sidecar process to shutdown".to_string())
        }
    } else {
        Err("Failed to find sidecar process state".to_string())
    }
}

// Define a command to start sidecar process
#[tauri::command]
fn start_sidecar(app_handle: tauri::AppHandle) -> Result<String, String> {
    println!("[tauri] Received start sidecar command.");
    spawn_and_monitor_sidecar(app_handle)?;
    Ok("Sidecar has been started and monitoring has started".to_string())
}

fn main() {
    tauri::Builder::default()
        // Add any necessary plugins
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Store the initial sidecar process in the app state
            app.manage(Arc::new(Mutex::new(None::<CommandChild>)));
            
            // Clone the app handle for use elsewhere
            let app_handle = app.handle().clone();
            
            // Spawn the Python sidecar on startup
            println!("[tauri] Creating sidecar on app setup...");
            if let Err(e) = spawn_and_monitor_sidecar(app_handle) {
                eprintln!("[tauri] Failed to start sidecar on app setup: {}", e);
            }
            Ok(())
        })
        // Register commands
        .invoke_handler(tauri::generate_handler![
            greet,
            start_sidecar,
            shutdown_sidecar
        ])
        .build(tauri::generate_context!())
        .expect("Error running Tauri application")
        .run(|app_handle, event| match event {
            // Ensure the sidecar is killed when the app is closed
            RunEvent::ExitRequested { .. } => {
                println!("[tauri] Exit requested. Shutting down sidecar...");
                if let Some(state) = app_handle.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
                    if let Ok(mut child_lock) = state.lock() {
                        if let Some(mut process) = child_lock.take() {
                            let command = "sidecar shutdown\n";
                            if let Err(e) = process.write(command.as_bytes()) {
                                eprintln!("[tauri] Failed to send shutdown command to sidecar stdin: {}", e);
                                // If sending command fails, try to kill directly as a fallback
                                if let Err(kill_err) = process.kill() {
                                    eprintln!("[tauri] Failed to force kill sidecar process: {}", kill_err);
                                } else {
                                    println!("[tauri] Failed to write to sidecar stdin. Sidecar process was killed directly.");
                                }
                            } else {
                                println!("[tauri] Shutdown command sent to sidecar via stdin. Process will exit.");
                            }
                        } else {
                            println!("[tauri] Failed to find active sidecar process during shutdown.");
                        }
                    } else {
                        eprintln!("[tauri] Failed to acquire lock on sidecar process during shutdown.");
                    }
                } else {
                    eprintln!("[tauri] Failed to find sidecar process state during shutdown.");
                }
            }
            _ => {}
        });
}
