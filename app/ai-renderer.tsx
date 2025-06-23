import React from 'react'
import ReactDOM from 'react-dom/client'
import { AI } from './components/mainbar/AI'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <AI />
  </React.StrictMode>
)
