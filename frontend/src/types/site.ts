export interface Site {
    id: number;
    company_id: number;
    name: string;
    location?: string | null;
    sector?: string | null;
    is_active: boolean;
    created_at: string;
}
