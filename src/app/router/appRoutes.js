// appRoutes.js
const appRoutes = [
  {
    path: "/",
    component: () => import("src/app/layouts/MainLayout.vue"),
    children: [
      // {
      //   path: "/dummy-auth",
      //   name: "dummy-auth",
      //   component: () => import("src/app/pages/DummyAuthPage.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     menu: true,
      //     label: "Dummy Auth",
      //     icon: "lock",
      //     order: 10,
      //   },
      // },
      // {
      //   path: "/session",
      //   name: "session",
      //   component: () => import("src/app/pages/SessionManagerPage.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     menu: true,
      //     label: "Meine Session",
      //     icon: "lock",
      //     order: 10,
      //   },
      // },
      // {
      //   path: "/session-playground/:sessionId",
      //   name: "session-playground",
      //   component: () => import("src/app/pages/SessionPlayGround.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     menu: false,
      //     label: "Session Playground",
      //     icon: "lock",
      //     order: 10,
      //   },
      //   props: true,
      // },
      // {
      //   path: "/session-devices/:sessionId",
      //   name: "session-devices",
      //   component: () => import("src/app/devices/pages/DevicePage.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     menu: false,
      //     label: "Session Devices",
      //     icon: "lock",
      //     order: 10,
      //   },
      //   props: true,
      // },
      // {
      //   path: "/becc-assistant",
      //   name: "becc-assistant",
      //   component: () => import("src/app/pages/BeccAssistant.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     menu: true,
      //     label: "BECC Assistentin",
      //     icon: "lock",
      //     order: 10,
      //   },
      // },
      /*
         Command Queue Tests
      */
      // {
      //   path: "test/assistant",
      //   name: "TestAssistant",
      //   component: () =>
      //     import("src/app/command_queue/pages/AssistantTestPage.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     menu: true,
      //     label: "TEST Assistentin",
      //     icon: "lock",
      //     order: 100,
      //   },
      // },
      // {
      //   path: "test/webcam",
      //   name: "TestWebcam",
      //   component: () =>
      //     import("src/app/command_queue/pages/WebcamDevicePageDebug.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     menu: true,
      //     label: "TEST Webcam",
      //     icon: "lock",
      //     order: 105,
      //   },
      // },
      // {
      //   path: "test/microphone",
      //   name: "TestMicrophone",
      //   component: () =>
      //     import("src/app/command_queue/pages/MicrophoneDevicePage.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     menu: true,
      //     label: "TEST Microphone",
      //     icon: "lock",
      //     order: 10,
      //   },
      // },
      // {
      //   path: "test",
      //   name: "TestOverview",
      //   component: () =>
      //     import("src/app/command_queue/pages/TestOverviewPage.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     menu: true,
      //     label: "TEST Overview",
      //     icon: "lock",
      //     order: 115,
      //   },
      // },
      // /*
      //    Conversation (Assistant)
      // */
      // {
      //   path: "/assistant",
      //   component: () =>
      //     import("src/app/conversations/pages/AssistantView.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     menu: true,
      //     label: "Conversation (Assistant)",
      //     icon: "person",
      //     order: 200,
      //   },
      // },
    ],
  },
];

export default appRoutes;
