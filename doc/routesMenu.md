# Meta-Felder für Route-Definitionen

## Übersicht

| Feld           | Typ                  | Beschreibung                            |
| -------------- | -------------------- | --------------------------------------- |
| `menu`         | `boolean`            | Route im Menü anzeigen                  |
| `label`        | `string`             | Anzeigename                             |
| `icon`         | `string`             | Material Icon Name                      |
| `order`        | `number`             | Sortierung (kleiner = weiter oben)      |
| `requiresAuth` | `boolean`            | Nur für eingeloggte User sichtbar       |
| `hideWhenAuth` | `boolean`            | Verstecken wenn eingeloggt (z.B. Login) |
| `requiredRole` | `string \| string[]` | Benötigte Rolle(n)                      |

## Beispiele

### Öffentliche Route

```javascript
{
  path: "/about",
  name: "about",
  component: () => import("pages/AboutPage.vue"),
  meta: {
    menu: true,
    label: "Über uns",
    icon: "info",
    order: 2
  }
}
```

### Geschützte Route (nur eingeloggt)

```javascript
{
  path: "/dashboard",
  name: "dashboard",
  component: () => import("pages/DashboardPage.vue"),
  meta: {
    menu: true,
    label: "Dashboard",
    icon: "dashboard",
    order: 10,
    requiresAuth: true
  }
}
```

### Route mit Rollen-Check

```javascript
{
  path: "/admin",
  name: "admin",
  component: () => import("pages/AdminPage.vue"),
  meta: {
    menu: true,
    label: "Administration",
    icon: "admin_panel_settings",
    order: 50,
    requiresAuth: true,
    requiredRole: "admin"
  }
}
```

### Route mit mehreren erlaubten Rollen

```javascript
{
  path: "/reports",
  name: "reports",
  component: () => import("pages/ReportsPage.vue"),
  meta: {
    menu: true,
    label: "Berichte",
    icon: "assessment",
    order: 20,
    requiresAuth: true,
    requiredRole: ["admin", "manager"]
  }
}
```

### Verstecken wenn eingeloggt

```javascript
{
  path: "/login",
  name: "login",
  component: () => import("pages/LoginPage.vue"),
  meta: {
    menu: true,
    label: "Login",
    icon: "login",
    order: 100,
    hideWhenAuth: true
  }
}
```

### Route ohne Menu-Eintrag

```javascript
{
  path: "/settings/profile",
  name: "profile-settings",
  component: () => import("pages/ProfileSettingsPage.vue"),
  meta: {
    requiresAuth: true
    // kein menu: true = nicht im Drawer sichtbar
  }
}
```
