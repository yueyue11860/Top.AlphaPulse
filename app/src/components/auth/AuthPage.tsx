import { useMemo, useState } from 'react';
import { Brain, KeyRound, Mail, ShieldCheck, TrendingUp, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Badge } from '@/components/ui/badge';

interface AuthPageProps {
  title: string;
  description: string;
  onDismiss: () => void;
  dismissLabel?: string;
}

type AuthMode = 'login' | 'register';
type LoginMethod = 'password' | 'otp';

export function AuthPage({ title, description, onDismiss, dismissLabel = '返回' }: AuthPageProps) {
  const {
    signInWithPassword,
    sendLoginOtp,
    verifyLoginOtp,
    signUpWithVerification,
    verifySignUpOtp,
    isLoading: authLoading,
  } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginOtpCode, setLoginOtpCode] = useState('');
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerOtpCode, setRegisterOtpCode] = useState('');
  const [registerOtpSent, setRegisterOtpSent] = useState(false);

  const registerPasswordMismatch = useMemo(() => {
    if (!registerConfirmPassword) return false;
    return registerPassword !== registerConfirmPassword;
  }, [registerConfirmPassword, registerPassword]);

  const handlePasswordLogin = async () => {
    setIsSubmitting(true);
    try {
      await signInWithPassword(loginEmail, loginPassword);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendLoginOtp = async () => {
    setIsSubmitting(true);
    try {
      const success = await sendLoginOtp(loginEmail);
      if (success) {
        setLoginOtpSent(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyLoginOtp = async () => {
    setIsSubmitting(true);
    try {
      await verifyLoginOtp(loginEmail, loginOtpCode);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendRegisterOtp = async () => {
    if (registerPassword !== registerConfirmPassword) {
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await signUpWithVerification({
        username: registerUsername,
        email: registerEmail,
        password: registerPassword,
      });

      if (success) {
        setRegisterOtpSent(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyRegisterOtp = async () => {
    setIsSubmitting(true);
    try {
      await verifySignUpOtp(registerEmail, registerOtpCode);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-9rem)] rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_32%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(17,24,39,0.92))] p-4 text-white shadow-2xl sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <section className="flex min-h-[420px] flex-col justify-between rounded-[24px] border border-white/10 bg-white/6 p-6 backdrop-blur sm:p-8">
          <div className="space-y-5">
            <Badge className="w-fit border-white/15 bg-white/10 px-3 py-1 text-white hover:bg-white/10">TOP.AlphaPulse 账号中心</Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
              <p className="max-w-xl text-sm leading-6 text-slate-200 sm:text-base">{description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" />
                <div className="text-sm font-medium">账号隔离</div>
                <div className="mt-1 text-xs leading-5 text-slate-300">自选股、预警、AI 结果与个人身份绑定。</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <Brain className="mb-3 h-5 w-5 text-sky-300" />
                <div className="text-sm font-medium">智能工作台</div>
                <div className="mt-1 text-xs leading-5 text-slate-300">登录后才能启用智能选股、AI 分析与资讯联动。</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <TrendingUp className="mb-3 h-5 w-5 text-amber-300" />
                <div className="text-sm font-medium">跨端延续</div>
                <div className="mt-1 text-xs leading-5 text-slate-300">同一邮箱可在多端恢复个人配置与关注列表。</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span>注册需要用户名、密码、确认密码、邮箱与邮箱验证码。</span>
            <span>登录支持邮箱密码或邮箱验证码。</span>
          </div>
        </section>

        <Card className="border-white/10 bg-white text-slate-950 shadow-2xl">
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl">登录 / 注册</CardTitle>
            <CardDescription>
              使用邮箱账号继续访问受限功能。若你的 Supabase Auth 未开启邮箱 OTP 与邮箱确认，验证码流程不会生效。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as AuthMode)} className="gap-5">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">登录</TabsTrigger>
                <TabsTrigger value="register">注册</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-5">
                <Tabs value={loginMethod} onValueChange={(value) => setLoginMethod(value as LoginMethod)} className="gap-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="password">邮箱 + 密码</TabsTrigger>
                    <TabsTrigger value="otp">邮箱 + 验证码</TabsTrigger>
                  </TabsList>

                  <TabsContent value="password" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email-password">邮箱</Label>
                      <Input
                        id="login-email-password"
                        type="email"
                        value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)}
                        placeholder="name@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">密码</Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={loginPassword}
                        onChange={(event) => setLoginPassword(event.target.value)}
                        placeholder="请输入密码"
                      />
                    </div>
                    <Button className="w-full gap-2" onClick={() => void handlePasswordLogin()} disabled={isSubmitting || authLoading}>
                      <KeyRound className="h-4 w-4" />
                      邮箱密码登录
                    </Button>
                  </TabsContent>

                  <TabsContent value="otp" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email-otp">邮箱</Label>
                      <Input
                        id="login-email-otp"
                        type="email"
                        value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)}
                        placeholder="name@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>邮箱验证码</Label>
                      <InputOTP maxLength={6} value={loginOtpCode} onChange={setLoginOtpCode}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button variant="outline" className="gap-2" onClick={() => void handleSendLoginOtp()} disabled={isSubmitting || authLoading}>
                        <Mail className="h-4 w-4" />
                        {loginOtpSent ? '重新发送验证码' : '发送验证码'}
                      </Button>
                      <Button className="gap-2" onClick={() => void handleVerifyLoginOtp()} disabled={isSubmitting || authLoading}>
                        <ShieldCheck className="h-4 w-4" />
                        验证码登录
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">用户名</Label>
                  <Input
                    id="register-username"
                    value={registerUsername}
                    onChange={(event) => setRegisterUsername(event.target.value)}
                    placeholder="请输入用户名"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">邮箱</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="register-password">密码</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerPassword}
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      placeholder="至少 6 位"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password">确认密码</Label>
                    <Input
                      id="register-confirm-password"
                      type="password"
                      value={registerConfirmPassword}
                      onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                      placeholder="再次输入密码"
                    />
                  </div>
                </div>
                {registerPasswordMismatch ? (
                  <div className="text-sm text-red-500">两次输入的密码不一致。</div>
                ) : null}
                <div className="space-y-2">
                  <Label>邮箱验证码</Label>
                  <InputOTP maxLength={6} value={registerOtpCode} onChange={setRegisterOtpCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => void handleSendRegisterOtp()}
                    disabled={isSubmitting || authLoading || registerPasswordMismatch}
                  >
                    <UserRound className="h-4 w-4" />
                    {registerOtpSent ? '重新发送验证码' : '发送注册验证码'}
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => void handleVerifyRegisterOtp()}
                    disabled={isSubmitting || authLoading || registerPasswordMismatch}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    完成注册
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
              <div className="text-xs leading-5 text-slate-500">
                登录后可继续使用智能选股、AI 分析、资讯中心与自选股功能。
              </div>
              <Button variant="ghost" onClick={onDismiss}> 
                {dismissLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}