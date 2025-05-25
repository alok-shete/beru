import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "beru";

const useName = create("");

function NameInput() {
  const [name, setName] = useName();

  return (
    <div
      className="is-flex is-justify-content-center is-align-items-center"
      style={{ height: "100vh" }}
    >
      <div
        className="box has-text-centered glow-border"
        style={{ width: "300px" }}
      >
        <h2 className="title is-4">Hello, {name || "Stranger"}!</h2>
        <input
          className="input is-primary"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
        />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<NameInput />);
