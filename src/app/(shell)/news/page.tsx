import { NewsFeed } from "@/components/news/news-feed";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return <NewsFeed content={pagesContent["news"]} />;
}
