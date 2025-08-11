// pages/login.tsx
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { generateCodeVerifier, generateCodeChallenge } from '../../utils/pkce';


export default function LoginPage() {
  const [codeChallenge, setCodeChallenge] = useState('');

  useEffect(() => {
    const verifier = generateCodeVerifier();
    generateCodeChallenge(verifier).then(ch => {
      // store both in cookies
      Cookies.set('pkce_verifier', verifier, { sameSite: 'lax' });
      setCodeChallenge(ch);
    });
  }, []);

  const handleLogin = () => {
    const clientId    = process.env.NEXT_PUBLIC_KICK_CLIENT_ID!;
    const redirectUri = process.env.NEXT_PUBLIC_KICK_REDIRECT_URI!;
    const state       = crypto.randomUUID();
    Cookies.set('oauth_state', state, { sameSite: 'lax' });

    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             clientId,
      redirect_uri:          redirectUri,
      scope:                 'user:read channel:read',
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
      prompt:                'login'  
    });
    window.location.href = `https://id.kick.com/oauth/authorize?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center">
      <h1 className="text-3xl text-gray-100 mb-6">Welcome to KickClips </h1>
      <button 
        onClick={handleLogin} 
        className="bg-[#00e701] hover:bg-green-500 text-black font-bold py-2 px-4 rounded"
      >
        Continue with Kick
      </button>
    </div>
  );
}
