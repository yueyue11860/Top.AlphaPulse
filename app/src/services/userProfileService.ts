import type { UserProfileRow } from '@/types/database';
import { supabaseStock } from '@/lib/supabase';

const USER_AVATAR_BUCKET = 'user-avatars';

type UserProfileUpdatePayload = Pick<UserProfileRow, 'username' | 'email' | 'avatar_url'>;

interface UserProfileUpdateQuery {
  update: (values: Partial<UserProfileUpdatePayload>) => {
    eq: (column: 'user_id', value: string) => {
      select: (columns: string) => {
        single: () => Promise<{ data: UserProfileRow; error: unknown }>;
      };
    };
  };
}

export async function fetchCurrentUserProfile(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabaseStock
    .from('user_profiles')
    .select('user_id, username, email, avatar_url, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCurrentUserProfile(
  userId: string,
  updates: Partial<UserProfileUpdatePayload>
): Promise<UserProfileRow> {
  const profileQuery = supabaseStock.from('user_profiles') as unknown as UserProfileUpdateQuery;

  const { data, error } = await profileQuery
    .update(updates)
    .eq('user_id', userId)
    .select('user_id, username, email, avatar_url, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? 'png' : 'png';
  const path = `${userId}/avatar-${Date.now()}.${extension}`;

  const { error } = await supabaseStock.storage
    .from(USER_AVATAR_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabaseStock.storage.from(USER_AVATAR_BUCKET).getPublicUrl(path);

  return publicUrl;
}

export async function removeUserAvatarByUrl(userId: string, avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl) {
    return;
  }

  const marker = `/${USER_AVATAR_BUCKET}/`;
  const markerIndex = avatarUrl.indexOf(marker);
  if (markerIndex === -1) {
    return;
  }

  const path = avatarUrl.slice(markerIndex + marker.length);
  if (!path.startsWith(`${userId}/`)) {
    return;
  }

  const { error } = await supabaseStock.storage.from(USER_AVATAR_BUCKET).remove([path]);

  if (error) {
    throw error;
  }
}