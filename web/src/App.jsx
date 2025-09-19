import React, { useEffect, useState } from "react";
import Auth from "./components/Auth";
import ProjectView from "./components/ProjectView";
import { auth, onAuthStateChanged, db, doc, getDoc, setDoc } from "./firebase";

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Ensure user doc exists
        const profileRef = doc(db, "users", u.uid);
        const snap = await getDoc(profileRef);
        if (!snap.exists()) {
          await setDoc(profileRef, {
            displayName: u.displayName || null,
            email: u.email,
            isPaid: false,
            createdAt: new Date()
          });
          setProfile({ email: u.email, isPaid: false });
        } else {
          setProfile(snap.data());
        }
      } else {
        setProfile(null);
      }
    });
    return unsub;
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Scheduler — Simple Gantt-like App</h1>
      </header>

      <main>
        {!user ? (
          <Auth />
        ) : (
          <ProjectView user={user} profile={profile} />
        )}
      </main>

      <footer>
        <small>Built with ❤️ — host data in Firestore, charge with Stripe</small>
      </footer>
    </div>
  );
}
