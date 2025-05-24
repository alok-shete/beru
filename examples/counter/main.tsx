import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "beru";

const useCounter = create({ count: 0 });

function Counter() {
  const [state, setState] = useCounter();
  return (
    <div className="text-center">
      <h2 className="text-2xl">Count: {state.count}</h2>
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={() => setState((s) => ({ count: s.count - 1 }))}
      >
        -
      </button>
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={() => setState((s) => ({ count: s.count + 1 }))}
      >
        +
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Counter />);
