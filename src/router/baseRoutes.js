// baseRoutes.js
const baseRoutes = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      {
        path: "/",
        name: "home",
        component: () => import("pages/IndexPage.vue"),
        meta: {
          menu: true,
          label: "Home",
          icon: "home",
          order: 1,
        },
      },
      {
        path: "/about",
        name: "about",
        component: () => import("pages/AboutPage.vue"),
        meta: {
          menu: true,
          label: "Über uns",
          icon: "info",
          order: 2,
        },
      },
      {
        path: "/contact",
        name: "contact",
        component: () => import("pages/ContactPage.vue"),
        meta: {
          menu: true,
          label: "Kontakt",
          icon: "mail",
          order: 3,
        },
      },
      {
        path: "/login",
        name: "login",
        component: () => import("pages/LoginPage.vue"),
        meta: {
          menu: true,
          label: "Login",
          icon: "login",
          order: 100,
          hideWhenAuth: true,
        },
      },
      {
        path: "/register",
        name: "register",
        component: () => import("pages/RegisterPage.vue"),
        meta: {
          menu: true,
          label: "Registrieren",
          icon: "person_add",
          order: 101,
          hideWhenAuth: true,
        },
      },
      {
        path: "/register",
        name: "register",
        component: () => import("pages/RegisterPage.vue"),
        meta: {
          menu: true,
          label: "Registrieren",
          icon: "person_add",
          order: 101,
          hideWhenAuth: true,
        },
      },
      {
        path: "/profile",
        name: "profile",
        component: () => import("pages/ProfilePage.vue"),
        meta: {
          menu: true,
          label: "Profil",
          icon: "person",
          order: 102,
          requiresAuth: true,
        },
      },
    ],
  },
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default baseRoutes;
