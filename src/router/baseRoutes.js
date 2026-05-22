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
          label: "About",
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
          label: "Contact",
          icon: "mail",
          order: 3,
        },
      },
      {
        path: "/webcam",
        name: "webcam",
        component: () => import("pages/WebcamPage.vue"),
        meta: {
          menu: true,
          label: "Webcam",
          icon: "videocam",
          order: 4,
          requiresAuth: true,
        },
      },
      {
        path: "/sound",
        name: "sound",
        component: () => import("pages/SoundPage.vue"),
        meta: {
          menu: true,
          label: "Sound",
          icon: "volume_up",
          order: 10,
          requiresAuth: true,
        },
      },
      {
        path: "/estim",
        name: "estim",
        component: () => import("pages/EstimPage.vue"),
        meta: {
          requiresAuth: true,
        },
      },
      {
        path: "/commands",
        name: "commands",
        component: () => import("pages/CommandPage.vue"),
        meta: {
          menu: true,
          label: "Commands",
          icon: "hub",
          order: 5,
          requiresAuth: true,
        },
      },
      {
        path: "/admin/sequences",
        name: "admin-sequences",
        component: () => import("pages/AdminSequencesPage.vue"),
        meta: {
          menu: true,
          label: "Sequences",
          icon: "queue_music",
          order: 20,
          requiresAuth: true,
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
          label: "Register",
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
          label: "Profile",
          icon: "person",
          order: 102,
          requiresAuth: true,
        },
      },
      {
        path: "/unauthorized",
        name: "unauthorized",
        component: () => import("pages/UnauthorizedPage.vue"),
      },
    ],
  },
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default baseRoutes;
