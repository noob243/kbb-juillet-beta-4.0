import { AppUser, CreateUserPayload, UserRole } from '../types/rbac';
import { DEFAULT_ROLE_PERMISSIONS } from './rbacService';
import { supabase, secondarySupabase } from '../lib/supabase';

const LOCAL_STORAGE_KEY = 'kbb_users_db_v2';

export function getLocalUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Error reading users from local storage:", err);
    return [];
  }
}

export function saveLocalUsers(users: AppUser[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error("Error saving users to local storage:", err);
  }
}

export async function syncUsersWithFirestore(onUpdate: (users: AppUser[]) => void): Promise<() => void> {
  // In Supabase, we'll fetch profiles and their permissions
  const fetchUsers = async () => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(`
        *,
        user_permissions (feature_id)
      `);

    if (error) {
      console.warn("Supabase profiles fetch failed, using local storage:", error);
      onUpdate(getLocalUsers());
      return;
    }

    const appUsers: AppUser[] = profiles.map((p: any) => ({
      id: p.id,
      email: p.email,
      fullName: `${p.first_name} ${p.last_name}`,
      role: p.is_admin ? 'Admin' : 'Avocat', // Simplified for now
      userType: 'Avocat', // Default
      hasAppAccess: p.is_active,
      permissions: p.user_permissions?.map((up: any) => up.feature_id) || [],
      status: p.is_active ? 'Actif' : 'Inactif',
      phone: p.phone,
      photoUrl: p.avatar_url,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));

    saveLocalUsers(appUsers);
    onUpdate(appUsers);
  };

  fetchUsers();

  // Real-time subscription to profiles
  const channel = supabase
    .channel('public:profiles')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      fetchUsers();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function createNewUser(payload: CreateUserPayload): Promise<AppUser | null> {
  const { email, fullName, permissions, tempPassword } = payload;
  const [firstName, ...lastNameParts] = fullName.split(' ');
  const lastName = lastNameParts.join(' ') || '';

  // 1. Create Auth user using secondary client (so admin stays logged in)
  const { data: authData, error: authError } = await secondarySupabase.auth.signUp({
    email,
    password: tempPassword || 'Welcome123!',
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        is_admin: payload.userType === 'Avocat' && payload.permissions.includes('gestion_cabinet')
      }
    }
  });

  if (authError) {
    console.error("Error creating auth user:", authError);
    throw authError;
  }

  const userId = authData.user?.id;
  if (!userId) return null;

  // Permissions will be handled by the user_permissions table
  if (permissions && permissions.length > 0) {
    const permissionRows = permissions.map(pid => ({
      profile_id: userId,
      feature_id: pid
    }));
    await supabase.from('user_permissions').insert(permissionRows);
  }

  // Profile is created automatically by the DB trigger handle_new_user()

  const newUser: AppUser = {
    id: userId,
    email: email.trim().toLowerCase(),
    fullName: fullName.trim(),
    role: (payload.userType as UserRole),
    userType: payload.userType,
    hasAppAccess: true,
    permissions: permissions,
    status: 'Actif',
    phone: payload.phone || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return newUser;
}

export async function updateAppUser(userId: string, updates: Partial<AppUser>): Promise<void> {
  const { fullName, phone, photoUrl, status, permissions } = updates;

  const profileUpdates: any = {};
  if (fullName) {
    const [firstName, ...lastNameParts] = fullName.split(' ');
    profileUpdates.first_name = firstName;
    profileUpdates.last_name = lastNameParts.join(' ') || '';
  }
  if (phone) profileUpdates.phone = phone;
  if (photoUrl) profileUpdates.avatar_url = photoUrl;
  if (status) profileUpdates.is_active = (status === 'Actif');

  if (Object.keys(profileUpdates).length > 0) {
    await supabase.from('profiles').update(profileUpdates).eq('id', userId);
  }

  if (permissions) {
    // Replace permissions
    await supabase.from('user_permissions').delete().eq('profile_id', userId);
    const permissionRows = permissions.map(pid => ({
      profile_id: userId,
      feature_id: pid
    }));
    await supabase.from('user_permissions').insert(permissionRows);
  }
}

export async function softDeleteUser(userId: string): Promise<void> {
  await supabase.from('profiles').update({ is_active: false }).eq('id', userId);
}

export async function restoreUser(userId: string): Promise<void> {
  await supabase.from('profiles').update({ is_active: true }).eq('id', userId);
}
