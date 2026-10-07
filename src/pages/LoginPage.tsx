import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

export const LoginPage: React.FC = () => {
  const { login } = useAdmin();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const res = await login(username, password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Invalid credentials. Please verify your email/username and password.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F6F5F2] flex items-center justify-center p-4 sm:p-6 lg:p-12 font-sans select-none">
      <div className="w-full max-w-md lg:max-w-5xl bg-white rounded-3xl sm:rounded-[40px] p-6 sm:p-10 lg:p-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center shadow-xs">
        
        {/* Left Side: Clean Minimal Login Form (6 cols on lg) */}
        <div className="w-full lg:col-span-6 flex flex-col justify-center">
          
          {/* Logo & Brand Name */}
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <img 
              src="/serbisure_new_clean.png" 
              alt="SerbiSure" 
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/serbisure-logo.png';
              }}
            />
            <span className="text-xl sm:text-2xl font-black font-display text-[#0D0D11] tracking-tight">
              Serbi<span className="text-[#FFB380]">Sure</span><span className="text-[#FFB380]">.</span>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-display text-[#0D0D11] leading-tight tracking-tight">
              Welcome<br />Back
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-2 font-medium">
              Access your barangay administrative dashboard
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-rose-50 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md w-full">
            {/* Username / Email Input */}
            <div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Email or Username"
                className="w-full px-5 py-3.5 sm:py-4 bg-[#F0F0EC] rounded-full text-sm text-[#0D0D11] placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 transition-all font-medium border-0"
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-5 pr-12 py-3.5 sm:py-4 bg-[#F0F0EC] rounded-full text-sm text-[#0D0D11] placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 transition-all font-medium border-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-600 font-semibold">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FFB380] focus:ring-[#FFB380] border-0 bg-[#F0F0EC] cursor-pointer"
                />
                <span>Remember me</span>
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-44 mt-2 py-3.5 sm:py-4 px-8 bg-[#FFB380] hover:bg-[#F5A066] text-white font-black font-display text-sm rounded-full transition-all flex items-center justify-center cursor-pointer disabled:opacity-60 border-0 shadow-xs active:scale-95"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

        </div>

        {/* Right Side: Hero Image (Visible on lg desktop screens only) */}
        <div className="hidden lg:flex lg:col-span-6 items-center justify-center">
          <div className="w-full aspect-[4/5] rounded-[32px] overflow-hidden bg-[#F0F0EC]">
            <img
              src="/login-hero.jpg"
              alt="SerbiSure Kasambahay and Family"
              className="w-full h-full object-cover object-center"
            />
          </div>
        </div>

      </div>
    </div>
  );
};

