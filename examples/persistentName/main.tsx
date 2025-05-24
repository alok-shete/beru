import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "beru";
import { persist } from "beru/persistence";



const useName = persist(create(""), { name: "user-name" });

function PersistentName() {
  const [name, setName] = useName();
  return (
    <div>
      <h2>Your name is persisted: {name}</h2>
      <input value={name} onChange={e => setName(e.target.value)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<PersistentName />);
