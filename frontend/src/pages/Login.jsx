import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, KeyRound, ShieldAlert } from 'lucide-react';

const Login = () => {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const action = isSignUp ? signUp : signIn;
    const { error } = await action(email, password);

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-dark-900 selection:bg-primary-500/30">
      <div className="w-full max-w-md p-8 bg-dark-800 border border-dark-700 rounded-2xl shadow-xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-dark-900 rounded-full flex items-center justify-center border border-dark-700 shadow-inner">
            <Lock className="w-8 h-8 text-primary-500" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-white mb-2">CRM Restrito</h2>
        <p className="text-sm text-center text-gray-500 mb-8">
          Acesso protegido por Criptografia AES-256
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex gap-3 items-start mb-6">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-primary-500 focus:outline-none transition-colors"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Senha (Chave Mestra)</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-primary-500 focus:outline-none transition-colors"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 flex justify-center"
          >
            {loading ? 'Aguarde...' : (isSignUp ? 'Criar Acesso Seguro' : 'Descriptografar & Entrar')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)} 
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            {isSignUp ? 'Já tenho acesso, quero Entrar' : 'Sou o dono, quero criar meu acesso'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
