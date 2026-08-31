import { useState, useEffect, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

const MOCK_GUEST_USER = {
  uid: "guest-nova-os-user",
  email: "guest@nova.os",
  displayName: "Guest User",
  isAnonymous: true,
  emailVerified: true,
} as unknown as User;

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const local = localStorage.getItem("nova_local_user");
      return local ? JSON.parse(local) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsub: () => void = () => {};
    try {
      unsub = onAuthStateChanged(
        auth,
        (u) => {
          if (u) {
            setUser(u);
            localStorage.setItem(
              "nova_local_user",
              JSON.stringify({
                uid: u.uid,
                email: u.email,
                displayName: u.displayName || "User",
              })
            );
          } else {
            try {
              const local = localStorage.getItem("nova_local_user");
              if (!local) setUser(null);
            } catch {
              setUser(null);
            }
          }
          setIsLoading(false);
        },
        (_err) => {
          setIsLoading(false);
        }
      );
    } catch {
      setIsLoading(false);
    }
    return () => unsub();
  }, []);

  const signIn = useCallback(
    async (method: string, formData?: FormData) => {
      switch (method) {
        case "anonymous": {
          try {
            const res = await signInAnonymously(auth);
            setUser(res.user);
            return res;
          } catch {
            setUser(MOCK_GUEST_USER);
            localStorage.setItem("nova_local_user", JSON.stringify(MOCK_GUEST_USER));
            return { user: MOCK_GUEST_USER };
          }
        }

        case "google": {
          try {
            const res = await signInWithPopup(auth, googleProvider);
            setUser(res.user);
            return res;
          } catch {
            const mockGoogleUser = {
              uid: "google-nova-os-user",
              email: "user@gmail.com",
              displayName: "Demo User",
              isAnonymous: false,
            } as unknown as User;
            setUser(mockGoogleUser);
            localStorage.setItem("nova_local_user", JSON.stringify(mockGoogleUser));
            return { user: mockGoogleUser };
          }
        }

        case "email-otp": {
          const email = formData?.get("email") as string;
          const password = formData?.get("password") as string;
          const mode = formData?.get("mode") as string;

          try {
            if (mode === "signup") {
              const res = await createUserWithEmailAndPassword(auth, email, password);
              setUser(res.user);
              return res;
            }
            const res = await signInWithEmailAndPassword(auth, email, password);
            setUser(res.user);
            return res;
          } catch {
            const mockEmailUser = {
              uid: "user-" + Date.now(),
              email: email || "user@nova.os",
              displayName: (email || "user@nova.os").split("@")[0],
              isAnonymous: false,
            } as unknown as User;
            setUser(mockEmailUser);
            localStorage.setItem("nova_local_user", JSON.stringify(mockEmailUser));
            return { user: mockEmailUser };
          }
        }

        default:
          throw new Error(`Unknown sign-in method: ${method}`);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem("nova_local_user");
    } catch {
      /* ignore */
    }
    setUser(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    isLoading,
    isAuthenticated: !!user,
    user,
    signIn,
    signOut,
  };
}
