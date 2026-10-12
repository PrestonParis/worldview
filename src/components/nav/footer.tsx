import Link from "next/link";
import { SLOGAN } from "@/lib/site";

const GROUPS = [
  {
    title: "Explore",
    links: [["Issues", "/#issues"], ["Elections", "/elections"], ["People and power", "/people"], ["My Government", "/my-government"]],
  },
  {
    title: "Data and tools",
    links: [["Dataset catalog", "/datasets"], ["Publish data", "/datasets/publish"], ["Political Quiz", "/quiz"], ["Geography Studio", "/geography"]],
  },
  {
    title: "Worldview",
    links: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Source code", "https://github.com/PrestonParis/worldview"]],
  },
] as const;

export function Footer() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  const contactHref = email ? `mailto:${email}` : "https://github.com/PrestonParis/worldview/issues";

  return (
    <footer className="border-t border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-8 py-12 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Link href="/" className="text-lg font-semibold text-slate-950 dark:text-white">Worldview</Link>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{SLOGAN}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Public records on government, elections, people, money, and the issues shaping the United States.
          </p>
          <a href={contactHref} className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">Contact</a>
        </div>
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{group.title}</h2>
            <ul className="mt-3 space-y-2.5">
              {group.links.map(([label, href]) => (
                <li key={href}><Link href={href} className="text-sm text-slate-600 hover:text-blue-700 hover:underline dark:text-slate-400 dark:hover:text-blue-300">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-slate-200 px-8 py-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:text-slate-400">
        <p>© {new Date().getFullYear()} Worldview</p>
        <p>Informational resource. Not an official government website.</p>
      </div>
    </footer>
  );
}
