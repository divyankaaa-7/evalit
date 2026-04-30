import { useState } from 'react';
import { GraduationCap, LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';
import { api } from '../services/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await api.login(id, password);
      onLogin(user);
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <GraduationCap className="w-12 h-12 mx-auto mb-4 text-zinc-900" />
          <h1 className="text-4xl font-serif italic mb-2">EvalIt</h1>
          <p className="text-zinc-500 font-sans text-xs uppercase tracking-[0.3em] font-bold">Digital Evaluation Platform</p>
        </div>

        <div className="bg-white border border-zinc-200 p-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-zinc-900"></div>
          
          <h2 className="text-xl font-medium mb-8 text-zinc-800">Identity Authentication</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">ID / Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <input 
                  type="text" 
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="admin_evalit@gmail.com"
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-100 focus:border-zinc-900 focus:bg-white outline-none transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-100 focus:border-zinc-900 focus:bg-white outline-none transition-all text-sm"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-red-500 text-xs bg-red-50 p-3 border border-red-100"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-zinc-900 text-white text-sm font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : <><LogIn className="w-4 h-4" /> Sign In to Workspace</>}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-zinc-50 text-center">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest">
              Authorized Personnel Only
            </p>
          </div>
        </div>
        
        <p className="mt-8 text-center text-zinc-400 text-[10px] uppercase tracking-[0.2em]">
          &copy; 2024 EvalIt Systems. High Precision Evaluation.
        </p>
      </motion.div>
    </div>
  );
}
