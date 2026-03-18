export interface UserProfile {
    role: string;
    company_id?: number;
    site_id?: number;
    must_reset_password?: boolean;
}

export interface User {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    is_active: boolean;
    is_developer: boolean;
    email_verified: boolean;
    profile?: UserProfile;
}

export interface LoginCredentials {
    email: string;
    password: string;
}
