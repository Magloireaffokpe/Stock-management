import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '0.875rem',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(13,27,51,0.14)',
        },
        success: { iconTheme: { primary: '#16A34A', secondary: '#fff' } },
        error:   { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
      }}
    />
  </BrowserRouter>
)
