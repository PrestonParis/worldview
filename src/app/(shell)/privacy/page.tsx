import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Worldview",
  description: "How Worldview handles personal information and user data.",
};

const heading = "mt-10 text-xl font-semibold text-slate-950 dark:text-white";
const paragraph = "mt-3 leading-7 text-slate-700 dark:text-slate-300";
const list = "mt-3 list-disc space-y-2 pl-6 leading-7 text-slate-700 dark:text-slate-300";

export default function PrivacyPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  const contactHref = email ? `mailto:${email}` : null;

  return (
    <article className="mx-auto max-w-3xl pb-16 pt-6">
      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Worldview policies</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">Privacy Policy</h1>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Effective October 8, 2026</p>
      <p className="mt-7 text-lg leading-8 text-slate-700 dark:text-slate-300">
        Worldview is a public data service. Most of the site can be used without an account. This policy explains what
        information Worldview processes, why it is used, and the choices available to you.
      </p>

      <h2 className={heading}>Information we process</h2>
      <ul className={list}>
        <li>
          <strong>Account information.</strong> If you register, Worldview processes your email address, authentication
          provider information, an optional display name, and account timestamps. Passwords and authentication sessions
          are managed by Supabase Auth.
        </li>
        <li>
          <strong>Content you create.</strong> Saved Geography Studio projects include the project name, map view, and
          layers. Worldview Atlas sessions include answers, refinements, status, visibility, and timestamps. If signed
          in, Atlas also stores philosophies you deliberately save and compact specialist-assessment results. The quiz
          landing page records its opening answers, their timing, and whether a quiz was started, with no cookie,
          account, IP address, or browser details attached.
        </li>
        <li>
          <strong>Address lookups.</strong> When you use My Government, the address you enter is sent through
          Worldview&apos;s server to geocoding and civic-data services so the site can determine relevant jurisdictions
          and offices.
        </li>
        <li>
          <strong>Technical information.</strong> Hosting, authentication, security, and other service providers may
          process IP address, browser, device, request, cookie, and diagnostic information needed to deliver and protect
          the service.
        </li>
        <li>
          <strong>Public records.</strong> Worldview republishes and organizes government and other public-interest
          data. Some source records, such as campaign finance filings, can include names, location, employer,
          occupation, and transaction details that are already public.
        </li>
        <li>
          <strong>Data-publisher information.</strong> Approved data partners may provide contact information,
          credentials, datasets, and submission records.
        </li>
      </ul>

      <h2 id="address-lookups" className={`${heading} scroll-mt-24`}>
        Address lookups
      </h2>
      <p className={paragraph}>
        Worldview does not save the address entered into My Government in its application database. The address or its
        coordinates are sent to Esri&apos;s ArcGIS geocoding service and the U.S. Census Bureau geocoder. A configured
        civic-data provider may also receive the address. Those providers may process technical request information
        under their own policies. Lookup responses are not cached by the Worldview application.
      </p>

      <h2 className={heading}>How we use information</h2>
      <ul className={list}>
        <li>
          Provide search, account access, saved maps, quiz results, address lookup, and dataset publishing features.
        </li>
        <li>
          Measure and improve the Political Quiz from anonymized answers: how its questions perform and how results are
          distributed.
        </li>
        <li>Maintain, secure, debug, and improve the service.</li>
        <li>Respond to support, privacy, data correction, and publisher requests.</li>
        <li>Prevent misuse and comply with applicable legal obligations.</li>
      </ul>
      <p className={paragraph}>
        Worldview does not sell personal information and does not use behavioral advertising. The current application
        does not include a behavioral analytics product; quiz statistics come only from the anonymized quiz answers
        described above.
      </p>

      <h2 className={heading}>Service providers and external services</h2>
      <p className={paragraph}>Worldview relies on service providers only as needed to operate particular features:</p>
      <ul className={list}>
        <li>
          <a href="https://supabase.com/privacy" className="underline underline-offset-2">
            Supabase
          </a>{" "}
          provides authentication and related account infrastructure.
        </li>
        <li>Google may process information when Google sign-in is enabled and selected.</li>
        <li>Cloudflare may process browser and request information when Turnstile abuse protection is enabled.</li>
        <li>
          <a
            href="https://www.esri.com/en-us/privacy/privacy-statements/privacy-statement"
            className="underline underline-offset-2"
          >
            Esri
          </a>{" "}
          and the{" "}
          <a
            href="https://www.census.gov/about/policies/privacy/privacy-policy.html"
            className="underline underline-offset-2"
          >
            U.S. Census Bureau
          </a>{" "}
          process address lookup requests as described above.
        </li>
        <li>Map tile providers, including OpenFreeMap, receive normal web requests when an interactive map loads.</li>
        <li>Hosting and email providers process information needed to deliver the site and authentication messages.</li>
      </ul>
      <p className={paragraph}>
        Worldview may also disclose information if required by law, to protect people or the service, or as part of a
        reorganization or transfer of the project, subject to applicable law.
      </p>

      <h2 className={heading}>Cookies and local storage</h2>
      <p className={paragraph}>
        Worldview uses authentication cookies to keep users signed in. An unclaimed quiz uses a browser cookie
        containing an edit token so the same browser can continue editing it. Theme preference is stored in local
        storage. Security providers may set strictly necessary cookies when enabled.
      </p>

      <h2 className={heading}>Sharing and visibility</h2>
      <p className={paragraph}>
        Unclaimed quiz results can be viewed by anyone who has their hard-to-guess link. These links remain available so
        people can revisit old results. When a quiz is claimed by an account, its owner can choose public or private
        visibility. Public quiz pages can be shared and indexed. Saved Geography Studio projects are associated with the
        account that created them and are not presented as public pages by the current service.
      </p>

      <h2 className={heading}>Retention and deletion</h2>
      <p className={paragraph}>
        Account information and saved content are kept while the account is active or as needed to provide the service.
        Completed quiz results and their hard-to-guess links are retained so old results remain available. Unclaimed
        unfinished quizzes expire after 30 days of inactivity, and anonymous quiz-entry analytics expire after 90 days.
        Security and operational records may be retained for a reasonable period. The account page lets you permanently
        delete your account, saved map projects, and claimed quizzes. Backups and provider logs may take additional time
        to expire.
      </p>

      <h2 className={heading}>Your choices</h2>
      <ul className={list}>
        <li>Browse the public site without creating an account.</li>
        <li>Update your display name and password from the account page.</li>
        <li>Change a claimed quiz between public and private.</li>
        <li>Delete your account and associated user content from the account page.</li>
        <li>Contact Worldview to request access, correction, or deletion where applicable.</li>
      </ul>

      <h2 className={heading}>Security, children, and changes</h2>
      <p className={paragraph}>
        Worldview uses reasonable safeguards, but no internet service can guarantee absolute security. The service is
        intended for a general audience and is not directed to children under 13. If Worldview learns that a child under
        13 supplied personal information, it will take appropriate steps to remove it. This policy may be updated as the
        service changes; the effective date above will be revised when it does.
      </p>

      <h2 className={heading}>Contact</h2>
      <p className={paragraph}>
        Questions, privacy requests, and data correction requests can be submitted through the{" "}
        {contactHref ? (
          <a href={contactHref} className="font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300">
            Worldview contact channel
          </a>
        ) : (
          "Worldview contact channel"
        )}
        . See the{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms of Use
        </Link>{" "}
        for the rules that apply to the service.
      </p>
    </article>
  );
}
