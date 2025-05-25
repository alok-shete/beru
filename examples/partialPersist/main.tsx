import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "beru";
import { persist } from "beru/persistence";

const useUser = persist(create({ name: "", email: "", age: 0 }), {
  name: "partial-user",
  partial: (state) => ({ name: state.name }),
});

function PartialPersist() {
  const [user, setUser] = useUser();
  return (
    <div
      className="is-flex is-justify-content-center is-align-items-center"
      style={{ height: "100vh" }}
    >
      <div className="box glow-border" style={{ width: "350px" }}>
        <div className="field">
          <label className="label">Name</label>
          <div className="control">
            <input
              className="input is-primary"
              value={user.name}
              onChange={(e) =>
                setUser((pre) => ({ ...pre, name: e.target.value }))
              }
              placeholder="Name"
              type="text"
            />
          </div>
        </div>

        <div className="field">
          <label className="label">Email</label>
          <div className="control">
            <input
              className="input is-primary"
              value={user.email}
              onChange={(e) =>
                setUser((pre) => ({ ...pre, email: e.target.value }))
              }
              placeholder="Email"
              type="email"
            />
          </div>
        </div>

        <h3 className="title is-5">Name: {user.name}</h3>
        <h3 className="title is-5">Email: {user.email}</h3>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <PartialPersist />
);
