import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Use | Worldview", description: "Terms governing use of Worldview." };

const heading = "mt-10 text-xl font-semibold text-slate-950 dark:text-white";
const paragraph = "mt-3 leading-7 text-slate-700 dark:text-slate-300";
const list = "mt-3 list-disc space-y-2 pl-6 leading-7 text-slate-700 dark:text-slate-300";

export default function TermsPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  const contactHref = email ? `mailto:${email}` : null;

  return (
    <article className="mx-auto max-w-3xl pb-16 pt-6">
      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Worldview policies</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">Terms of Use</h1>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Effective October 8, 2026</p>
      <p className="mt-7 text-lg leading-8 text-slate-700 dark:text-slate-300">
        These Terms govern access to and use of Worldview. By using the service, you agree to these Terms and the <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>. If you do not agree, do not use the service.
      </p>

      <h2 className={heading}>The service</h2>
      <p className={paragraph}>
        Worldview organizes public records and provides tools for exploring government, elections, demographics, public issues, political finance, and geography. It is an independent informational resource and is not an official government website.
      </p>

      <h2 className={heading}>Information is not professional advice</h2>
      <p className={paragraph}>
        Content is provided for research, education, and general information. It is not legal, financial, tax, voting, safety, or other professional advice. Verify important information with the original source or responsible government office before relying on it.
      </p>

      <h2 className={heading}>Sources, accuracy, and corrections</h2>
      <p className={paragraph}>
        Worldview aims to preserve source attribution and describe coverage and methodology, but public records can be incomplete, delayed, revised, mislabeled, or wrong. Calculations, normalization, matching, projections, and summaries can also contain errors. Worldview does not warrant that content is complete, current, or accurate. Please report suspected errors through the contact channel below.
      </p>

      <h2 className={heading}>Accounts</h2>
      <p className={paragraph}>
        Some features require an account. You must provide accurate account information, keep credentials secure, and promptly report suspected unauthorized access. You are responsible for activity performed through your account.
      </p>

      <h2 className={heading}>Acceptable use</h2>
      <p className={paragraph}>You may not use Worldview to:</p>
      <ul className={list}>
        <li>Break the law, violate another person&apos;s rights, or facilitate harassment, threats, fraud, or discrimination.</li>
        <li>Attempt unauthorized access, probe security, evade access controls, or interfere with the service or its users.</li>
        <li>Introduce malware, overload the service, or use automated access in a way that materially degrades availability.</li>
        <li>Misrepresent Worldview content as an official government statement or remove source attribution in a misleading way.</li>
        <li>Submit data or content you do not have the right to provide.</li>
      </ul>

      <h2 className={heading}>Your content</h2>
      <p className={paragraph}>
        You retain rights you hold in content you create or submit, including map projects, quiz inputs, and partner datasets. You grant Worldview a nonexclusive, worldwide, royalty-free license to host, process, reproduce, and display that content only as needed to operate, secure, and improve the service and to make content public when you choose a public setting. You represent that you have the rights needed to provide the content.
      </p>

      <h2 className={heading}>Public links and visibility</h2>
      <p className={paragraph}>
        An unclaimed quiz remains accessible to anyone with its hard-to-guess link. A claimed quiz can be public or private, and its owner can delete it. Do not include sensitive personal information in content intended to be public. Changing or deleting content does not remove copies that other people saved or shared while it was public.
      </p>

      <h2 className={heading}>Dataset publishing</h2>
      <p className={paragraph}>
        Dataset publishing requires approval and credentials. Publishers must provide accurate metadata and source attribution, follow applicable licenses and laws, and have permission to submit the data. Worldview may validate, reject, unpublish, correct, or remove submissions that are unsafe, unlawful, misleading, technically incompatible, or inconsistent with the catalog.
      </p>

      <h2 className={heading}>Intellectual property and public data</h2>
      <p className={paragraph}>
        The Worldview software, design, and original content are protected by applicable intellectual property laws and any licenses published with the source code. Government records and third-party datasets remain subject to their own legal status, terms, and licenses. Inclusion in Worldview does not transfer ownership or grant rights beyond those provided by the source.
      </p>

      <h2 className={heading}>Third-party services</h2>
      <p className={paragraph}>
        Worldview links to and relies on third-party services, data providers, authentication providers, geocoders, map providers, and websites. Their terms and privacy practices apply to their services. Worldview is not responsible for third-party content, availability, security, or conduct.
      </p>

      <h2 className={heading}>Availability and changes</h2>
      <p className={paragraph}>
        Features, datasets, accounts, and the service may be changed, suspended, or discontinued. Access may be limited or terminated for security, legal, operational, or policy reasons, including violation of these Terms. Where practical, Worldview will try to provide notice of material changes.
      </p>

      <h2 className={heading}>Disclaimers and limits</h2>
      <p className={paragraph}>
        To the fullest extent permitted by law, Worldview is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind. Worldview disclaims implied warranties of merchantability, fitness for a particular purpose, noninfringement, and accuracy. To the fullest extent permitted by law, Worldview and its contributors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost data, profits, revenue, or opportunities arising from use of the service. Some jurisdictions do not allow certain exclusions, so these limits may not apply to you.
      </p>

      <h2 className={heading}>Changes to these Terms</h2>
      <p className={paragraph}>
        These Terms may be updated as Worldview changes. The effective date will be revised for a new version. Continued use after an update means you accept the revised Terms. If a change is material, additional notice may be provided where practical.
      </p>

      <h2 className={heading}>Contact</h2>
      <p className={paragraph}>
        Questions, correction reports, and legal notices can be submitted through the {contactHref ? <a href={contactHref} className="font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300">Worldview contact channel</a> : "Worldview contact channel"}.
      </p>
    </article>
  );
}
