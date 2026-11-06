import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { portalApi, PortalApiError, setPortalToken } from './client';
import type { PortalAccount } from './model';

type Mode='login'|'register'|'verify'|'forgot'|'reset';
export function PortalAuth({onLogin,resetToken,onResetConsumed}:{onLogin:(account:PortalAccount)=>void;resetToken:string|null;onResetConsumed:()=>void}) {
  const [mode,setMode]=useState<Mode>(resetToken?'reset':'login');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState('');
  const [contactName,setContactName]=useState(''),[phone,setPhone]=useState(''),[code,setCode]=useState('');
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[cooldown,setCooldown]=useState(0);
  const [resetCooldown,setResetCooldown]=useState(0);
  const lock=useRef(false);
  useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
  useEffect(()=>{if(!resetCooldown)return;const timer=setTimeout(()=>setResetCooldown(value=>Math.max(0,value-1)),1000);return()=>clearTimeout(timer);},[resetCooldown]);
  function changeMode(next:Mode){setMode(next);setError('');setMessage('');setPassword('');setConfirmPassword('');setCode('');if(mode==='reset')onResetConsumed();}
  async function run(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');try{await action();}catch(err){
    if(err instanceof PortalApiError&&err.code==='PORTAL_VERIFICATION_DELIVERY_FAILED'){setMode('verify');setPassword('');}
    if(err instanceof PortalApiError&&err.status===429&&mode==='verify')setCooldown(60);
    setError((err as Error).message);
  }finally{lock.current=false;setBusy(false);}}
  const title={login:'Đăng nhập doanh nghiệp',register:'Tạo tài khoản',verify:'Xác minh email',forgot:'Quên mật khẩu',reset:'Đặt lại mật khẩu'}[mode];
  return <div className="portal-auth-layout">
    <section className="portal-intro">
      <div className="portal-badge-wrap">
        <span className="portal-eyebrow portal-pill-badge">SME • CỔNG DOANH NGHIỆP</span>
      </div>
      <h1 className="portal-hero-title">Khởi đầu nhu cầu vốn của doanh nghiệp</h1>
      <p className="portal-hero-desc">Khai thông tin, chuẩn bị tài liệu và gửi đề nghị vay trực tuyến. Bạn có thể lưu nháp và tiếp tục bất cứ lúc nào.</p>
      <div className="portal-intro-note portal-trust-box">
        <CheckCircle2 size={20} color="#0D9488" className="portal-trust-icon" />
        <span>Hồ sơ của bạn được quản lý riêng trong tài khoản doanh nghiệp.</span>
      </div>
    </section>

    <section className="portal-card portal-auth">
      <h2>{title}</h2>
      <p className="portal-card-subtitle">{mode==='register'?'Nhập email để nhận mã xác minh và bắt đầu chuẩn bị đề nghị vay.':mode==='verify'?'Nhập mã 6 chữ số được gửi đến email bên dưới. Bạn có thể dán toàn bộ mã.':mode==='forgot'?'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.':mode==='reset'?'Tạo mật khẩu mới để đăng nhập lại. Liên kết có hiệu lực 10 phút và chỉ dùng một lần.':'Đăng nhập bằng email đã xác minh để tiếp tục hồ sơ của bạn.'}</p>
      <form onSubmit={e=>{e.preventDefault();void run(async()=>{
        if(mode==='login'){
          const result=await portalApi.post<{accessToken:string;account:PortalAccount}>('/auth/login',{email:email.trim(),password});
          setPortalToken(result.accessToken);onLogin(result.account);
        }else if(mode==='register'){
          const result=await portalApi.post<{message:string}>('/auth/register',{email:email.trim(),password,contactName:contactName.trim(),phone:phone.trim()});
          setMode('verify');setPassword('');setMessage(result.message);
        }else if(mode==='verify'){
          await portalApi.post('/auth/verify-email',{email:email.trim(),code:code.trim()});setMode('login');setCode('');setMessage('Email đã được xác minh. Bạn có thể đăng nhập.');
        }else if(mode==='forgot'){
          const result=await portalApi.post<{message:string}>('/auth/forgot-password',{email:email.trim()});setMessage(result.message);setResetCooldown(60);
        }else{
          if(password!==confirmPassword)throw Error('Hai mật khẩu chưa khớp nhau.');
          const result=await portalApi.post<{message:string}>('/auth/reset-password',{token:resetToken,password,confirmPassword});
          setPassword('');setConfirmPassword('');setMode('login');onResetConsumed();setMessage(result.message);
        }
      });}}>
        {mode!=='reset'&&<label className="portal-field"><span className="portal-field-label">Email</span><input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
        {mode==='register'&&<><label className="portal-field"><span className="portal-field-label">Người liên hệ</span><input required maxLength={200} value={contactName} onChange={e=>setContactName(e.target.value)}/></label><label className="portal-field"><span className="portal-field-label">Số điện thoại</span><input required type="tel" maxLength={20} value={phone} onChange={e=>setPhone(e.target.value)}/></label></>}
        {mode==='login'&&<div className="portal-field"><div className="portal-field-header"><label htmlFor="portal-password-input" className="portal-field-label">Mật khẩu</label><button type="button" className="portal-link-inline" disabled={busy} onClick={()=>changeMode('forgot')}>Quên mật khẩu?</button></div><input id="portal-password-input" required type="password" maxLength={72} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></div>}
        {mode==='register'&&<label className="portal-field"><span className="portal-field-label">Mật khẩu</span><input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><small className="portal-field-hint">Tối thiểu 8 ký tự, gồm chữ và số; tối đa 72 byte.</small></label>}
        {mode==='reset'&&<label className="portal-field"><span className="portal-field-label">Mật khẩu mới</span><input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><small className="portal-field-hint">Tối thiểu 8 ký tự, gồm chữ và số; tối đa 72 byte.</small></label>}
        {mode==='reset'&&<label className="portal-field"><span className="portal-field-label">Nhập lại mật khẩu mới</span><input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>}
        {mode==='verify'&&<label className="portal-field"><span className="portal-field-label">Mã xác minh</span><input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value)}/></label>}
        {error&&<p className="portal-error" role="alert">{error}</p>}{message&&<p className="portal-notice" role="status">{message}</p>}
        <button className="btn btn-primary" disabled={busy||(mode==='forgot'&&resetCooldown>0)}>{busy?'Đang xử lý…':mode==='forgot'?(resetCooldown?`Gửi lại sau ${resetCooldown}s`:'Gửi liên kết đặt lại'):mode==='reset'?'Đặt lại mật khẩu':mode==='login'?'Đăng nhập':mode==='register'?'Đăng ký':'Xác minh email'}</button>
      </form>
      <div className="portal-auth-links">
        {mode==='login'&&(
          <>
            <div className="portal-auth-divider" />
            <button type="button" className="btn btn-outline-portal" disabled={busy} onClick={()=>changeMode('register')}>Tạo tài khoản doanh nghiệp</button>
            <button type="button" className="portal-link portal-link-verify" disabled={busy} onClick={()=>changeMode('verify')}>Xác minh email</button>
          </>
        )}
        {mode!=='login'&&(
          <>
            <div className="portal-auth-divider" />
            <button type="button" className="btn btn-outline-portal" disabled={busy} onClick={()=>changeMode('login')}>Quay lại đăng nhập</button>
            {mode!=='verify'&&<button type="button" className="portal-link portal-link-verify" disabled={busy} onClick={()=>changeMode('verify')}>Xác minh email</button>}
            {mode==='verify'&&<button type="button" className="portal-link portal-link-verify" disabled={busy||!email.trim()||cooldown>0} onClick={()=>void run(async()=>{const result=await portalApi.post<{message:string}>('/auth/resend-verification',{email:email.trim()});setMessage(result.message);setCooldown(60);})}>{cooldown?`Gửi lại sau ${cooldown}s`:'Gửi lại mã xác minh'}</button>}
            {mode==='reset'&&<button type="button" className="portal-link portal-link-verify" disabled={busy} onClick={()=>changeMode('forgot')}>Yêu cầu liên kết mới</button>}
          </>
        )}
      </div>
    </section>
  </div>;
}
