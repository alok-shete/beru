import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "beru";
import { persist } from "beru/persistence";

const useName = persist(create(""), { name: "user-name" });

function PersistentName() {
  const [name, setName] = useName();

  return (
    <div
      className="is-flex is-justify-content-center is-align-items-center"
      style={{ height: "100vh" }}
    >
      <div className="box glow-border" style={{ width: "350px" }}>
        <h2 className="title is-4 has-text-centered">
          Your name is persisted: {name || "Stranger"}
        </h2>
        <div className="field">
          <div className="control">
            <input
              className="input is-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              type="text"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <PersistentName />
);
