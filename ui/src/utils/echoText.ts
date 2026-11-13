import {
  LinkTarget,
  LinkTargetName,
  MentionLinkTarget,
  EchoContentPart,
  EchoTagType,
  UrlLinkTarget,
} from "@/types/types";
import { isRawUrl, isTag, TAG_OR_RAW_URL_REGEX, TAG_SYMBOLS } from "./tags";
import { ROUTES } from "@/router";
import { AgentPubKey, encodeHashToBase64 } from "@holochain/client";
import { RouteLocationRaw } from "vue-router";

export const splitEchoTextIntoContentParts = (
  text: string,
  links: LinkTarget[]
): EchoContentPart[] => {
  const parts = text
    .split(TAG_OR_RAW_URL_REGEX)
    .filter((part) => part !== undefined && part.length > 0);

  const contentParts = parts.map((part) => {
    const partIsTag = isTag(part);

    if (isRawUrl(part)) {
      return {
        text: part,
        href: part,
        tagType: EchoTagType.RawUrl,
      } as EchoContentPart;
    } else if (
      links.length > 0 &&
      partIsTag &&
      part[0] === TAG_SYMBOLS.MENTION
    ) {
      const link = links.pop();

      const agentPubKey = (link as MentionLinkTarget)[
        LinkTargetName.Mention
      ] as AgentPubKey;

      const route: RouteLocationRaw = {
        name: ROUTES.mention,
        params: {
          tag: part.substring(1),
          agentPubKey: encodeHashToBase64(agentPubKey),
        },
      };

      return {
        text: part,
        route,
        tagType: EchoTagType.Mention,
      };
    } else if (links.length > 0 && partIsTag && part[0] === TAG_SYMBOLS.LINK) {
      const link = links.pop();

      return {
        text: part,
        href: (link as UrlLinkTarget).Url,
        tagType: EchoTagType.Link,
      };
    } else if (partIsTag && part[0] === TAG_SYMBOLS.HASHTAG) {
      const route: RouteLocationRaw = {
        name: ROUTES.hashtag,
        params: { tag: part.substring(1) },
      };

      return {
        text: part,
        route,
        tagType: EchoTagType.Hashtag,
      };
    } else if (partIsTag && part[0] === TAG_SYMBOLS.CASHTAG) {
      const route: RouteLocationRaw = {
        name: ROUTES.cashtag,
        params: { tag: part.substring(1) },
      };

      return {
        text: part,
        route,
        tagType: EchoTagType.Cashtag,
      };
    } else {
      return { text: part } as EchoContentPart;
    }
  });

  return contentParts;
};
