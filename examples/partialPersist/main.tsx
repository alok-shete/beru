import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "beru";
import { persist } from "beru/persistence";

const useUser = persist(create({ name: "", email: "", age: 0 }), {
  name: "partial-user",
  partial: (state) => ({ name: state.name }), // only store `name`
});

function PartialPersist() {
  const [user, setUser] = useUser();
  return (
    <div>
      <input
        value={user.name}
        onChange={(e) => setUser((pre) => ({ ...pre, name: e.target.value }))}
        placeholder="Name"
      />
      <input
        value={user.email}
        onChange={(e) => setUser((pre) => ({ ...pre, email: e.target.value }))}
        placeholder="Email"
      />
      <h3>Name: {user.name}</h3>
      <h3>Email: {user.email}</h3>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <PartialPersist />
);
