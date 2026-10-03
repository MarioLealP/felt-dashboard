import { useEffect, useState } from "react";

import { Page } from "@/components/Page";
import { getUnread } from "@/lib/appApi";
import { usePage } from "@/lib/route";
import { useNotices } from "@/lib/stream";
import { Margins } from "@/pages/Margins";
import { Soon } from "@/pages/Soon";
import { Controls } from "@/pages/Controls";
import { Lists } from "@/pages/Lists";
import { Settings } from "@/pages/Settings";
import { Systems } from "@/pages/Systems";
import { Talk } from "@/pages/Talk";

export function App() {
  const page = usePage();
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
    <Page current={page} badges={{ margins: unread }}>
      {page === "talk" ? (
        <Talk />
      ) : page === "margins" ? (
        <Margins onUnreadChange={refreshUnread} />
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
