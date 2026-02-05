"use client";

import { useCallback, useEffect, useState } from "react";
import { getDisplayName, getOrCreateUserId, setDisplayName } from "@/lib/identity";

export function IdentityBootstrap({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [inputName, setInputName] = useState("");

  useEffect(() => {
    getOrCreateUserId(); // ensure userId exists
    if (getDisplayName() === null) setShowModal(true);
  }, []);

  const handleSave = useCallback(() => {
    const name = inputName.trim();
    if (!name) return;
    setDisplayName(name);
    setShowModal(false);
  }, [inputName]);

  return (
    <>
      {children}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: 24,
              borderRadius: 8,
              minWidth: 280,
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
          >
            <p style={{ margin: "0 0 12px", fontWeight: 600 }}>Display name</p>
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Your name"
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                marginBottom: 12,
                border: "1px solid #ccc",
                borderRadius: 4,
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!inputName.trim()}
              style={{
                padding: "8px 16px",
                cursor: inputName.trim() ? "pointer" : "not-allowed",
                backgroundColor: "#0066cc",
                color: "#fff",
                border: "none",
                borderRadius: 4,
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </>
  );
}
