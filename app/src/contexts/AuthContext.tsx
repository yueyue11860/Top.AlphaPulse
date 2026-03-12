import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabaseStock } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { fetchCurrentUserProfile, updateCurrentUserProfile } from '@/services/userProfileService';
import type { UserProfileRow } from '@/types/database';

interface SignUpPayload {
  username: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfileRow | null;
  session: Session | null;
  isLoading: boolean;
  isAuthDialogOpen: boolean;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  sendLoginOtp: (email: string) => Promise<boolean>;
  verifyLoginOtp: (email: string, token: string) => Promise<boolean>;
  signUpWithVerification: (payload: SignUpPayload) => Promise<boolean>;
  verifySignUpOtp: (email: string, token: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  updateProfile: (payload: Partial<Pick<UserProfileRow, 'username' | 'email' | 'avatar_url'>>) => Promise<UserProfileRow>;
  updateAuthMetadata: (payload: { username: string }) => Promise<boolean>;
  updateAuthEmail: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

  const hydrateProfile = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setProfile(null);
      return;
    }

    try {
      const nextProfile = await fetchCurrentUserProfile(nextUser.id);
      setProfile(nextProfile);
    } catch (error) {
      logger.warn('读取用户资料失败:', error);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await hydrateProfile(user);
  }, [hydrateProfile, user]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { data, error } = await supabaseStock.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        await hydrateProfile(data.session?.user ?? null);
      } catch (error) {
        logger.warn('初始化登录会话失败:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();

    const { data: subscription } = supabaseStock.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
      void hydrateProfile(nextSession?.user ?? null);

      if (nextSession?.user) {
        setIsAuthDialogOpen(false);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [hydrateProfile]);

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const closeAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(false);
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      toast.error('请输入邮箱地址');
      return false;
    }

    if (!password) {
      toast.error('请输入密码');
      return false;
    }

    try {
      const { error } = await supabaseStock.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) throw error;

      toast.success('登录成功');
      return true;
    } catch (error) {
      logger.error('邮箱密码登录失败:', error);
      toast.error(error instanceof Error ? error.message : '邮箱密码登录失败');
      return false;
    }
  }, []);

  const sendLoginOtp = useCallback(async (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      toast.error('请输入邮箱地址');
      return false;
    }

    try {
      const { error } = await supabaseStock.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      toast.success('邮箱验证码已发送');
      return true;
    } catch (error) {
      logger.error('发送登录验证码失败:', error);
      toast.error(error instanceof Error ? error.message : '发送登录验证码失败');
      return false;
    }
  }, []);

  const verifyLoginOtp = useCallback(async (email: string, token: string) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedToken = token.trim();

    if (!normalizedEmail) {
      toast.error('请输入邮箱地址');
      return false;
    }

    if (!normalizedToken) {
      toast.error('请输入邮箱验证码');
      return false;
    }

    try {
      const { error } = await supabaseStock.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: 'email',
      });

      if (error) throw error;

      toast.success('验证码登录成功');
      return true;
    } catch (error) {
      logger.error('验证码登录失败:', error);
      toast.error(error instanceof Error ? error.message : '验证码登录失败');
      return false;
    }
  }, []);

  const signUpWithVerification = useCallback(async ({ username, email, password }: SignUpPayload) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      toast.error('请输入用户名');
      return false;
    }

    if (!normalizedEmail) {
      toast.error('请输入邮箱地址');
      return false;
    }

    if (!password) {
      toast.error('请输入密码');
      return false;
    }

    try {
      const { data, error } = await supabaseStock.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            username: normalizedUsername,
            display_name: normalizedUsername,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        toast.success('注册成功，已自动登录');
        return true;
      }

      toast.success('注册验证码已发送，请前往邮箱查收');
      return true;
    } catch (error) {
      logger.error('发送注册验证码失败:', error);
      toast.error(error instanceof Error ? error.message : '发送注册验证码失败');
      return false;
    }
  }, []);

  const verifySignUpOtp = useCallback(async (email: string, token: string) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedToken = token.trim();

    if (!normalizedEmail) {
      toast.error('请输入邮箱地址');
      return false;
    }

    if (!normalizedToken) {
      toast.error('请输入邮箱验证码');
      return false;
    }

    try {
      const { error } = await supabaseStock.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: 'signup',
      });

      if (error) throw error;

      toast.success('注册成功，已完成邮箱验证');
      return true;
    } catch (error) {
      logger.error('注册验证码校验失败:', error);
      toast.error(error instanceof Error ? error.message : '注册验证码校验失败');
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabaseStock.auth.signOut();
      if (error) throw error;
      toast.success('已退出登录');
    } catch (error) {
      logger.error('退出登录失败:', error);
      toast.error('退出登录失败');
    }
  }, []);

  const updateProfile = useCallback(
    async (payload: Partial<Pick<UserProfileRow, 'username' | 'email' | 'avatar_url'>>) => {
      if (!user) {
        throw new Error('当前未登录');
      }

      const nextProfile = await updateCurrentUserProfile(user.id, payload);
      setProfile(nextProfile);
      return nextProfile;
    },
    [user]
  );

  const updateAuthEmail = useCallback(async (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      toast.error('请输入新的邮箱地址');
      return false;
    }

    try {
      const { error } = await supabaseStock.auth.updateUser({
        email: normalizedEmail,
      });

      if (error) {
        throw error;
      }

      toast.success('邮箱修改请求已提交，请前往新邮箱完成确认');
      return true;
    } catch (error) {
      logger.error('修改绑定邮箱失败:', error);
      toast.error(error instanceof Error ? error.message : '修改绑定邮箱失败');
      return false;
    }
  }, []);

  const updateAuthMetadata = useCallback(async ({ username }: { username: string }) => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      toast.error('请输入用户名');
      return false;
    }

    try {
      const { error } = await supabaseStock.auth.updateUser({
        data: {
          username: normalizedUsername,
          display_name: normalizedUsername,
        },
      });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      logger.error('更新用户资料元数据失败:', error);
      toast.error(error instanceof Error ? error.message : '更新用户名失败');
      return false;
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      toast.error('请输入新密码');
      return false;
    }

    try {
      const { error } = await supabaseStock.auth.updateUser({
        password: trimmedPassword,
      });

      if (error) {
        throw error;
      }

      toast.success('密码修改成功');
      return true;
    } catch (error) {
      logger.error('修改密码失败:', error);
      toast.error(error instanceof Error ? error.message : '修改密码失败');
      return false;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      session,
      isLoading,
      isAuthDialogOpen,
      openAuthDialog,
      closeAuthDialog,
      signInWithPassword,
      sendLoginOtp,
      verifyLoginOtp,
      signUpWithVerification,
      verifySignUpOtp,
      refreshProfile,
      updateProfile,
      updateAuthMetadata,
      updateAuthEmail,
      updatePassword,
      signOut,
    }),
    [
      closeAuthDialog,
      isAuthDialogOpen,
      isLoading,
      openAuthDialog,
      profile,
      refreshProfile,
      sendLoginOtp,
      session,
      signInWithPassword,
      signOut,
      signUpWithVerification,
      updateAuthMetadata,
      updateAuthEmail,
      updatePassword,
      updateProfile,
      user,
      verifyLoginOtp,
      verifySignUpOtp,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return context;
}