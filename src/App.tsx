import { useEffect, useState } from "react";

import { Page } from "@/components/Page";
import { getUnread } from "@/lib/appApi";
import { type PageName, usePage } from "@/lib/route";
import { useNotices } from "@/lib/stream";
import { Margins } from "@/pages/Margins";
import { Soon } from "@/pages/Soon";
import { Controls } from "@/pages/Controls";
import { Lists } from "@/pages/Lists";
import { Settings } from "@/pages/Settings";
import { Systems } from "@/pages/Systems";
import { Talk } from "@/pages/Talk";

/** `pages`: the sections this build offers (default all) - Home Assistant's
 * Felt panel only has Talk and Margins, HA does controls, lists and systems. */
export function App({ pages, onMenu }: { pages?: readonly PageName[]; onMenu?: () => void } = {}) {
  const hashPage = usePage();
  const page = !pages || pages.includes(hashPage) ? hashPage : "talk";
  const [unread, setUnread] = useState(0);
  const refreshUnread = () => {
    getUnread()
      .then(setUnread)
      .catch(() => {});
  };
  useEffect(refreshUnread, []);
  useNotices((n) => {
    if (n.type === "hello" || (n.type === "line" && n.kind !== "chat")) refreshUnread();
  });

  return (
    <Page current={page} pages={pages} onMenu={onMenu} badges={{ margins: unread }}>
      {page === "talk" ? (
        <Talk />
      ) : page === "margins" ? (
        <Margins unread={unread} onUnreadChange={refreshUnread} />
      ) : page === "systems" ? (
        <Systems />
      ) : page === "lists" ? (
        <Lists />
      ) : page === "controls" ? (
        <Controls />
      ) : page === "settings" ? (
        <Settings />
      ) : (
        <Soon page={page} />
      )}
    </Page>
  );
}
