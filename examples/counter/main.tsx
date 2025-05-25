import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "beru";

const useCounter = create({ count: 0 });

function Counter() {
  const [state, setState] = useCounter();
  return (
    <div
      className="is-flex is-justify-content-center is-align-items-center"
      style={{ height: "100vh" }}
    >
      <div className="box has-text-centered">
        <h2 className="title is-3">Count: {state.count}</h2>
        <div className="buttons is-centered">
          <button
            className="button is-primary"
            onClick={() => setState((s) => ({ count: s.count - 1 }))}
          >
            -
          </button>
          <button
            className="button is-primary"
            onClick={() => setState((s) => ({ count: s.count + 1 }))}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Counter />);
