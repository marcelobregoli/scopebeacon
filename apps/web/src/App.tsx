import {Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {useAuth} from './auth';
import AuthScreen from './components/AuthScreen';
import Shell from './components/Shell';
import Dashboard from './pages/Dashboard';
import ProjectPage from './pages/ProjectPage';
import SharedPage from './pages/SharedPage';
import DemoPage from './pages/DemoPage';
function PrivateArea(){const {user,loading}=useAuth();const location=useLocation();if(loading)return <div className="boot-screen"><div className="brand-mark">S</div><span>Preparing your workspace…</span></div>;if(!user)return <Navigate to="/login" replace state={{from:location.pathname}}/>;return <Shell><Routes><Route path="/" element={<Dashboard/>}/><Route path="/projects/:id" element={<ProjectPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Shell>;}
export default function App(){
 const demoOnly=import.meta.env.VITE_DEMO_ONLY==='true';
 if(demoOnly)return <Routes><Route path="/demo" element={<DemoPage demoOnly/>}/><Route path="*" element={<Navigate to="/demo" replace/>}/></Routes>;
 return <Routes><Route path="/login" element={<AuthScreen mode="login"/>}/><Route path="/signup" element={<AuthScreen mode="signup"/>}/><Route path="/share/:token" element={<SharedPage/>}/><Route path="/demo" element={<DemoPage/>}/><Route path="/*" element={<PrivateArea/>}/></Routes>;}
