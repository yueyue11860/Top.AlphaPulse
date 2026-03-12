import { useEffect, useMemo, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';
import {
  Check,
  ChevronRight,
  LoaderCircle,
  LogOut,
  Mail,
  PencilLine,
  Shield,
  Upload,
  User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { uploadUserAvatar, removeUserAvatarByUrl } from '@/services/userProfileService';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserProfileRow } from '@/types/database';

const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AVATAR_MAX_SIZE = 2 * 1024 * 1024;

function getDisplayName(profile: UserProfileRow | null, user: SupabaseUser | null) {
  return profile?.username?.trim() || user?.user_metadata?.display_name || user?.email?.split('@')[0] || '未命名用户';
}

function getDisplayEmail(profile: UserProfileRow | null, user: SupabaseUser | null) {
  return profile?.email || user?.email || '未绑定邮箱';
}

function getAvatarFallbackLabel(profile: UserProfileRow | null, user: SupabaseUser | null) {
  const source = getDisplayName(profile, user).trim();
  if (!source) {
    return 'U';
  }

  return source.slice(0, 1).toUpperCase();
}

export function UserAccountMenu() {
  const {
    user,
    profile,
    isLoading,
    openAuthDialog,
    signOut,
    refreshProfile,
    updateProfile,
    updateAuthMetadata,
    updateAuthEmail,
    updatePassword,
  } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const displayName = useMemo(() => getDisplayName(profile, user), [profile, user]);
  const displayEmail = useMemo(() => getDisplayEmail(profile, user), [profile, user]);
  const avatarFallback = useMemo(() => getAvatarFallbackLabel(profile, user), [profile, user]);
  const currentAvatarUrl = avatarPreviewUrl || profile?.avatar_url || undefined;

  useEffect(() => {
    setUsername(profile?.username ?? user?.user_metadata?.username ?? '');
    setEmail(user?.email ?? profile?.email ?? '');
  }, [profile, user]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [avatarFile]);

  const handleOpenDialog = () => {
    setPassword('');
    setConfirmPassword('');
    setAvatarFile(null);
    setIsDialogOpen(true);
  };

  const handleAvatarSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!nextFile) {
      return;
    }

    if (!AVATAR_ACCEPTED_TYPES.includes(nextFile.type)) {
      toast.error('头像仅支持 JPG、PNG、WEBP 或 GIF 格式');
      return;
    }

    if (nextFile.size > AVATAR_MAX_SIZE) {
      toast.error('头像大小不能超过 2MB');
      return;
    }

    setAvatarFile(nextFile);
  };

  const handleSaveProfile = async () => {
    if (!user) {
      openAuthDialog();
      return;
    }

    const normalizedUsername = username.trim();
    if (normalizedUsername.length < 2 || normalizedUsername.length > 50) {
      toast.error('用户名长度需要在 2 到 50 个字符之间');
      return;
    }

    const usernameChanged = normalizedUsername !== (profile?.username ?? user.user_metadata?.username ?? '').trim();
    const avatarChanged = Boolean(avatarFile);

    if (!usernameChanged && !avatarChanged) {
      toast.info('资料未发生变化');
      return;
    }

    setIsSavingProfile(true);

    let nextAvatarUrl = profile?.avatar_url ?? null;
    const previousAvatarUrl = profile?.avatar_url ?? null;
    let uploadedAvatarUrl: string | null = null;

    try {
      if (usernameChanged) {
        const metadataUpdated = await updateAuthMetadata({ username: normalizedUsername });
        if (!metadataUpdated) {
          return;
        }
      }

      if (avatarFile) {
        nextAvatarUrl = await uploadUserAvatar(user.id, avatarFile);
        uploadedAvatarUrl = nextAvatarUrl;
      }

      await updateProfile({
        username: normalizedUsername,
        avatar_url: nextAvatarUrl,
      });

      if (avatarFile && previousAvatarUrl && previousAvatarUrl !== nextAvatarUrl) {
        try {
          await removeUserAvatarByUrl(user.id, previousAvatarUrl);
        } catch (error) {
          logger.warn('清理旧头像失败:', error);
        }
      }

      await refreshProfile();
      setAvatarFile(null);
      toast.success('个人资料已更新');
    } catch (error) {
      if (uploadedAvatarUrl) {
        try {
          await removeUserAvatarByUrl(user.id, uploadedAvatarUrl);
        } catch (cleanupError) {
          logger.warn('回滚新头像失败:', cleanupError);
        }
      }
      logger.error('保存个人资料失败:', error);
      toast.error(error instanceof Error ? error.message : '保存个人资料失败');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('请输入新的邮箱地址');
      return;
    }

    if (normalizedEmail === (user?.email ?? profile?.email ?? '').trim().toLowerCase()) {
      toast.info('邮箱地址未发生变化');
      return;
    }

    setIsSavingEmail(true);
    try {
      await updateAuthEmail(normalizedEmail);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSavePassword = async () => {
    if (password.length < 8) {
      toast.error('新密码至少需要 8 位');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    setIsSavingPassword(true);
    try {
      const updated = await updatePassword(password);
      if (updated) {
        setPassword('');
        setConfirmPassword('');
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (!user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 rounded-full pl-1 pr-2 text-muted-foreground hover:text-foreground"
        onClick={openAuthDialog}
        disabled={isLoading}
      >
        <Avatar className="size-8 border border-border/80">
          <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
            <User className="size-4" />
          </AvatarFallback>
        </Avatar>
        <span className="hidden md:inline">登录 / 注册</span>
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 gap-2 rounded-full border border-transparent pl-1.5 pr-2 text-muted-foreground hover:border-border hover:bg-accent/60 hover:text-foreground"
            disabled={isLoading}
          >
            <Avatar className="size-8 border border-border/80 shadow-sm">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-24 truncate text-sm font-medium md:inline">{displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[320px] rounded-2xl border-border/80 p-0 shadow-2xl">
          <div className="rounded-t-2xl bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(15,23,42,0))] px-4 pb-4 pt-4">
            <div className="flex items-start gap-3">
              <Avatar className="size-14 border border-border/80 shadow-sm">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 pt-1">
                <div className="truncate text-base font-semibold text-foreground">{displayName}</div>
                <div className="mt-1 truncate text-sm text-muted-foreground">{displayEmail}</div>
              </div>
            </div>
          </div>
          <Separator />
          <div className="p-2">
            <DropdownMenuItem className="rounded-xl px-3 py-3" onSelect={(event) => {
              event.preventDefault();
              handleOpenDialog();
            }}>
              <User className="size-4" />
              <span className="flex-1">用户信息</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="rounded-xl px-3 py-3"
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault();
                void signOut();
              }}
            >
              <LogOut className="size-4" />
              <span className="flex-1">退出登录</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl border-border/70 p-0 sm:max-w-[760px]" showCloseButton>
          <div className="border-b border-border bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(15,23,42,0))] px-6 py-6 sm:px-8">
            <DialogHeader className="gap-2 text-left">
              <DialogTitle className="text-2xl font-semibold">用户信息</DialogTitle>
              <DialogDescription>
                参考 GitHub 账户页组织方式，集中维护头像、显示名称、绑定邮箱与登录密码。
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 pt-5 sm:px-8">
            <Tabs defaultValue="profile" className="gap-5">
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/80 p-1">
                <TabsTrigger value="profile" className="rounded-lg">资料设置</TabsTrigger>
                <TabsTrigger value="security" className="rounded-lg">账户安全</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4">
                <Card className="gap-0 overflow-hidden rounded-2xl border-border/70">
                  <CardHeader className="gap-1 border-b border-border bg-muted/30 px-5 py-4">
                    <CardTitle className="text-base">头像与展示名称</CardTitle>
                    <CardDescription>头像会展示在导航栏和用户卡片中，用户名会同步到你的登录资料。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 px-5 py-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="size-20 border border-border shadow-sm">
                          <AvatarImage src={currentAvatarUrl} alt={displayName} />
                          <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                            {avatarFallback}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-foreground">推荐尺寸 400 x 400</div>
                          <div className="text-sm text-muted-foreground">支持 JPG、PNG、WEBP、GIF，文件大小不超过 2MB。</div>
                        </div>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent">
                        <Upload className="size-4" />
                        上传头像
                        <input type="file" accept={AVATAR_ACCEPTED_TYPES.join(',')} className="hidden" onChange={handleAvatarSelected} />
                      </label>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-username">用户名</Label>
                      <Input
                        id="profile-username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder="输入公开显示的用户名"
                      />
                      <p className="text-sm text-muted-foreground">用于导航栏、用户菜单和个人资料展示，长度限制 2 到 50 个字符。</p>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={() => void handleSaveProfile()} disabled={isSavingProfile} className="rounded-full px-5">
                        {isSavingProfile ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                        保存资料
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <Card className="gap-0 overflow-hidden rounded-2xl border-border/70">
                  <CardHeader className="gap-1 border-b border-border bg-muted/30 px-5 py-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Mail className="size-4 text-primary" />
                      绑定邮箱
                    </CardTitle>
                    <CardDescription>修改后需要前往新邮箱完成确认，确认前当前邮箱仍会继续显示。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 px-5 py-5">
                    <div className="space-y-2">
                      <Label htmlFor="profile-email">新的邮箱地址</Label>
                      <Input
                        id="profile-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="name@example.com"
                      />
                      <p className="text-sm text-muted-foreground">当前绑定邮箱：{displayEmail}</p>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => void handleSaveEmail()} disabled={isSavingEmail} className="rounded-full px-5">
                        {isSavingEmail ? <LoaderCircle className="size-4 animate-spin" /> : <PencilLine className="size-4" />}
                        更新邮箱
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="gap-0 overflow-hidden rounded-2xl border-border/70">
                  <CardHeader className="gap-1 border-b border-border bg-muted/30 px-5 py-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Shield className="size-4 text-primary" />
                      修改密码
                    </CardTitle>
                    <CardDescription>建议使用高强度密码，并避免与其他站点复用。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 px-5 py-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="profile-password">新密码</Label>
                        <Input
                          id="profile-password"
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="至少 8 位"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profile-password-confirm">确认新密码</Label>
                        <Input
                          id="profile-password-confirm"
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="再次输入新密码"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => void handleSavePassword()} disabled={isSavingPassword} className="rounded-full px-5">
                        {isSavingPassword ? <LoaderCircle className="size-4 animate-spin" /> : <Shield className="size-4" />}
                        更新密码
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}