import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {api} from './api';
import type {User} from './types';
type AuthContextValue={user:User|null;loading:boolean;refresh:()=>Promise<void>;logout:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|null>(null);
export function AuthProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);
 const refresh=async()=>{try{const result=await api<{user:User}>('/api/auth/me');setUser(result.user);}catch{setUser(null);}finally{setLoading(false);}};
 useEffect(()=>{void refresh();},[]);
 const logout=async()=>{await api('/api/auth/logout',{method:'POST'});setUser(null);};
 const value=useMemo(()=>({user,loading,refresh,logout}),[user,loading]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used inside AuthProvider');return context;}
