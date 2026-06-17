import { useState, useEffect } from "react";
import { auth, signInWithGoogle as firebaseSignIn, signOut as firebaseSignOut, onAuthStateChanged } from "../services/firebase";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(localStorage.getItem("ecomind_session"));
  const [isAnonymous, setIsAnonymous] = useState(!user);

  useEffect(() => {
    if (!auth) return;
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsAnonymous(false);
        // Replace UUID session_id with Firebase uid
        localStorage.setItem("ecomind_session", firebaseUser.uid);
        setSessionId(firebaseUser.uid);
      } else {
        setUser(null);
        setIsAnonymous(true);
        // On sign-out or no user: ensure we have a UUID session
        let currentSession = localStorage.getItem("ecomind_session");
        // If the current session is a Firebase UID (which we don't want after signout), 
        // or doesn't exist, we generate a new UUID.
        // Actually, the simplest is to just generate a new one on explicit sign out, 
        // but here we just ensure a valid one exists.
        if (!currentSession) {
          currentSession = crypto.randomUUID();
          localStorage.setItem("ecomind_session", currentSession);
        }
        setSessionId(currentSession);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await firebaseSignIn();
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut();
      // On explicit sign out, generate a new UUID session
      const newSession = crypto.randomUUID();
      localStorage.setItem("ecomind_session", newSession);
      setSessionId(newSession);
      setIsAnonymous(true);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return { user, signInWithGoogle, signOut, sessionId, isAnonymous };
};
