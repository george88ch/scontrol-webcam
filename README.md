# SControl Webcam

Quasar 2 / Vue 3 application scaffold with Firebase authentication, Firestore,
Storage, route guards, and a metadata-driven drawer menu.

## Install

```bash
npm install
```

## Develop

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Environment

Create a local `.env` file with the Firebase project values used by
[src/boot/firebase.js](src/boot/firebase.js):

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_DATABASE_URL=
VITE_OPENAI_API_KEY=
```

## Routes

Routes can opt into the drawer and auth guard through `meta` fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `menu` | `boolean` | Show route in the drawer |
| `label` | `string` | Drawer label |
| `icon` | `string` | Material icon name |
| `order` | `number` | Drawer sort order |
| `requiresAuth` | `boolean` | Require a logged-in user |
| `hideWhenAuth` | `boolean` | Hide route from logged-in users |
| `requiredRole` | `string \| string[]` | Require one or more profile roles |
