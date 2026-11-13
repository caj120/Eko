import { RouteRecordRaw, createRouter, createWebHistory } from "vue-router";
import { TAG_SYMBOLS } from "./utils/tags";
import DiscoverCreators from "./pages/DiscoverCreators.vue";
import Eko from "./pages/Eko.vue";
import AgentProfile from "./pages/AgentProfile.vue";
import EchoYarn from "./pages/EchoYarn.vue";
import EchoesListCashtag from "./pages/EchoesListCashtag.vue";
import EchoesListHashtag from "./pages/EchoesListHashtag.vue";
import EchoesListMention from "./pages/EchoesListMention.vue";
import EchoesListAuthor from "./pages/EchoesListAuthor.vue";
import NotFound from "./pages/NotFound.vue";
import MyNotifications from "./pages/MyNotifications.vue";
import { getHomeRedirect } from "./utils/homeRedirect";

export const ROUTES = {
  landing: "landing",
  discover: "discover",
  profile: "profile",
  authoredEchoes: "authoredEchoes",
  creators: "creators",
  followers: "followers",
  notifications: "notifications",
  feed: "feed",
  yarn: "yarn",
  hashtag: "hashtag",
  cashtag: "cashtag",
  mention: "mention",
};

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: ROUTES.landing,
    redirect: () =>
      getHomeRedirect() ? { path: ROUTES.discover } : { name: ROUTES.feed },
  },
  {
    path: "/index.html",
    redirect: () => "/"
  },
  {
    path: "/feed",
    name: ROUTES.feed,
    component: Eko,
  },
  {
    path: "/profiles/:agentPubKey",
    name: ROUTES.profile,
    component: AgentProfile,
  },
  {
    path: "/profiles/:agentPubKey/echoes",
    name: ROUTES.authoredEchoes,
    component: EchoesListAuthor,
  },
  {
    path: "/notifications",
    name: ROUTES.notifications,
    component: MyNotifications,
  },
  {
    path: "/discover",
    name: ROUTES.discover,
    component: DiscoverCreators,
  },
  {
    path: "/yarn/:actionHash",
    name: ROUTES.yarn,
    component: EchoYarn,
  },
  {
    path: `/cashtag/:tag`,
    name: ROUTES.cashtag,
    component: EchoesListCashtag,
    meta: { tag: TAG_SYMBOLS.CASHTAG },
  },
  {
    path: `/hashtag/:tag`,
    name: ROUTES.hashtag,
    component: EchoesListHashtag,
    meta: { tag: TAG_SYMBOLS.HASHTAG },
  },
  {
    path: `/mention/:tag/:agentPubKey`,
    name: ROUTES.mention,
    component: EchoesListMention,
    meta: { tag: TAG_SYMBOLS.MENTION },
  },
  { path: "/:pathMatch(.*)", component: NotFound },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
