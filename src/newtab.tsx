import { Toaster } from "react-hot-toast"

import Dashboard from "./newtab/components/Dashboard"

import "./newtab/fonts.css"
import "./style.css"

export default function NewTab() {
  return (
    <div className="min-h-screen font-sans">
      <Dashboard />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#1f2937",
            color: "#f3f4f6",
            fontSize: "14px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)"
          }
        }}
      />
    </div>
  )
}
