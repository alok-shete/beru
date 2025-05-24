import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "beru";


const useName = create("");

function NameInput() {
  const [name, setName] = useName();
  return (
    <div>
      <h2>Hello, {name || "Stranger"}!</h2>
      <input value={name} onChange={e => setName(e.target.value)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<NameInput />);
