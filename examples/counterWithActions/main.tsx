import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "beru";

const useCount = create({ count: 0 });

const useCountWithActions = useCount.withActions(({ set }) => ({
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: s.count - 1 })),
}));

export default function CounterWithActions() {
  const count = useCountWithActions((state) => state.count);
  console.log("count", count);
  const { increment, decrement } = useCountWithActions();
  return (
    <div
      className="is-flex is-justify-content-center is-align-items-center"
      style={{ height: "100vh" }}
    >
      <div className="box has-text-centered">
        <h2 className="title is-3">Count: {count}</h2>
        <div className="buttons is-centered">
          <button className="button is-primary" onClick={() => increment()}>
            -
          </button>
          <button className="button is-primary" onClick={() => decrement()}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <CounterWithActions />
);
