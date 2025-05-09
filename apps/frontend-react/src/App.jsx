import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event"; // For listening to backend events
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  // FastAPI Sidecar state
  const [serverStatus, setServerStatus] = useState("Not Running");
  const [apiResponse, setApiResponse] = useState("");
  const [sidecarLogs, setSidecarLogs] = useState([]);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  const startServer = async () => {
    try {
      setServerStatus("Starting...");
      const result = await invoke("start_sidecar");
      setServerStatus(`Start command sent: ${result}`);
      // Actual status might be updated via events or a health check
    } catch (e) {
      setServerStatus(`Failed to start server: ${e}`);
    }
  };

  const stopServer = async () => {
    try {
      setServerStatus("Stopping...");
      const result = await invoke("shutdown_sidecar");
      setServerStatus(`Stop command sent: ${result}`); 
      // Actual status might be updated via events or a health check
    } catch (e) {
      setServerStatus(`Failed to stop server: ${e}`);
    }
  };

  const fetchApiStatus = async () => {
    // 서버 상태 체크 (Rust 로그 기반 또는 단순화된 체크)
    if (!serverStatus.toLowerCase().includes("running") && !serverStatus.toLowerCase().startsWith("start command sent")) {
        setApiResponse("Server may not be running. Try starting it or check logs.");
        return;
    }
    try {
      setApiResponse("Fetching API status via Rust...");
      const responseText = await invoke("make_http_request", { // Rust 커맨드 호출
        url: "http://127.0.0.1:4040/api/status",
        options: { method: "GET" } // 필요에 따라 options 전달
      });
      // Rust에서 문자열로 반환하므로, JSON.parse 필요
      try {
        const data = JSON.parse(responseText);
        setApiResponse(`API Status (from Rust): ${JSON.stringify(data)}`);
        if (data.status === "Backend is running") {
            setServerStatus("Running (verified by API via Rust)");
        }
      } catch (parseError) {
        setApiResponse(`Failed to parse API response from Rust: ${parseError} (Raw: ${responseText})`);
      }
    } catch (e) {
      setApiResponse(`Failed to invoke API via Rust: ${e}`);
      // setServerStatus("Running (API call via Rust failed)"); // API 호출 실패 시 상태를 어떻게 할지 결정
    }
  };

  useEffect(() => {
    const unlistenStdout = listen("sidecar-stdout", (event) => {
      console.log("Frontend received sidecar-stdout:", event.payload);
      setSidecarLogs((prevLogs) => [...prevLogs, `[STDOUT]: ${event.payload}`]);
      // You could infer server status here, e.g., if FastAPI logs "Application startup complete."
      if (typeof event.payload === 'string' && event.payload.includes("Uvicorn running on")) {
        setServerStatus("Running (detected from logs)");
      }
    });

    const unlistenStderr = listen("sidecar-stderr", (event) => {
      console.error("Frontend received sidecar-stderr:", event.payload);
      setSidecarLogs((prevLogs) => [...prevLogs, `[STDERR]: ${event.payload}`]);
      // 에러 로그를 기반으로 서버 상태를 'Error'로 설정할 수 있음
      // setServerStatus("Error (see logs)");
    });

    // Request to start server on component mount if not already started by main.rs setup
    // invoke('start_sidecar').catch(console.error); // Or manage state from Rust events

    return () => {
      unlistenStdout.then(f => f());
      unlistenStderr.then(f => f());
      // Optional: attempt to shutdown server if component unmounts and it was started by this component
      // invoke('shutdown_sidecar').catch(console.error);
    };
  }, []);

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank" rel="noreferrer">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>

      <hr />
      <h2>FastAPI Sidecar Control (via Rust)</h2>
      <div className="row">
        <button onClick={startServer} title="Rust will try to start the sidecar. It might already be running from app setup.">
            Start FastAPI Server (Invoke Rust)
        </button>
        <button onClick={stopServer}>Stop FastAPI Server (Invoke Rust)</button>
      </div>
      <p>Server Status: {serverStatus}</p>
      <div className="row">
        <button onClick={fetchApiStatus}>Fetch API Status (Invoke Rust)</button>
      </div>
      <p>API Response: {apiResponse}</p>
      
      <h3>Sidecar Logs:</h3>
      <div style={{ height: '200px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px', background: '#f9f9f9', textAlign: 'left' }}>
        {sidecarLogs.map((log, index) => (
          <p key={index} style={{ margin: '2px 0', fontSize: '0.9em', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{log}</p>
        ))}
      </div>
    </main>
  );
}

export default App;
