/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { User, UserRole, User as UserType } from './types';
import { api } from './services/api';
import AdminDashboard from './components/AdminDashboard';
import EvaluatorDashboard from './components/EvaluatorDashboard';
import { LogIn, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const u = await api.login({ email, password });
      setUser(u);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white border-2 border-black p-10 shadow-md rounded-md"
        >
          <div className="text-center mb-8">
            <GraduationCap className="w-12 h-12 mx-auto mb-4 text-zinc-900" />
            <h1 className="text-3xl font-serif italic mb-2">EvalIt</h1>
            <p className="text-zinc-500 font-sans text-sm uppercase tracking-widest font-medium">Digital Evaluation Platform</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="border-t border-zinc-100 pt-8 mb-6">
              <h2 className="text-lg font-medium text-zinc-800">Secure Sign In</h2>
            </div>
            {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 border border-red-100">{error}</div>}
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-zinc-200 focus:border-zinc-900 outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-zinc-200 focus:border-zinc-900 outline-none transition-colors"
                  required
                />
              </div>
              
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-4 bg-zinc-900 text-white font-medium disabled:opacity-50 flex justify-center items-center gap-2 transition-colors hover:bg-zinc-800"
              >
                {loading ? 'Authenticating...' : <><LogIn className="w-4 h-4" /> Sign In</>}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-zinc-900">
      <header className="border-bottom border-zinc-200 bg-white sticky top-0 z-50">
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
                onClick={() => setUser(null)}
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

