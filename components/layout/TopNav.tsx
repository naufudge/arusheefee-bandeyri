import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalSearch } from "@/components/search/GlobalSearch";

// Sticky bar above every signed-in page: sidebar toggle and global search.
// The right spacer mirrors the toggle so the search sits in the true middle.
export function TopNav() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6 lg:px-10">
      <SidebarTrigger className="-ml-1 shrink-0" />
      <div className="flex min-w-0 flex-1 justify-center">
        <GlobalSearch />
      </div>
      <div aria-hidden className="-mr-1 hidden size-7 shrink-0 sm:block" />
    </header>
  );
}
