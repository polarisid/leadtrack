
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    userProfile: null, 
    loading: true, 
    isAdmin: false 
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        if (db) {
          const userDocRef = doc(db, 'users', user.uid);
          
          // Use onSnapshot for real-time updates to userProfile
          const unsubscribeSnapshot = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
              const data = doc.data();
              const profile: UserProfile = {
                id: user.uid,
                name: data.name,
                email: data.email,
                role: data.role,
                status: data.status,
                groupId: data.groupId,
                createdAt: data.createdAt.toDate().toISOString(),
                dailySummary: data.dailySummary // Add dailySummary
              };
              setUserProfile(profile);
              setIsAdmin(profile.role === 'admin');
            } else {
              setUserProfile(null);
              setIsAdmin(false);
            }
             setLoading(false);
          }, (error) => {
            console.error("Error listening to user document:", error);
            setUserProfile(null);
            setIsAdmin(false);
            setLoading(false);
          });

          return () => unsubscribeSnapshot();
        }
      } else {
        // User is signed out.
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
