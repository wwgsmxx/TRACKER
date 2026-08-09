# HabitFlow — GitHub Pages + Supabase Setup Guide

Минималистичный веб-трекер привычек с синхронизацией между устройствами через **Supabase** и хостингом на **GitHub Pages**.

---

## 1. Настройка Supabase Project

1. Зарегистрируйтесь / войдите на [Supabase.com](https://supabase.com/).
2. Создайте новый проект (например, `habitflow-tracker`).
3. Перейдите в **SQL Editor** в меню слева.
4. Вставьте следующий SQL-код и нажмите **Run**:

```sql
-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  color_scheme TEXT DEFAULT 'emerald',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- 4. Habits
CREATE TABLE IF NOT EXISTS public.habits (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- 5. Habit Logs
CREATE TABLE IF NOT EXISTS public.habit_logs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL,
  log_date DATE NOT NULL,
  completed BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, habit_id, log_date)
);

-- 6. Daily Notes
CREATE TABLE IF NOT EXISTS public.daily_notes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  content TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, note_date)
);

-- 7. Monthly Goals
CREATE TABLE IF NOT EXISTS public.monthly_goals (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_str TEXT NOT NULL,
  content TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- 8. Yearly Goals
CREATE TABLE IF NOT EXISTS public.yearly_goals (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_str TEXT NOT NULL,
  content TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yearly_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can access own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can access own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can access own categories" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can access own habits" ON public.habits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can access own habit_logs" ON public.habit_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can access own daily_notes" ON public.daily_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can access own monthly_goals" ON public.monthly_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can access own yearly_goals" ON public.yearly_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- New User Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (new.id, new.email);
  INSERT INTO public.user_settings (user_id, theme, color_scheme) VALUES (new.id, 'dark', 'emerald');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 2. Подключение API Keys

1. В Supabase перейдите в **Project Settings -> API**.
2. Скопируйте **Project URL** и **anon public key**.
3. Откройте файл `config.js` в проекте и вставьте ваши ключи:

```javascript
window.ENV_SUPABASE_URL = 'https://your-project-id.supabase.co';
window.ENV_SUPABASE_ANON_KEY = 'eyJhbGciOi...ваши_anon_key';
```

---

## 3. Размещение на GitHub Pages

1. Создайте публичный или приватный репозиторий на GitHub.
2. В терминале выполните:
```bash
git add .
git commit -m "Migrate to Supabase Auth & DB for GitHub Pages"
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git branch -M main
git push -u origin main
```
3. В настройках репозитория на GitHub перейдите в **Settings -> Pages**.
4. В разделе **Source** выберите **Deploy from a branch**.
5. Выберите ветку `main` и папку `/ (root)` и нажмите **Save**.
6. Через 1-2 минуты ваш сайт станет доступен по адресу:
`https://USERNAME.github.io/REPOSITORY/`

---

## 4. Настройка Supabase Auth Redirect URLs

1. В Supabase перейдите в **Authentication -> URL Configuration**.
2. В поле **Site URL** вставьте вашу ссылку GitHub Pages:
`https://USERNAME.github.io/REPOSITORY/`
3. В раздел **Redirect URLs** добавьте:
`https://USERNAME.github.io/REPOSITORY/*`

