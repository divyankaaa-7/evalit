import { useState } from 'react';
import { User, UserRole } from './types';
import AdminDashboard from './components/AdminDashboard';
import EvaluatorDashboard from './components/EvaluatorDashboard';
import Login from './components/Login';
import { GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('evalit_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('evalit_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('evalit_user');
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center font-mono text-zinc-500">Initializing EvalIt...</div>;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-zinc-900">
      <header className="border-bottom border-zinc-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6" />
            <span className="font-serif italic text-xl">EvalIt</span>
            <span className="h-4 w-[1px] bg-zinc-200 mx-2" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">{user.role} workspace</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium">{user.name}</div>
              <button 
                onClick={handleLogout}
                className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {user.role === UserRole.ADMIN ? (
            <motion.div
              key="admin"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <AdminDashboard user={user} />
            </motion.div>
          ) : (
            <motion.div
              key="eval"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <EvaluatorDashboard user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

