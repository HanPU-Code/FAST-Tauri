import { useState, useEffect } from 'react';
// Tauri API is dynamically loaded on the client side
import api from '../utils/api';

export default function Home() {
  const [greetMsg, setGreetMsg] = useState('');
  const [name, setName] = useState('');
  const [serverStatus, setServerStatus] = useState('Not Running');
  const [apiResponse, setApiResponse] = useState('');
  const [sidecarLogs, setSidecarLogs] = useState([]);
  const [customEndpoint, setCustomEndpoint] = useState('/api/status');
  const [customResponse, setCustomResponse] = useState('');
  const [tauriLoaded, setTauriLoaded] = useState(false);
  const [tauriInfo, setTauriInfo] = useState('');

  // Load Tauri API dynamically
  useEffect(() => {
    const loadTauriAPI = async () => {
      if (typeof window !== 'undefined') {
        try {
          // Check if window object exists and __TAURI__ object also exists
          if (window && window.__TAURI__) {
            console.log('Tauri global object is available:', window.__TAURI__);
            // Print Tauri info
            if (window.__TAURI__.app) {
              const appName = await window.__TAURI__.app.getName();
              const appVersion = await window.__TAURI__.app.getVersion();
              setTauriInfo(`App Name: ${appName}, Version: ${appVersion}`);
            }
            setTauriLoaded(true);
            
            // Automatically start the sidecar when Tauri is loaded
            startServer();
          } else {
            console.error('Tauri global object not found');
            setTauriInfo('Tauri is not loaded. Please check if you are in a browser environment.');
          }
        } catch (e) {
          console.error('Failed to load Tauri API:', e);
          setTauriInfo(`Tauri Error: ${e.message}`);
        }
      }
    };
    
    loadTauriAPI();
  }, []);

  async function greet() {
    if (!tauriLoaded) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('greet', { name });
      setGreetMsg(result);
    } catch (e) {
      console.error('Failed to call greet function:', e);
      setGreetMsg(`Error: ${e.message}`);
    }
  }

  const startServer = async () => {
    if (!tauriLoaded) return;
    try {
      setServerStatus('Starting...');
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('Attempting to start sidecar...');
      const result = await invoke('start_sidecar');
      console.log('Sidecar start result:', result);
      setServerStatus(`Start command sent: ${result}`);
    } catch (e) {
      console.error('Failed to call startServer function:', e);
      setServerStatus(`Failed to start server: ${e}`);
    }
  };

  const stopServer = async () => {
    if (!tauriLoaded) return;
    try {
      setServerStatus('Stopping...');
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('shutdown_sidecar');
      setServerStatus(`Stop command sent: ${result}`);
    } catch (e) {
      console.error('Failed to call stopServer function:', e);
      setServerStatus(`Failed to stop server: ${e}`);
    }
  };

  const fetchApiStatus = async () => {
    if (!serverStatus.toLowerCase().includes('running') && !serverStatus.toLowerCase().startsWith('start command sent')) {
      setApiResponse('Server may not be running. Try starting it or check logs.');
      return;
    }
    
    try {
      setApiResponse('Checking API status...');
      const response = await api.getStatus();
      setApiResponse(`API status: ${JSON.stringify(response.data)}`);
      if (response.data.status === 'Backend is running') {
        setServerStatus('Running (API check complete)');
      }
    } catch (e) {
      setApiResponse(`Failed to call API: ${e.message}`);
    }
  };

  const makeCustomRequest = async () => {
    if (!serverStatus.toLowerCase().includes('running')) {
      setCustomResponse('Server is not running. Please start the server first.');
      return;
    }
    
    try {
      setCustomResponse('Processing request...');
      const response = await api.get(customEndpoint);
      setCustomResponse(`Response: ${JSON.stringify(response.data)}`);
    } catch (e) {
      setCustomResponse(`Request failed: ${e.message}`);
    }
  };

  useEffect(() => {
    const setupListeners = async () => {
      if (!tauriLoaded) return;
      
      try {
        // Import event listener from @tauri-apps/api/event
        const { listen } = await import('@tauri-apps/api/event');
        console.log('Setting up event listeners...');
        
        const unlistenStdout = await listen('sidecar-stdout', (event) => {
          console.log('Frontend received sidecar-stdout:', event.payload);
          setSidecarLogs((prevLogs) => [...prevLogs, `[STDOUT]: ${event.payload}`]);
          if (typeof event.payload === 'string' && event.payload.includes('Uvicorn running on')) {
            setServerStatus('Running (detected from logs)');
          }
        });

        const unlistenStderr = await listen('sidecar-stderr', (event) => {
          console.error('Frontend received sidecar-stderr:', event.payload);
          setSidecarLogs((prevLogs) => [...prevLogs, `[STDERR]: ${event.payload}`]);
        });

        return () => {
          unlistenStdout();
          unlistenStderr();
        };
      } catch (e) {
        console.error('Failed to set up event listeners:', e);
      }
    };

    if (tauriLoaded) {
      setupListeners();
    }
  }, [tauriLoaded]);

  return (
    <main className="container">
      <h1>Tauri + Next.js + FastAPI</h1>
      
      {tauriInfo && (
        <div className="tauri-info">
          <p>{tauriInfo}</p>
        </div>
      )}

      <div className="row">
        <a href="https://nextjs.org" target="_blank" rel="noreferrer">
          <img src="/assets/next.svg" width="80" height="80" alt="Next.js logo" />
        </a>
        <a href="https://tauri.app" target="_blank" rel="noreferrer">
          <img src="/assets/tauri.svg" width="80" height="80" alt="Tauri logo" />
        </a>
      </div>

      <div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            greet();
          }}
        >
          <input
            id="greet-input"
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name..."
          />
          <button type="submit">Greet</button>
        </form>
        <p>{greetMsg}</p>
      </div>

      <hr />
      <h2>FastAPI Sidecar Control</h2>
      <div className="row">
        <button onClick={startServer}>Start FastAPI Server</button>
        <button onClick={stopServer}>Stop FastAPI Server</button>
      </div>
      <p>Server Status: {serverStatus}</p>
      <div className="row">
        <button onClick={fetchApiStatus}>Check API Status</button>
      </div>
      <p>API Response: {apiResponse}</p>
      
      <hr />
      <h2>Direct API Call Test</h2>
      <div className="row">
        <input
          value={customEndpoint}
          onChange={(e) => setCustomEndpoint(e.target.value)}
          placeholder="API endpoint (e.g., /api/status)"
        />
        <button onClick={makeCustomRequest}>
          Call API
        </button>
      </div>
      <p>Response: {customResponse}</p>
      
      <h3>Sidecar Logs:</h3>
      <div className="logs">
        {sidecarLogs.map((log, index) => (
          <p key={index}>{log}</p>
        ))}
      </div>
    </main>
  );
} 