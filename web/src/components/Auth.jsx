import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  auth
} from "../firebase";

function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (isNew) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <div className="auth">
      <h2>{isNew ? "Create account" : "Sign in"}</h2>
      <form onSubmit={submit}>
        <input
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          required
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">{isNew ? "Create" : "Sign in"}</button>
      </form>
      <button className="link" onClick={() => setIsNew(!isNew)}>
        {isNew ? "Already have an account? Sign in" : "Create an account"}
      </button>
      <p className="error">{err}</p>
    </div>
  );
}

export default Auth;
