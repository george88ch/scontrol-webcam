# Route Menu Metadata

The drawer menu is generated from Vue Router records with `meta.menu`.

| Field | Type | Purpose |
| --- | --- | --- |
| `menu` | `boolean` | Show route in the drawer |
| `label` | `string` | Drawer label |
| `icon` | `string` | Material icon name |
| `order` | `number` | Drawer sort order |
| `requiresAuth` | `boolean` | Require a logged-in user |
| `hideWhenAuth` | `boolean` | Hide route from logged-in users |
| `requiredRole` | `string \| string[]` | Require one or more profile roles |

```js
{
  path: "/dashboard",
  name: "dashboard",
  component: () => import("pages/DashboardPage.vue"),
  meta: {
    menu: true,
    label: "Dashboard",
    icon: "dashboard",
    order: 10,
    requiresAuth: true,
  },
}
```
