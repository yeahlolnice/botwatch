import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerWebMcpTools } from './webmcp.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Dogfood WebMCP — expose botwatch's own agent-callable tools (no-op without WebMCP).
registerWebMcpTools()
