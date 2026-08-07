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

export type VocabCard = {
  id: string;
  user_id: string;
  latin: string;
  german: string;
  note: string | null;
  source: string;
  created_at: string;
};
