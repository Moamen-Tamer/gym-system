# Full Code Walkthrough — Gym System (Pulse / Elite Admin)

---

## 1. Backend Fixes

### 📄 `backend/src/server/app.ts` — CORS Configuration

**What is CORS?**
CORS (Cross-Origin Resource Sharing) is a browser security rule. When your Angular app runs on `http://localhost:4200` and tries to call your backend on `http://localhost:3000`, the browser blocks it because they are on different ports (different "origins"). You have to explicitly tell the backend "it's okay to accept requests from port 4200".

**What I added:**
```typescript
app.use(cors({
    origin: "http://localhost:4200",
    credentials: true,
}));
```
- `origin` → only allows requests from the Angular dev server
- `credentials: true` → allows the browser to send and receive **cookies** (needed for the httpOnly auth cookies)

> ⚠️ `credentials: true` must be set on BOTH the backend (here) AND every frontend HTTP request (`withCredentials: true`). If either side is missing, cookies won't be sent.

---

### 📄 `backend/src/server/bootstrap.ts` — Non-Fatal MongoDB Connection

**Problem:** Your MongoDB Atlas was unreachable on the local machine (DNS error). Because the connection crash wasn't caught, it was crashing the whole server before it even started.

**What I changed:**
```typescript
try {
    await connectMongo();
} catch (err) {
    logger.error({ err }, 'MongoDB error'); // just log it
    // don't crash — auth is handled by Supabase anyway
}
```
- Wrapped the MongoDB connection in a `try/catch`
- If it fails, the server logs the error but **keeps running**
- Authentication still works because it uses **Supabase**, not MongoDB

---

## 2. Frontend — AuthService

### 📄 `frontend/src/app/services/auth.service.ts`

**What is a Service in Angular?**
A service is a reusable class that holds logic and can be injected into any component. Think of it as a "helper" that multiple components can share — you write the API call code once here instead of repeating it everywhere.

**What it does:**
It wraps the 3 backend API calls:

```typescript
// 1. Login
login(credentials): Observable<LoginResponse> {
    return this.http.post('/api/auth/login', credentials, { withCredentials: true });
}

// 2. Register
register(data): Observable<RegisterResponse> {
    return this.http.post('/api/auth/register', data, { withCredentials: true });
}

// 3. Refresh token
refreshToken(): Observable<RefreshResponse> {
    return this.http.post('/api/auth/refresh', {}, { withCredentials: true });
}

// 4. Logout
logout(): Observable<{ message: string }> {
    return this.http.post('/api/auth/logout', {}, { withCredentials: true });
}
```

- `withCredentials: true` → tells the browser to include cookies in the request
- Returns `Observable` — Angular's way of handling async HTTP calls (like a Promise but more powerful)

---

## 3. Frontend — HTTP Interceptor

### 📄 `frontend/src/app/interceptors/auth.interceptor.ts`

**What is an Interceptor?**
An interceptor sits between your code and every HTTP request. It can read/modify requests before they go out, and read/modify responses when they come back. Think of it as a "middleware" but for the frontend.

**What this interceptor does:**
1. Adds `withCredentials: true` to **every** HTTP request automatically (so you don't have to remember to add it manually)
2. If any request gets back a **401 Unauthorized** error (meaning token expired):
   - It automatically calls `/api/auth/refresh` to get a new token
   - Then **retries the original request** with the new token
   - If refresh also fails, it redirects you to `/auth/login`

```typescript
catchError((error) => {
    if (error.status === 401 && !isRefreshing && !req.url.includes('/login')) {
        isRefreshing = true;
        return authService.refreshToken().pipe(
            switchMap(() => next(reqWithCreds)), // retry original request
            catchError(() => router.navigate(['/auth/login'])) // refresh failed
        );
    }
    return throwError(() => error);
})
```

**Why exclude `/login` and `/refresh`?**
If login itself fails with 401 (wrong password), we don't want to trigger another refresh call — that would be an infinite loop.

---

## 4. Frontend — App Config

### 📄 `frontend/src/app/app.config.ts`

**What this file does:**
This is the root configuration of the Angular app. You register global providers here.

**What I added:**
```typescript
provideHttpClient(withInterceptors([authInterceptor]))
```
- `provideHttpClient` → enables Angular's HTTP module globally
- `withInterceptors([authInterceptor])` → registers our interceptor so it runs on every request

---

## 5. Frontend — Login Component

### 📄 `frontend/src/pages/auth/login/login.ts`

**What is a Reactive Form?**
Angular has two ways to build forms: Template-driven (simple, in HTML) and Reactive (in TypeScript, more powerful). Reactive forms give you full control over validation and state.

**What I built:**
```typescript
loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
});
```
- Each field has **validators** — rules that must pass before the form can be submitted
- `fb.group()` creates a group of connected form controls

**onSubmit() flow:**
1. Check if form is valid — if not, mark all fields as "touched" so errors show
2. Set `isLoading = true` → shows spinner on button
3. Handle "Remember Me" (save/clear email in localStorage)
4. Call `authService.login()`
5. On **success** → navigate to `/dashboard`
6. On **error** → show the error message from the backend

**Remember Me logic:**
```typescript
if (rememberMe) {
    localStorage.setItem('elite_remembered_email', email);
} else {
    localStorage.removeItem('elite_remembered_email');
}
```
And on page load (`ngOnInit`), if a saved email exists, pre-fill the form:
```typescript
const savedEmail = localStorage.getItem('elite_remembered_email');
if (savedEmail) {
    this.loginForm.patchValue({ email: savedEmail, rememberMe: true });
}
```

**ChangeDetectorRef:**
Angular sometimes doesn't notice that a variable changed (especially after async operations). `ChangeDetectorRef.detectChanges()` manually tells Angular "hey, something changed, please update the UI now."

---

## 6. Frontend — Register Component

### 📄 `frontend/src/pages/auth/register/register.ts`

Same pattern as Login but for registration:
```typescript
registerForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
});
```

On success:
1. Shows green **"Account created! Redirecting to login..."** message
2. After 1.8 seconds, automatically navigates to the login page

---

## 7. Frontend — Routing & Lazy Loading

### 📄 `frontend/src/app/app.routes.ts`
```typescript
export const routes: Routes = [
  { path: 'auth', loadChildren: () => import('../pages/auth/auth.routes') },
  { path: '', loadChildren: () => import('./dashboard.routes') },
  { path: '**', redirectTo: '/dashboard' },
];
```

### 📄 `frontend/src/app/dashboard.routes.ts`
```typescript
{
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
}
```

**What is Lazy Loading?**
By default, Angular bundles ALL your code into one big file. With lazy loading, each page is a **separate chunk** that only downloads when the user navigates to it. This makes the initial load much faster.

- `loadChildren` → lazy loads an entire set of routes (used for feature modules)
- `loadComponent` → lazy loads a single standalone component (modern Angular approach)

**The routing structure:**
```
/ (root)
├── auth/
│   ├── login      → Login component
│   └── register   → Register component
├── dashboard      → Dashboard component  (lazy)
├── members        → Members component    (lazy)
├── workouts       → Workouts component   (lazy)
├── history        → History component    (lazy)
├── statistics     → Statistics component (lazy)
├── reports        → Reports component    (lazy)
└── **             → redirect to /dashboard
```

---

## 8. Frontend — Main Layout (Shell + Sidebar)

### 📄 `frontend/src/app/layout/main-layout/main-layout.ts`

**What is a Layout Component?**
A layout component is a "shell" — it defines the persistent parts of the UI (like a sidebar and header) that stay on screen, while only the inner content (`<router-outlet>`) changes when you navigate.

```html
<div class="app-shell">
    <aside class="sidebar">...</aside>
    <main class="content">
        <router-outlet />   ← page content loads here
    </main>
</div>
```

**Navigation items are defined as data:**
```typescript
navItems = [
    { label: 'Dashboard',  icon: 'dashboard',  route: '/dashboard'  },
    { label: 'Members',    icon: 'members',    route: '/members'    },
    { label: 'Workouts',   icon: 'workouts',   route: '/workouts'   },
    { label: 'History',    icon: 'history',    route: '/history'    },
    { label: 'Statistics', icon: 'statistics', route: '/statistics' },
    { label: 'Reports',    icon: 'reports',    route: '/reports'    },
];
```
Then looped in the HTML with `*ngFor`.

**`routerLinkActive="active"`:**
Angular automatically adds the CSS class `active` to whichever link matches the current URL. This is how the highlighted nav item works.

---

## 9. Frontend — Logout Logic

```typescript
logout(): void {
    this.isLoggingOut = true;
    this.authService.logout().subscribe({
        next: () => {
            this.isLoggingOut = false;
            this.router.navigate(['/auth/login']);
        },
        error: () => {
            // Even if server fails, still redirect — user is logged out locally
            this.isLoggingOut = false;
            this.router.navigate(['/auth/login']);
        },
    });
}
```

**Why handle the error case too?**
If the network is down or backend crashes, the logout button would freeze. By handling the error and still redirecting, the user is never stuck on the page.

---

## Summary of Key Concepts

| Concept | What it means |
|---|---|
| **CORS** | Browser security — backend must allow requests from frontend's origin |
| **httpOnly Cookie** | Auth token stored in cookie, not localStorage — JavaScript can't read it (safer) |
| **Service** | Reusable Angular class for shared logic (API calls) |
| **Interceptor** | Middleware for HTTP — runs on every request/response |
| **Reactive Form** | Form controlled in TypeScript with validators |
| **Lazy Loading** | Pages download on demand, not all at once |
| **Router Outlet** | Placeholder in HTML where Angular renders the current page |
| **routerLinkActive** | Angular adds a CSS class automatically when the link matches current URL |
| **ChangeDetectorRef** | Forces Angular to re-check and update the UI |
| **Observable** | Angular's async type — like a Promise but cancellable and stream-based |
