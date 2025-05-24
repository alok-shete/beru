import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "beru";

const useCount = create({ count: 0 });

const useCountWithActions = useCount.withActions(({ set }) => ({
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: s.count - 1 })),
}));

export default function CounterWithActions() {
  const { count, increment, decrement } = useCountWithActions();
  return (
    <div>
      <h2>Count: {count}</h2>
      <button onClick={decrement}>-</button>
      <button onClick={increment}>+</button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <CounterWithActions />
);
