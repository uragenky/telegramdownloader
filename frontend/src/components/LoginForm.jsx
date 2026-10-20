import React, { useState, useEffect } from 'react';
import './LoginForm.css';

function LoginForm({ onLogin }) {
  const [loginMethod, setLoginMethod] = useState('qr'); // Default to QR code
  const [step, setStep] = useState('loading'); // 'loading', 'config', 'choice', 'qr', 'phone', 'code', 'password'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [qrExpires, setQrExpires] = useState(null);
  const [checkingQR, setCheckingQR] = useState(false);

  // Telegram API configuration states
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    checkApiConfig();
  }, []);

  const checkApiConfig = async () => {
    try {
      const res = await fetch('/api/auth/config');
      const data = await res.json();
      setIsConfigured(data.configured);
      if (data.configured) {
        setStep('choice');
      } else {
        setStep('config');
      }
    } catch (err) {
      console.error('Failed to check API config:', err);
      setStep('choice');
    }
  };

  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId: apiId.trim(), apiHash: apiHash.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setIsConfigured(true);
        setStep('choice');
      } else {
        setError(data.error || 'Gagal menyimpan kredensial API Telegram');
      }
    } catch (err) {
      setError('Koneksi jaringan bermasalah saat menyimpan API.');
    } finally {
      setLoading(false);
    }
  };

  const handleQRLogin = async () => {
    setLoading(true);
    setError('');
    setStep('qr');

    try {
      const response = await fetch('/api/auth/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.authenticated) {
          setSessionId(data.sessionId);
          onLogin(data.sessionId);
        } else {
          setSessionId(data.sessionId);
          setQrCode(data.qrCode);
          setQrExpires(data.expires);
          setCheckingQR(true);
          pollQRStatus(data.sessionId);
        }
      } else {
        setError(data.error || 'Gagal membuat QR Code login');
        setStep('choice');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan.');
      setStep('choice');
    } finally {
      setLoading(false);
    }
  };

  const pollQRStatus = async (sid) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/auth/qr/status/${sid}`);
        const data = await response.json();
        
        if (data.authenticated) {
          setCheckingQR(false);
          onLogin(sid);
          return true;
        } else if (data.status === 'expired' || data.needsRefresh) {
          setCheckingQR(false);
          setError('QR code telah kedaluwarsa. Silakan coba lagi.');
          setStep('choice');
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error checking QR status:', err);
        return false;
      }
    };

    const intervalId = setInterval(async () => {
      if (await checkStatus()) {
        clearInterval(intervalId);
      }
    }, 2000);

    setTimeout(() => {
      clearInterval(intervalId);
      setCheckingQR(false);
      setError('Batas waktu QR code habis. Silakan coba lagi.');
      setStep('choice');
    }, 300000);
  };

  const handlePhoneLogin = () => {
    setLoginMethod('phone');
    setStep('phone');
    setError('');
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSessionId(data.sessionId);
        setStep('code');
      } else {
        setError(data.error || 'Gagal mengirim kode verifikasi');
      }
    } catch (err) {
      setError('Koneksi jaringan bermasalah.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        onLogin(sessionId);
      } else if (data.step === 'password_required') {
        setStep('password');
        setError('Akun ini mengaktifkan verifikasi 2 langkah (2FA). Masukkan kata sandi Anda.');
      } else {
        setError(data.error || 'Kode verifikasi salah');
      }
    } catch (err) {
      setError('Koneksi jaringan bermasalah.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        onLogin(sessionId);
      } else {
        setError(data.error || 'Kata sandi salah');
      }
    } catch (err) {
      setError('Koneksi jaringan bermasalah.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="login-form-container">
        <div className="login-form card" style={{ textAlign: 'center' }}>
          <span className="loading"></span>
          <p style={{ marginTop: '15px', color: '#666' }}>Memeriksa konfigurasi Telegram...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-form-container">
      <div className="login-form card">
        <h2>{step === 'config' ? 'Konfigurasi Telegram API' : 'Login ke Telegram'}</h2>
        <p className="subtitle">
          {step === 'config' 
            ? 'Masukkan Telegram API ID & Hash untuk menghubungkan aplikasi' 
            : 'Akses channel film dan download langsung ke browser Anda'}
        </p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* STEP: CONFIG (TELEGRAM API CREDENTIALS) */}
        {step === 'config' && (
          <form onSubmit={handleConfigSubmit}>
            <div className="form-group">
              <label>Telegram API ID</label>
              <input
                type="number"
                className="input"
                placeholder="Contoh: 12345678"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                required
                disabled={loading}
              />
              <small>Angka numerik API ID dari my.telegram.org</small>
            </div>

            <div className="form-group">
              <label>Telegram API HASH</label>
              <input
                type="text"
                className="input"
                placeholder="Contoh: 0123456789abcdef0123456789abcdef"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                required
                disabled={loading}
              />
              <small>String 32 karakter API HASH</small>
            </div>

            <p className="help-text" style={{ fontSize: '12px', color: '#718096', marginBottom: '15px' }}>
              💡 Cara mendapatkan kredensial: Login di <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce' }}>my.telegram.org</a> dengan nomor Telegram Anda, lalu klik menu <strong>API development tools</strong>.
            </p>

            <button 
              type="submit" 
              className="btn btn-primary full-width"
              disabled={loading || !apiId || !apiHash}
            >
              {loading ? <span className="loading"></span> : 'Simpan & Lanjutkan'}
            </button>

            {isConfigured && (
              <button 
                type="button" 
                className="btn btn-secondary full-width mt-10"
                onClick={() => setStep('choice')}
              >
                Batal
              </button>
            )}
          </form>
        )}

        {/* STEP: CHOICE (QR OR PHONE) */}
        {step === 'choice' && (
          <div className="login-choice">
            <button 
              className="btn btn-primary full-width"
              onClick={handleQRLogin}
              disabled={loading}
            >
              {loading ? <span className="loading"></span> : '📱 Login via Scan QR Code (Cepat)'}
            </button>
            <div className="divider">ATAU</div>
            <button 
              className="btn btn-secondary full-width"
              onClick={handlePhoneLogin}
            >
              📞 Login via Nomor Telepon
            </button>

            <p className="help-text" style={{ marginTop: '20px', fontSize: '13px', color: '#666' }}>
              <strong>Scan QR Code:</strong> Buka aplikasi Telegram di HP Anda → Masuk ke <strong>Pengaturan (Settings)</strong> → <strong>Perangkat (Devices)</strong> → <strong>Tautkan Perangkat Desktop</strong>, lalu arahkan kamera ke layar.
            </p>

            <div style={{ marginTop: '25px', textAlign: 'center', borderTop: '1px solid #edf2f7', paddingTop: '15px' }}>
              <button 
                type="button" 
                onClick={() => setStep('config')}
                style={{ background: 'none', border: 'none', color: '#718096', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ⚙️ Ubah Pengaturan API ID / Hash
              </button>
            </div>
          </div>
        )}

        {/* STEP: QR CODE DISPLAY */}
        {step === 'qr' && (
          <div className="qr-login">
            {qrCode && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <img src={qrCode} alt="QR Code" style={{ maxWidth: '280px', border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }} />
                </div>
                <p style={{ textAlign: 'center', fontSize: '15px', marginBottom: '10px' }}>
                  <strong>Arahkan kamera Telegram ke QR Code ini</strong>
                </p>
                <ol style={{ fontSize: '13px', color: '#666', maxWidth: '320px', margin: '0 auto', textAlign: 'left', lineHeight: '1.6' }}>
                  <li>Buka Telegram di HP Anda</li>
                  <li>Buka <strong>Pengaturan → Perangkat</strong></li>
                  <li>Pilih <strong>Tautkan Perangkat Desktop</strong></li>
                </ol>
                {checkingQR && (
                  <p style={{ textAlign: 'center', marginTop: '18px', color: '#3182ce', fontSize: '14px' }}>
                    <span className="loading"></span> Menunggu scan QR code...
                  </p>
                )}
                <button 
                  type="button" 
                  className="btn btn-secondary full-width mt-10"
                  onClick={() => {
                    setStep('choice');
                    setQrCode('');
                    setCheckingQR(false);
                    setError('');
                  }}
                  style={{ marginTop: '20px' }}
                >
                  Kembali ke Pilihan Login
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP: PHONE INPUT */}
        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit}>
            <div className="form-group">
              <label>Nomor Telepon</label>
              <input
                type="tel"
                className="input"
                placeholder="+628123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading}
              />
              <small>Gunakan kode negara (misal +62 untuk Indonesia)</small>
            </div>
            <button 
              type="submit" 
              className="btn btn-primary full-width"
              disabled={loading || !phone}
            >
              {loading ? <span className="loading"></span> : 'Kirim Kode Masuk'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary full-width mt-10"
              onClick={() => {
                setStep('choice');
                setError('');
              }}
            >
              Kembali
            </button>
          </form>
        )}

        {/* STEP: VERIFICATION CODE */}
        {step === 'code' && (
          <form onSubmit={handleCodeSubmit}>
            <div className="form-group">
              <label>Kode Verifikasi</label>
              <input
                type="text"
                className="input"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={loading}
              />
              <small>Masukkan kode yang dikirimkan ke aplikasi Telegram Anda ({phone})</small>
            </div>
            <button 
              type="submit" 
              className="btn btn-primary full-width"
              disabled={loading || !code}
            >
              {loading ? <span className="loading"></span> : 'Verifikasi'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary full-width mt-10"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
            >
              Ganti Nomor
            </button>
          </form>
        )}

        {/* STEP: 2FA PASSWORD */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label>Kata Sandi 2FA (Two-Factor)</label>
              <input
                type="password"
                className="input"
                placeholder="Masukkan kata sandi 2FA"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <small>Akun Anda mengaktifkan perlindungan 2-Step Verification</small>
            </div>
            <button 
              type="submit" 
              className="btn btn-primary full-width"
              disabled={loading || !password}
            >
              {loading ? <span className="loading"></span> : 'Masuk'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary full-width mt-10"
              onClick={() => {
                setStep('choice');
                setPhone('');
                setError('');
              }}
            >
              Batal
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginForm;
