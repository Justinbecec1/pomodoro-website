# AI Pomodoro Website Implementation Plan

This document was made by copilot an AI its the plan we have in place

## Phase 1: Project Setup & Architecture

### Backend Setup
- [ ] Initialize Node.js/Express server
- [ ] Set up Supabase project and get API keys
- [ ] Configure environment variables (.env)
- [ ] Set up CORS and middleware
- [ ] Create project folder structure:
  - `/routes` - API endpoints
  - `/controllers` - Business logic
  - `/models` - Firestore/Database interactions
  - `/middleware` - Authentication, validation
  - `/config` - Firebase and app configuration

### Frontend Setup
- [ ] Set up project structure:
  - `/assets` - Images, icons
  - `/js` - JavaScript modules
  - `/css` - Stylesheets
  - `/pages` - Different views (login, dashboard, timer, tasks, etc.)
- [ ] Create modular JavaScript architecture

---

## Phase 2: User Authentication

### Backend
- [ ] Set up Supabase Authentication
- [ ] Create `/routes/auth.js`:
  - POST `/auth/register` - User registration
  - POST `/auth/login` - User login
  - POST `/auth/logout` - User logout
  - POST `/auth/refresh-token` - Refresh JWT token
- [ ] Create PostgreSQL `users` table in Supabase:
  ```sql
  CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT auth.uid(),
    email VARCHAR UNIQUE NOT NULL,
    display_name VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    FOREIGN KEY (id) REFERENCES auth.users(id)
  );
  ```

### Frontend
- [ ] Create login page (login.html)
- [ ] Create registration page (register.html)
- [ ] Create `/js/auth.js`:
  - handleLogin() function
  - handleRegister() function
  - handleLogout() function
  - Authentication state management
  - Token management (localStorage/sessionStorage)
- [ ] Add form validation
- [ ] Create authentication middleware/guards for protected pages

### Features
- [ ] Password strength validation
- [ ] Email verification (optional)
- [ ] "Remember me" functionality
- [ ] Session management

---

## Phase 3: Customizable Pomodoro Timer

### Backend
- [ ] Create timer configuration endpoints
- [ ] POST `/api/timer/config` - Save user's preferred settings
- [ ] GET `/api/timer/config` - Retrieve user's settings
- [ ] Create PostgreSQL `timer_settings` table in Supabase:
  ```sql
  CREATE TABLE public.timer_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    work_duration INTEGER DEFAULT 25,
    break_duration INTEGER DEFAULT 5,
    long_break_duration INTEGER DEFAULT 15,
    sessions_before_long_break INTEGER DEFAULT 4,
    sound_enabled BOOLEAN DEFAULT TRUE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
  );
  CREATE INDEX idx_timer_settings_user_id ON public.timer_settings(user_id);
  ```

### Frontend
- [ ] Create timer page (timer.html)
- [ ] Create `/js/timer.js`:
  - Timer countdown logic
  - Start/pause/reset controls
  - Session counter (work/break cycles)
  - Visual progress indicator (circular/linear)
- [ ] Create settings panel:
  - Work duration input
  - Break duration input
  - Long break duration input
  - Sessions before long break input
  - Sound toggle
  - Notification toggle
- [ ] Add UI elements:
  - Timer display (MM:SS format)
  - Status indicator (Working / Break / Long Break)
  - Session counter display
  - Control buttons (Start, Pause, Reset, Skip)

### Features
- [ ] Store custom settings in backend
- [ ] Sound notifications on timer end
- [ ] Browser notifications
- [ ] Visual alerts
- [ ] Auto-start next session option

---

## Phase 4: Task Management

### Backend
- [ ] Create `/routes/tasks.js` with endpoints:
  - POST `/api/tasks` - Create new task
  - GET `/api/tasks` - Get all user tasks
  - GET `/api/tasks/:taskId` - Get single task
  - PUT `/api/tasks/:taskId` - Update task
  - DELETE `/api/tasks/:taskId` - Delete task
  - PATCH `/api/tasks/:taskId/complete` - Mark task complete
  
- [ ] Create PostgreSQL `tasks` table in Supabase:
  ```sql
  CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT,
    priority VARCHAR DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date TIMESTAMP,
    completed BOOLEAN DEFAULT FALSE,
    estimated_pomodoros INTEGER,
    completed_pomodoros INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    tags TEXT[],
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
  );
  CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
  ```

### Frontend
- [ ] Create tasks page (tasks.html)
- [ ] Create `/js/tasks.js`:
  - Render task list
  - Add task form
  - Edit task form
  - Delete task confirmation
  - Mark task complete/incomplete
  - Filter tasks (all, active, completed)
  - Sort tasks (by due date, priority, creation date)
  
- [ ] Create task card component showing:
  - Task title
  - Description
  - Priority badge
  - Due date
  - Estimated pomodoros
  - Completed pomodoros
  - Completion checkbox

### Features
- [ ] Priority levels (low, medium, high)
- [ ] Task categories/tags
- [ ] Due dates
- [ ] Estimated effort (pomodoros)
- [ ] Bulk actions (select multiple, mark complete, delete)
- [ ] Search/filter functionality

---

## Phase 5: Progress Tracking

### Backend
- [ ] Create `/routes/progress.js`:
  - GET `/api/progress/stats` - Get user statistics
  - GET `/api/progress/daily` - Get daily stats
  - GET `/api/progress/weekly` - Get weekly stats
  - GET `/api/progress/monthly` - Get monthly stats

- [ ] Create PostgreSQL `sessions` table in Supabase:
  ```sql
  CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR CHECK (type IN ('work', 'break', 'longBreak')),
    duration INTEGER NOT NULL,
    planned_duration INTEGER NOT NULL,
    completed_at TIMESTAMP DEFAULT NOW(),
    task_id UUID,
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL
  );
  CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
  ```

- [ ] Create PostgreSQL `daily_stats` table for aggregated data:
  ```sql
  CREATE TABLE public.daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    stat_date DATE DEFAULT CURRENT_DATE,
    total_pomodoros INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, stat_date),
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
  );
  CREATE INDEX idx_daily_stats_user_id ON public.daily_stats(user_id);
  ```

### Frontend
- [ ] Create progress/dashboard page (dashboard.html)
- [ ] Create `/js/progress.js`:
  - Fetch and render statistics
  - Display charts and graphs
  
- [ ] Create dashboard widgets:
  - Total pomodoros today
  - Total time worked today
  - Tasks completed today
  - Current/longest streak
  - Weekly breakdown (chart)
  - Category breakdown (pie chart)

### Features
- [ ] Daily statistics
- [ ] Weekly/monthly summaries
- [ ] Charts and visualizations (using Chart.js or similar)
- [ ] Streak tracking (consecutive days with pomodoros)
- [ ] Category analytics
- [ ] Export statistics (CSV)

---

## Phase 6: Assignment Deadline Reminders & Email Notifications

### Backend
- [ ] Set up email service (Nodemailer with Gmail/SendGrid)
- [ ] Create `/routes/notifications.js`:
  - POST `/api/notifications/preferences` - Save notification settings
  - GET `/api/notifications/preferences` - Get preferences

- [ ] Create PostgreSQL `notification_preferences` table in Supabase:
  ```sql
  CREATE TABLE public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    email_reminders BOOLEAN DEFAULT TRUE,
    reminder_time VARCHAR DEFAULT '1h',
    email_on_completion BOOLEAN DEFAULT FALSE,
    daily_summary BOOLEAN DEFAULT TRUE,
    summary_time VARCHAR DEFAULT '18:00',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
  );
  CREATE INDEX idx_notification_prefs_user_id ON public.notification_preferences(user_id);
  ```

- [ ] Create scheduled job (Cloud Scheduler or node-cron):
  - Check for upcoming deadlines
  - Send email reminders 24h, 1h before deadline
  - Send daily summary emails
  - Log sent notifications

- [ ] Email templates:
  - Task deadline reminder
  - Daily summary
  - Task completion confirmation (optional)

### Frontend
- [ ] Create notifications settings page
- [ ] Add notification preferences:
  - Enable/disable email reminders
  - Set reminder timing (24h, 1h, 30m before)
  - Enable/disable daily summaries
  - Set summary time
  - Email address display
- [ ] Display in-app notifications for upcoming deadlines

### Features
- [ ] Email notifications 24 hours before deadline
- [ ] Email notifications 1 hour before deadline
- [ ] Daily summary emails with upcoming tasks
- [ ] User-configurable notification preferences
- [ ] In-app deadline alerts
- [ ] Notification history/log

---

## Phase 7: User Data Isolation & Security

### Backend
- [ ] Implement Supabase JWT authentication middleware:
  - Verify JWT token on all protected routes
  - Extract userId from token
  - Pass userId to all database queries

- [ ] Set up PostgreSQL Row Level Security (RLS) policies:
  ```sql
  -- Enable RLS on all tables
  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.timer_settings ENABLE ROW LEVEL SECURITY;

  -- Allow users to only see their own data
  CREATE POLICY "Users can only view their own profile"
    ON public.users
    FOR SELECT
    USING (auth.uid() = id);

  CREATE POLICY "Users can only see their own tasks"
    ON public.tasks
    FOR ALL
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can only see their own sessions"
    ON public.sessions
    FOR ALL
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can only see their own stats"
    ON public.daily_stats
    FOR ALL
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can only see their own notifications"
    ON public.notification_preferences
    FOR ALL
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can only see their own timer settings"
    ON public.timer_settings
    FOR ALL
    USING (auth.uid() = user_id);
  ```

- [ ] Add request validation middleware
- [ ] Implement rate limiting
- [ ] Add input sanitization

### Frontend
- [ ] Implement route guards
- [ ] Store auth token securely
- [ ] Clear data on logout
- [ ] Validate user context before displaying data

### Features
- [ ] Complete data isolation per user
- [ ] No cross-user data access
- [ ] Secure token handling
- [ ] Session management

---

## Phase 8: Integration & Polish

### Testing
- [ ] Unit tests for utility functions
- [ ] Integration tests for API endpoints
- [ ] Frontend E2E tests
- [ ] Authentication flow testing
- [ ] Data isolation testing

### UI/UX
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Loading states
- [ ] Error handling and user feedback
- [ ] Dark mode (optional)
- [ ] Accessibility (WCAG)

### Performance
- [ ] Optimize database queries (indexes)
- [ ] Lazy load components
- [ ] Cache user settings
- [ ] Minify and bundle assets
- [ ] Image optimization

### Deployment
- [ ] Deploy backend (Firebase Functions or Heroku/Railway)
- [ ] Deploy frontend (Firebase Hosting, Vercel, or similar)
- [ ] Set up CI/CD pipeline
- [ ] Configure domain and SSL
- [ ] Monitor errors and performance

---

## Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (JWT) |
| Email | Supabase Edge Functions / Resend / Nodemailer |
| Scheduling | Supabase Cron (Extensions) / node-cron |
| Charts | Chart.js or D3.js |
| Notifications | Browser Notifications API + Email |
| Real-time | Supabase Realtime (optional) |

---

## Suggested Development Order

1. **Week 1**: User Authentication (Phase 2)
2. **Week 2**: Pomodoro Timer (Phase 3)
3. **Week 3**: Task Management (Phase 4)
4. **Week 4**: Progress Tracking (Phase 5)
5. **Week 5**: Notifications & Emails (Phase 6)
6. **Week 6**: Security & Data Isolation (Phase 7)
7. **Week 7-8**: Integration, Testing, Polish & Deployment (Phase 8)

---

## File Structure Reference

```
pomodoro-website/
├── backend/
│   ├── config/
│   │   ├── supabase.js
│   │   └── constants.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── taskController.js
│   │   ├── timerController.js
│   │   ├── progressController.js
│   │   └── notificationController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validation.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── tasks.js
│   │   ├── timer.js
│   │   ├── progress.js
│   │   └── notifications.js
│   ├── services/
│   │   ├── emailService.js
│   │   └── schedulerService.js
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── assets/
│   │   └── images/
│   ├── css/
│   │   ├── styles.css
│   │   └── responsive.css
│   ├── js/
│   │   ├── auth.js
│   │   ├── timer.js
│   │   ├── tasks.js
│   │   ├── progress.js
│   │   ├── api.js
│   │   └── utils.js
│   ├── pages/
│   │   ├── index.html (landing)
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── dashboard.html
│   │   ├── timer.html
│   │   ├── tasks.html
│   │   ├── progress.html
│   │   └── settings.html
│   └── index.html (entry point after auth)
│
├── README.md
└── IMPLEMENTATION_PLAN.md
```

---

## Next Steps

1. Review this plan and adjust based on your needs
2. Set up Supabase project at https://supabase.com
3. Create PostgreSQL tables using the SQL schemas provided in each phase
4. Enable Row Level Security (RLS) on all tables
5. Configure authentication in Supabase Auth dashboard
6. Set up environment variables (.env) with Supabase URL and anon/service keys
7. Start with Phase 2 (User Authentication)
8. Begin implementing endpoints and frontend pages phase by phase
