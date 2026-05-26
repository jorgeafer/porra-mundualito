export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          is_admin: boolean
          created_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          is_admin?: boolean
          created_at?: string
        }
        Update: {
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          is_admin?: boolean
        }
      }
      teams: {
        Row: {
          id: number
          name: string
          code: string
          flag_emoji: string | null
          group_name: string | null
        }
        Insert: {
          id?: number
          name: string
          code: string
          flag_emoji?: string | null
          group_name?: string | null
        }
        Update: {
          name?: string
          code?: string
          flag_emoji?: string | null
          group_name?: string | null
        }
      }
      matches: {
        Row: {
          id: number
          home_team_id: number
          away_team_id: number
          match_date: string
          stage: string
          group_name: string | null
          venue: string | null
          home_score: number | null
          away_score: number | null
          status: 'scheduled' | 'live' | 'finished'
        }
        Insert: {
          id?: number
          home_team_id: number
          away_team_id: number
          match_date: string
          stage: string
          group_name?: string | null
          venue?: string | null
          home_score?: number | null
          away_score?: number | null
          status?: 'scheduled' | 'live' | 'finished'
        }
        Update: {
          match_date?: string
          stage?: string
          group_name?: string | null
          venue?: string | null
          home_score?: number | null
          away_score?: number | null
          status?: 'scheduled' | 'live' | 'finished'
        }
      }
      predictions: {
        Row: {
          id: number
          user_id: string
          match_id: number
          home_score: number
          away_score: number
          points: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          match_id: number
          home_score: number
          away_score: number
          points?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          home_score?: number
          away_score?: number
          points?: number
          updated_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type Prediction = Database['public']['Tables']['predictions']['Row']

export type MatchWithTeams = Match & {
  home_team: Team
  away_team: Team
}
