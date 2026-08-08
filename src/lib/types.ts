export type Recording = {
  id: string;
  user_id: string;
  title: string;
  tag: string;
  audio_path: string;
  duration: number | null;
  is_public: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  avatar_url: string | null;
  display_name: string | null;
};

export type VocabCard = {
  id: string;
  user_id: string;
  latin: string;
  german: string;
  note: string | null;
  source: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  last_reviewed_at: string | null;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  user_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
};
