import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Qadha from './Qadha.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Qadha />
  </StrictMode>,
)
