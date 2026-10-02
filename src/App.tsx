import { Page } from "@/components/Page";
import { Soon } from "@/pages/Soon";
import { Talk } from "@/pages/Talk";
import { usePage } from "@/lib/route";

export function App() {
  const page = usePage();
  return <Page current={page}>{page === "talk" ? <Talk /> : <Soon page={page} />}</Page>;
}
