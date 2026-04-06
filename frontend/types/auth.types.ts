export type Role = 'employee' | 'manager' | 'management' | 'admin';

export interface AuthUser {
    userId: number;
    email: string;
    name: string;
    roles: Role[];
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    user: AuthUser;
}